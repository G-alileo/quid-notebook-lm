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
        max_tokens: int = 2000,
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
        max_chunks: int = 8,
        max_context_chars: int = 4000,
        top_k: int = 10,
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
        return f"""You are an AI assistant that answers questions based on provided source material. You must follow these citation rules:

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

    def generate_summary(self, max_chunks: int = 15, summary_length: str = "medium") -> RAGResult:
        try:
            summary_query = "main topics key findings important information overview"
            query_vector = self.embedding_generator.generate_query_embedding(summary_query)
            search_results = self.vector_db.search(query_vector=query_vector.tolist(), limit=max_chunks)

            if not search_results:
                return RAGResult(query="Document Summary", response="No documents available for summarization.", sources_used=[], retrieval_count=0)

            context, sources_info = self._format_context_with_citations(search_results, max_chunks, 6000)

            length_instructions = {
                'short': "Provide a concise 2-3 paragraph summary highlighting the most important points.",
                'medium': "Provide a comprehensive 4-5 paragraph summary covering key topics and findings.",
                'long': "Provide a detailed summary with multiple sections covering all major topics and supporting details."
            }

            prompt = f"""You are tasked with creating a summary of the provided document content. Follow these guidelines:

1. {length_instructions.get(summary_length, length_instructions['medium'])}
2. Include citations [1], [2], etc. for all factual claims
3. Organize information logically with clear topics
4. Focus on the most important and relevant information
5. Maintain accuracy and cite sources properly

DOCUMENT CONTENT (with citation references):
{context}

Please provide a well-structured summary with proper citations:"""

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
