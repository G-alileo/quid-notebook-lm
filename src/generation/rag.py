import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from src.llm.llm_client import LLMClient
from src.vector_database.milvus_vector_db import MilvusVectorDB
from src.embeddings.embedding_generator import EmbeddingGenerator

logger = logging.getLogger(__name__)


@dataclass
class RAGResult:
    query: str
    response: str
    sources_used: List[Dict[str, Any]]
    retrieval_count: int
    generation_tokens: Optional[int] = None

    def get_citation_summary(self) -> str:
        if not self.sources_used:
            return "No sources cited"

        lines = []
        for source in self.sources_used:
            info = f"• {source.get('source_file', 'Unknown')} ({source.get('source_type', 'unknown')})"
            if source.get('page_number'):
                info += f" - Page {source['page_number']}"
            lines.append(info)
        return "\n".join(lines)


class RAGGenerator:
    def __init__(
        self,
        embedding_generator: EmbeddingGenerator,
        vector_db: MilvusVectorDB,
        api_key: str,
        provider: str = "deepseek",
        model_name: str = "deepseek-chat",
        temperature: float = 0.1,
        max_tokens: int = 1500,
        fallback_api_key: Optional[str] = None,
        fallback_provider: Optional[str] = None,
        fallback_model: Optional[str] = None,
    ):
        self.embedding_generator = embedding_generator
        self.vector_db = vector_db
        self.llm_client = LLMClient(
            api_key=api_key,
            provider=provider,
            model_name=model_name,
            temperature=temperature,
            max_tokens=max_tokens,
            fallback_api_key=fallback_api_key,
            fallback_provider=fallback_provider,
            fallback_model=fallback_model,
        )
        logger.info(f"RAG Generator initialized with {provider}/{model_name}")

    def generate_response(
        self,
        query: str,
        max_chunks: int = 5,
        max_context_chars: int = 2500,
        top_k: int = 6,
    ) -> RAGResult:

        if not query.strip():
            return RAGResult(query=query, response="Please provide a valid question.", sources_used=[], retrieval_count=0)

        try:
            logger.info(f"Generating response for: '{query[:50]}...'")

            query_vector = self.embedding_generator.generate_query_embedding(query)
            search_results = self.vector_db.search(query_vector=query_vector.tolist(), limit=top_k)

            if not search_results:
                return RAGResult(
                    query=query,
                    response="I couldn't find any relevant information in the available documents to answer your question.",
                    sources_used=[],
                    retrieval_count=0
                )

            context, sources_info = self._format_context_with_citations(search_results, max_chunks, max_context_chars)
            prompt = self._create_rag_prompt(query, context)
            response = self.llm_client.call(prompt)

            result = RAGResult(
                query=query,
                response=response,
                sources_used=sources_info,
                retrieval_count=len(search_results)
            )
            logger.info(f"Response generated using {len(sources_info)} sources")
            return result

        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return RAGResult(
                query=query,
                response=f"I encountered an error while processing your question: {e}",
                sources_used=[],
                retrieval_count=0
            )

    def _format_context_with_citations(
        self,
        search_results: List[Dict[str, Any]],
        max_chunks: int,
        max_context_chars: int
    ) -> Tuple[str, List[Dict[str, Any]]]:

        context_parts = []
        sources_info = []
        total_chars = 0

        for i, result in enumerate(search_results[:max_chunks]):
            citation_info = result['citation']
            citation_ref = f"[{i + 1}]"
            chunk_text = f"{citation_ref} {result['content']}"

            if total_chars + len(chunk_text) > max_context_chars and context_parts:
                break

            context_parts.append(chunk_text)
            total_chars += len(chunk_text)

            sources_info.append({
                'reference': citation_ref,
                'source_file': citation_info.get('source_file', 'Unknown Source'),
                'source_type': citation_info.get('source_type', 'unknown'),
                'page_number': citation_info.get('page_number'),
                'chunk_id': result['id'],
                'relevance_score': result['score']
            })

        return '\n\n'.join(context_parts), sources_info

    def _create_rag_prompt(self, query: str, context: str) -> str:
        return f"""Answer using only the provided sources. Cite each claim with [1], [2], etc. If the answer isn't in the sources, say so.

SOURCES:
{context}

QUESTION: {query}

Answer with inline citations:"""

    def generate_summary(self, max_chunks: int = 10, summary_length: str = "medium") -> RAGResult:
        try:
            summary_query = "main topics key findings important information overview"
            query_vector = self.embedding_generator.generate_query_embedding(summary_query)
            search_results = self.vector_db.search(query_vector=query_vector.tolist(), limit=min(max_chunks, 10))

            if not search_results:
                return RAGResult(query="Document Summary", response="No documents available for summarization.", sources_used=[], retrieval_count=0)

            context, sources_info = self._format_context_with_citations(search_results, max_chunks, 4000)

            length_instructions = {
                'short': "2-3 paragraphs covering the most important points.",
                'medium': "4-5 paragraphs covering key topics and findings.",
                'long': "Multiple sections covering all major topics with supporting details."
            }

            prompt = f"""Summarize the document using only the provided sources. Cite each claim with [1], [2], etc.

Length: {length_instructions.get(summary_length, length_instructions['medium'])}

SOURCES:
{context}

Summary with citations:"""

            response = self.llm_client.call(prompt)

            return RAGResult(
                query="Document Summary",
                response=response,
                sources_used=sources_info,
                retrieval_count=len(search_results)
            )

        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return RAGResult(query="Document Summary", response=f"Error generating summary: {e}", sources_used=[], retrieval_count=0)
