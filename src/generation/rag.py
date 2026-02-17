import logging
import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from crewai import LLM
from src.vector_database.milvus_vector_db import MilvusVectorDB
from src.embeddings.embedding_generator import EmbeddingGenerator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class RAGResult:
    """Represents the result of RAG generation with citations"""
    query: str
    response: str
    sources_used: List[Dict[str, Any]]
    retrieval_count: int
    generation_tokens: Optional[int] = None
    
    def get_citation_summary(self) -> str:
        if not self.sources_used:
            return "No sources cited"
        
        source_summary = []
        for source in self.sources_used:
            source_info = f"• {source.get('source_file', 'Unknown')} ({source.get('source_type', 'unknown')})"
            if source.get('page_number'):
                source_info += f" - Page {source['page_number']}"
            source_summary.append(source_info)
        
        return "\n".join(source_summary)


class RAGGenerator:
    # Errors that should trigger a fallback to the secondary LLM
    RATE_LIMIT_KEYWORDS = ["429", "RESOURCE_EXHAUSTED", "rate limit", "quota exceeded", "Too Many Requests"]

    def __init__(
        self,
        embedding_generator: EmbeddingGenerator,
        vector_db: MilvusVectorDB,
        api_key: str,
        provider: str = "deepseek",
        model_name: str = "deepseek-chat",
        temperature: float = 0.1,
        max_tokens: int = 2000,
        fallback_api_key: Optional[str] = None,
        fallback_provider: Optional[str] = None,
        fallback_model: Optional[str] = None,
    ):
        self.embedding_generator = embedding_generator
        self.vector_db = vector_db

        # ── primary LLM ──
        try:
            self.llm = self._build_llm(provider, model_name, api_key, temperature, max_tokens)
            logger.info(f"Primary LLM built: {provider}/{model_name}")
        except Exception as e:
            logger.error(f"Failed to build primary LLM ({provider}/{model_name}): {e}")
            self.llm = None

        self.provider = provider
        self.model_name = model_name

        # ── fallback LLM (optional) ──
        self.fallback_llm: Optional[LLM] = None
        if fallback_api_key and fallback_provider:
            fb_model = fallback_model or self._default_model(fallback_provider)
            try:
                self.fallback_llm = self._build_llm(fallback_provider, fb_model, fallback_api_key, temperature, max_tokens)
                logger.info(f"Fallback LLM configured: {fallback_provider}/{fb_model}")
            except Exception as e:
                logger.error(f"Failed to build fallback LLM ({fallback_provider}/{fb_model}): {e}")

        # If primary failed but fallback succeeded, promote fallback
        if self.llm is None and self.fallback_llm is not None:
            logger.warning("Promoting fallback LLM to primary since primary failed to build")
            self.llm = self.fallback_llm
            self.fallback_llm = None
        elif self.llm is None:
            raise RuntimeError(f"Could not initialise any LLM (tried {provider}, fallback {fallback_provider})")

        logger.info(f"RAG Generator initialized with primary={provider}/{model_name}")

    # ── helpers ──────────────────────────────────────────────
    @staticmethod
    def _default_model(provider: str) -> str:
        defaults = {"deepseek": "deepseek-chat", "gemini": "gemini-2.0-flash", "openai": "gpt-4o-mini"}
        return defaults.get(provider, provider)

    @staticmethod
    def _build_llm(provider: str, model_name: str, api_key: str, temperature: float, max_tokens: int) -> LLM:
        if provider == "deepseek":
            # DeepSeek uses an OpenAI-compatible API
            return LLM(
                model=f"openai/{model_name}",
                temperature=temperature,
                max_tokens=max_tokens,
                api_key=api_key,
                base_url="https://api.deepseek.com/v1",
            )
        elif provider == "gemini":
            return LLM(model=f"gemini/{model_name}", temperature=temperature, max_tokens=max_tokens, api_key=api_key)
        else:
            return LLM(model=f"openai/{model_name}", temperature=temperature, max_tokens=max_tokens, api_key=api_key)

    def _is_rate_limit_error(self, error: Exception) -> bool:
        msg = str(error)
        return any(kw.lower() in msg.lower() for kw in self.RATE_LIMIT_KEYWORDS)

    def _call_llm_with_fallback(self, prompt: str, retries: int = 1, retry_delay: float = 5.0) -> str:
        """Call the primary LLM; on ANY error, retry then fall back to secondary with retries."""
        primary_error: Optional[Exception] = None

        # ── try primary ──
        for attempt in range(1 + retries):
            try:
                result = self._extract_text(self.llm.call(prompt))
                logger.info("Primary LLM responded successfully")
                return result
            except Exception as e:
                primary_error = e
                if self._is_rate_limit_error(e) and attempt < retries:
                    logger.warning(f"Primary LLM rate-limited (attempt {attempt+1}): {e}")
                    time.sleep(retry_delay)
                    continue
                else:
                    logger.warning(f"Primary LLM failed (attempt {attempt+1}): {e}")
                    break  # move to fallback

        # ── try fallback (with its own retries for rate limits) ──
        if self.fallback_llm:
            logger.info("Switching to fallback LLM …")
            fallback_retries = 3
            fallback_delay = 10.0  # longer delay to let rate-limit windows pass
            for fb_attempt in range(1 + fallback_retries):
                try:
                    result = self._extract_text(self.fallback_llm.call(prompt))
                    logger.info("Fallback LLM responded successfully")
                    return result
                except Exception as fb_err:
                    if self._is_rate_limit_error(fb_err) and fb_attempt < fallback_retries:
                        wait = fallback_delay * (fb_attempt + 1)  # linear back-off
                        logger.warning(f"Fallback LLM rate-limited (attempt {fb_attempt+1}), retrying in {wait}s …")
                        time.sleep(wait)
                        continue
                    else:
                        logger.error(f"Fallback LLM also failed: {fb_err}")
                        raise RuntimeError(
                            f"Both LLMs failed.\n"
                            f"  Primary error: {primary_error}\n"
                            f"  Fallback error: {fb_err}"
                        ) from fb_err
        else:
            raise primary_error  # no fallback configured

    @staticmethod
    def _extract_text(response) -> str:
        if response is None:
            return "I apologize, but I couldn't generate a response. Please try again."
        if hasattr(response, "content"):
            return response.content
        if hasattr(response, "text"):
            return response.text
        if not isinstance(response, str):
            return str(response)
        return response
    
    def generate_response(
        self,
        query: str,
        max_chunks: int = 8,
        max_context_chars: int = 4000,
        top_k: int = 10,
    ) -> RAGResult:

        if not query.strip():
            return RAGResult(
                query=query,
                response="Please provide a valid question.",
                sources_used=[],
                retrieval_count=0
            )
        
        try:
            logger.info(f"Generating response for: '{query[:50]}...'")
            
            # Step 1: Retrieve relevant chunks
            query_vector = self.embedding_generator.generate_query_embedding(query)
            search_results = self.vector_db.search(
                query_vector=query_vector.tolist(),
                limit=top_k
            )
            
            if not search_results:
                return RAGResult(
                    query=query,
                    response="I couldn't find any relevant information in the available documents to answer your question.",
                    sources_used=[],
                    retrieval_count=0
                )
            
            # Step 2: Format context with citations
            context, sources_info = self._format_context_with_citations(
                search_results, max_chunks, max_context_chars
            )
            
            # Step 3: Create citation-aware prompt
            prompt = self._create_rag_prompt(query, context)
            
            # Step 4: Generate response (with automatic fallback)
            response = self._call_llm_with_fallback(prompt)
            
            # Step 5: Create result object
            rag_result = RAGResult(
                query=query,
                response=response,
                sources_used=sources_info,
                retrieval_count=len(search_results)
            )
            
            logger.info(f"Response generated successfully using {len(sources_info)} sources")
            return rag_result
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return RAGResult(
                query=query,
                response=f"I encountered an error while processing your question: {str(e)}",
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
            source_file = citation_info.get('source_file', 'Unknown Source')
            source_type = citation_info.get('source_type', 'unknown')
            page_number = citation_info.get('page_number')
            
            citation_ref = f"[{i+1}]"
            chunk_content = result['content']
            chunk_text = f"{citation_ref} {chunk_content}"
            
            if total_chars + len(chunk_text) > max_context_chars and context_parts:
                break
            
            context_parts.append(chunk_text)
            total_chars += len(chunk_text)
            
            source_info = {
                'reference': citation_ref,
                'source_file': source_file,
                'source_type': source_type,
                'page_number': page_number,
                'chunk_id': result['id'],
                'relevance_score': result['score']
            }
            sources_info.append(source_info)
        
        formatted_context = '\n\n'.join(context_parts)

        return formatted_context, sources_info
    
    def _create_rag_prompt(self, query: str, context: str) -> str:
        prompt = f"""You are an AI assistant that answers questions based on provided source material. You must follow these citation rules:

CITATION REQUIREMENTS:
1. For each factual claim in your answer, include the citation reference number in square brackets [1], [2], etc.
2. Only use information from the provided context - do not add external knowledge
3. If you cannot find relevant information in the context, say so clearly
4. Be precise and accurate in your citations
5. When multiple sources support the same point, list all relevant citations like this [1], [2], [3].

CONTEXT (with citation references):
{context}

QUESTION: {query}

Please provide a comprehensive answer with proper citations. Make sure every factual statement is supported by a citation reference."""
        
        return prompt
    
    def generate_summary(
        self,
        max_chunks: int = 15,
        summary_length: str = "medium"
    ) -> RAGResult:
        try:
            summary_query = "main topics key findings important information overview"
            query_vector = self.embedding_generator.generate_query_embedding(summary_query)
            search_results = self.vector_db.search(
                query_vector=query_vector.tolist(),
                limit=max_chunks
            )
            
            if not search_results:
                return RAGResult(
                    query="Document Summary",
                    response="No documents available for summarization.",
                    sources_used=[],
                    retrieval_count=0
                )
            
            context, sources_info = self._format_context_with_citations(
                search_results, max_chunks, 6000
            )
            
            length_instructions = {
                'short': "Provide a concise 2-3 paragraph summary highlighting the most important points.",
                'medium': "Provide a comprehensive 4-5 paragraph summary covering key topics and findings.",
                'long': "Provide a detailed summary with multiple sections covering all major topics and supporting details."
            }
            
            summary_prompt = f"""You are tasked with creating a summary of the provided document content. Follow these guidelines:

1. {length_instructions.get(summary_length, length_instructions['medium'])}
2. Include citations [1], [2], etc. for all factual claims
3. Organize information logically with clear topics
4. Focus on the most important and relevant information
5. Maintain accuracy and cite sources properly

DOCUMENT CONTENT (with citation references):
{context}

Please provide a well-structured summary with proper citations:"""
            
            response = self._call_llm_with_fallback(summary_prompt)
            
            return RAGResult(
                query="Document Summary",
                response=response,
                sources_used=sources_info,
                retrieval_count=len(search_results)
            )
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            return RAGResult(
                query="Document Summary",
                response=f"Error generating summary: {str(e)}",
                sources_used=[],
                retrieval_count=0
            )


if __name__ == "__main__":
    import os
    from src.document_processing.doc_processor import DocumentProcessor
    from src.embeddings.embedding_generator import EmbeddingGenerator
    from src.vector_database.milvus_vector_db import MilvusVectorDB
    
    # Resolve primary + fallback from env
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    gemini_key = os.getenv("GEMINI_API")
    openai_key = os.getenv("OPENAI_API_KEY")
    llm_provider = os.getenv("LLM_PROVIDER", "deepseek").lower()

    primary_key = deepseek_key if llm_provider == "deepseek" else (gemini_key if llm_provider == "gemini" else openai_key)
    if not primary_key:
        print("Please set DEEPSEEK_API_KEY, GEMINI_API, or OPENAI_API_KEY")
        exit(1)

    # pick a fallback that isn't the same provider
    fb_key, fb_provider = (None, None)
    if llm_provider != "gemini" and gemini_key:
        fb_key, fb_provider = gemini_key, "gemini"
    elif llm_provider != "deepseek" and deepseek_key:
        fb_key, fb_provider = deepseek_key, "deepseek"
    
    try:
        embedding_gen = EmbeddingGenerator()
        vector_db = MilvusVectorDB()
        rag_generator = RAGGenerator(
            embedding_generator=embedding_gen,
            vector_db=vector_db,
            api_key=primary_key,
            provider=llm_provider,
            temperature=0.1,
            fallback_api_key=fb_key,
            fallback_provider=fb_provider,
        )
        
        test_query = "What are the main findings discussed in the documents?"
        result = rag_generator.generate_response(test_query)
        
        print(f"Query: {result.query}")
        print(f"Response: {result.response}")
        print(f"\nSources Used ({len(result.sources_used)}):")
        print(result.get_citation_summary())
        
        summary_result = rag_generator.generate_summary(summary_length="medium")
        print(f"\nDocument Summary:")
        print(summary_result.response)
        
    except Exception as e:
        print(f"Error in RAG pipeline example: {e}")