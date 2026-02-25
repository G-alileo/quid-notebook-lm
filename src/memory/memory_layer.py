import logging
import os
import time
from typing import Optional, Any, Dict, List
from datetime import datetime
import httpx

from zep_cloud.client import Zep
from zep_crewai import ZepUserStorage
from crewai.memory.external.external_memory import ExternalMemory
from src.generation.rag import RAGResult

logger = logging.getLogger(__name__)


class MemoryLayer:
    def __init__(
        self,
        user_id: str,
        session_id: str,
        zep_api_key: Optional[str] = None,
        mode: str = "summary",
        indexing_wait_time: int = 10,
        create_new_session: bool = False
    ):
        self.user_id = user_id
        self.session_id = session_id
        self.indexing_wait_time = indexing_wait_time

        http_client = httpx.Client(timeout=60.0)
        self.zep_client = Zep(
            api_key=zep_api_key or os.getenv("ZEP_API_KEY"),
            httpx_client=http_client
        )

        self._setup_user_and_session(create_new_session)

        self.user_storage = ZepUserStorage(
            client=self.zep_client,
            user_id=self.user_id,
            thread_id=self.session_id,
            mode=mode,
        )
        self.external_memory = ExternalMemory(storage=self.user_storage)

        logger.info(f"MemoryLayer initialized for user {user_id}, session {session_id}")

    def _setup_user_and_session(self, create_new_session: bool):
        try:
            self._ensure_user()

            if create_new_session:
                self._delete_session_if_exists()
                self._retry_with_backoff(
                    lambda: self.zep_client.thread.create(thread_id=self.session_id, user_id=self.user_id)
                )
                logger.info(f"Created new session: {self.session_id}")
            else:
                self._get_or_create_session()
        except Exception as e:
            logger.error(f"Error setting up user/session: {e}")
            raise

    def _ensure_user(self):
        def _try():
            try:
                self.zep_client.user.get(self.user_id)
                logger.info(f"Using existing user: {self.user_id}")
            except Exception:
                self.zep_client.user.add(user_id=self.user_id)
                logger.info(f"Created new user: {self.user_id}")
        self._retry_with_backoff(_try)

    def _delete_session_if_exists(self):
        try:
            self.zep_client.thread.delete(self.session_id)
            logger.info(f"Deleted previous session: {self.session_id}")
        except Exception:
            pass

    def _get_or_create_session(self):
        def _try():
            try:
                self.zep_client.thread.get(self.session_id)
                logger.info(f"Using existing session: {self.session_id}")
            except Exception:
                self.zep_client.thread.create(thread_id=self.session_id, user_id=self.user_id)
                logger.info(f"Created session: {self.session_id}")
        self._retry_with_backoff(_try)

    def _ensure_thread_exists(self):
        try:
            self.zep_client.thread.get(self.session_id)
        except Exception:
            logger.warning(f"Thread {self.session_id} not found, recreating")
            self.zep_client.thread.create(thread_id=self.session_id, user_id=self.user_id)

    def _retry_with_backoff(self, func, max_retries: int = 3):
        for attempt in range(max_retries):
            try:
                return func()
            except Exception as e:
                error_str = str(e)
                if ("408" in error_str or "timeout" in error_str.lower()) and attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning(f"Timeout (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s")
                    time.sleep(wait_time)
                    continue
                raise

    def save_conversation_turn(
        self,
        rag_result: RAGResult,
        user_metadata: Optional[Dict[str, Any]] = None,
        assistant_metadata: Optional[Dict[str, Any]] = None
    ):
        try:
            self._ensure_thread_exists()

            user_meta = {
                "type": "message",
                "role": "user",
                "timestamp": datetime.now().isoformat(),
                "session_id": self.session_id,
                **(user_metadata or {})
            }
            self._retry_with_backoff(
                lambda: self.external_memory.save(rag_result.query, metadata=user_meta)
            )

            assistant_meta = {
                "type": "message",
                "role": "assistant",
                "timestamp": datetime.now().isoformat(),
                "session_id": self.session_id,
                "sources_count": len(rag_result.sources_used),
                "retrieval_count": rag_result.retrieval_count,
                "model_used": getattr(rag_result, 'model_name', 'unknown'),
                "sources_summary": self._create_sources_summary(rag_result.sources_used),
                **(assistant_metadata or {})
            }
            self._retry_with_backoff(
                lambda: self.external_memory.save(rag_result.response, metadata=assistant_meta)
            )

            self._save_source_context(rag_result.sources_used)
            logger.info(f"Saved conversation turn with {len(rag_result.sources_used)} sources")

        except Exception as e:
            logger.error(f"Error saving conversation turn: {e}")
            raise

    def _create_sources_summary(self, sources_used: List[Dict[str, Any]]) -> str:
        if not sources_used:
            return "No sources used"

        source_files = list(set(s.get('source_file', 'Unknown') for s in sources_used))
        source_types = list(set(s.get('source_type', 'unknown') for s in sources_used))

        summary = f"{len(source_files)} files ({', '.join(source_types)}): {', '.join(source_files[:3])}"
        if len(source_files) > 3:
            summary += f" and {len(source_files) - 3} more"
        return summary

    def _save_source_context(self, sources_used: List[Dict[str, Any]]):
        if not sources_used:
            return

        source_context = {
            "referenced_documents": [],
            "document_types": set(),
        }

        for source in sources_used:
            doc_info = {
                "file": source.get('source_file', 'Unknown'),
                "type": source.get('source_type', 'unknown'),
                "page": source.get('page_number'),
                "relevance": source.get('relevance_score', 0)
            }
            source_context["referenced_documents"].append(doc_info)
            source_context["document_types"].add(doc_info["type"])

        source_context["document_types"] = list(source_context["document_types"])

        self._retry_with_backoff(
            lambda: self.external_memory.save(
                f"Document sources referenced: {source_context}",
                metadata={
                    "type": "source_context",
                    "category": "document_usage",
                    "session_id": self.session_id
                }
            )
        )

    def save_user_preferences(self, preferences: Dict[str, Any]):
        try:
            self._retry_with_backoff(
                lambda: self.external_memory.save(
                    f"User preferences: {preferences}",
                    metadata={
                        "type": "preferences",
                        "category": "user_settings",
                        "timestamp": datetime.now().isoformat(),
                        "session_id": self.session_id
                    }
                )
            )
            logger.info("User preferences saved to memory")
        except Exception as e:
            logger.error(f"Error saving preferences: {e}")

    def save_document_metadata(self, document_info: Dict[str, Any]):
        try:
            self._retry_with_backoff(
                lambda: self.external_memory.save(
                    f"Document processed: {document_info}",
                    metadata={
                        "type": "document_metadata",
                        "category": "system_events",
                        "timestamp": datetime.now().isoformat(),
                        "session_id": self.session_id
                    }
                )
            )
            logger.info(f"Document metadata saved: {document_info.get('name', 'Unknown')}")
        except Exception as e:
            logger.error(f"Error saving document metadata: {e}")

    def get_conversation_context(self) -> str:
        try:
            memory = self.zep_client.thread.get_user_context(thread_id=self.session_id)
            return memory.context if memory.context else ""
        except Exception as e:
            logger.error(f"Error getting conversation context: {e}")
            return "No conversation context available"

    def get_relevant_memory(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        try:
            results = self.zep_client.graph.search(
                user_id=self.user_id,
                query=query,
                scope="episodes",
            )

            relevant_memories = []
            for ep in results.episodes:
                memory_info = {
                    "content": ep.content if ep.content else "",
                    "role": ep.role_type if ep.role_type else "unknown",
                    "relevance_score": ep.score if hasattr(ep, 'score') else 0,
                    "thread_id": ep.thread_id if ep.thread_id else None,
                    "session_id": ep.session_id if ep.session_id else None,
                    "timestamp": ep.created_at if ep.created_at else None,
                }
                relevant_memories.append(memory_info)

            logger.info(f"Retrieved {len(relevant_memories)} relevant memories for query")
            return relevant_memories

        except Exception as e:
            logger.error(f"Error getting relevant memory: {e}")
            return []

    def wait_for_indexing(self):
        logger.info(f"Waiting {self.indexing_wait_time}s for Zep indexing...")
        time.sleep(self.indexing_wait_time)

    def get_session_summary(self) -> Dict[str, Any]:
        try:
            messages = self.zep_client.thread.get(thread_id=self.session_id)

            if not messages or not messages.messages:
                return {"message_count": 0, "summary": "No messages in session"}

            user_messages = [m for m in messages.messages if m.role == "user"]
            assistant_messages = [m for m in messages.messages if m.role == "assistant"]

            return {
                "session_id": self.session_id,
                "user_id": self.user_id,
                "total_messages": len(messages.messages),
                "user_messages": len(user_messages),
                "assistant_messages": len(assistant_messages),
                "context_available": bool(self.get_conversation_context()),
                "last_interaction": messages.messages[0].created_at if messages.messages else None
            }

        except Exception as e:
            logger.error(f"Error getting session summary: {e}")
            return {"error": str(e)}

    def clear_session(self):
        try:
            self.zep_client.thread.delete(self.session_id)
            self.zep_client.thread.create(thread_id=self.session_id, user_id=self.user_id)
            logger.info(f"Session {self.session_id} cleared and recreated")
        except Exception as e:
            logger.error(f"Error clearing session: {e}")
            raise
