import logging
import json
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from crewai import LLM
from src.document_processing.doc_processor import DocumentProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PodcastScript:
    """Represents a podcast script with metadata"""
    script: List[Dict[str, str]]
    source_document: str
    total_lines: int
    estimated_duration: str
    
    def get_speaker_lines(self, speaker: str) -> List[str]:
        return [item[speaker] for item in self.script if speaker in item]
    
    def to_json(self) -> str:
        return json.dumps({
            'script': self.script,
            'metadata': {
                'source_document': self.source_document,
                'total_lines': self.total_lines,
                'estimated_duration': self.estimated_duration
            }
        }, indent=2)


class PodcastScriptGenerator:
    RATE_LIMIT_KEYWORDS = ["429", "RESOURCE_EXHAUSTED", "rate limit", "quota exceeded", "Too Many Requests"]

    def __init__(
        self,
        api_key: str,
        provider: str = "deepseek",
        model_name: str = "deepseek-chat",
        fallback_api_key: Optional[str] = None,
        fallback_provider: Optional[str] = None,
        fallback_model: Optional[str] = None,
    ):
        try:
            self.llm = self._build_llm(provider, model_name, api_key, 0.7, 4000)
            logger.info(f"Primary script-gen LLM built: {provider}/{model_name}")
        except Exception as e:
            logger.error(f"Failed to build primary script-gen LLM ({provider}/{model_name}): {e}")
            self.llm = None

        self.doc_processor = DocumentProcessor()
        self.provider = provider

        # fallback LLM
        self.fallback_llm: Optional[LLM] = None
        if fallback_api_key and fallback_provider:
            fb_model = fallback_model or self._default_model(fallback_provider)
            try:
                self.fallback_llm = self._build_llm(fallback_provider, fb_model, fallback_api_key, 0.7, 4000)
                logger.info(f"Script gen fallback LLM: {fallback_provider}/{fb_model}")
            except Exception as e:
                logger.error(f"Failed to build fallback script-gen LLM: {e}")

        # Promote fallback if primary failed
        if self.llm is None and self.fallback_llm is not None:
            logger.warning("Promoting fallback LLM to primary for script gen")
            self.llm = self.fallback_llm
            self.fallback_llm = None
        elif self.llm is None:
            raise RuntimeError(f"Could not initialise any LLM for script gen")

        logger.info(f"Podcast script generator initialized with {provider}/{model_name}")

    @staticmethod
    def _default_model(provider: str) -> str:
        return {"deepseek": "deepseek-chat", "gemini": "gemini-2.0-flash", "openai": "gpt-4o-mini"}.get(provider, provider)

    @staticmethod
    def _build_llm(provider, model_name, api_key, temperature, max_tokens):
        if provider == "deepseek":
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
        primary_error = None
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
                    break

        if self.fallback_llm:
            logger.info("Script gen: switching to fallback LLM …")
            fallback_retries = 3
            fallback_delay = 10.0
            for fb_attempt in range(1 + fallback_retries):
                try:
                    result = self._extract_text(self.fallback_llm.call(prompt))
                    logger.info("Fallback LLM responded successfully")
                    return result
                except Exception as fb_err:
                    if self._is_rate_limit_error(fb_err) and fb_attempt < fallback_retries:
                        wait = fallback_delay * (fb_attempt + 1)
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
        raise primary_error

    @staticmethod
    def _extract_text(response) -> str:
        if response is None:
            raise Exception("LLM returned None response")
        if hasattr(response, "content"):
            return response.content
        if hasattr(response, "text"):
            return response.text
        if not isinstance(response, str):
            return str(response)
        return response
    
    def generate_script_from_document(
        self,
        document_path: str,
        podcast_style: str = "conversational",
        target_duration: str = "10 minutes"
    ) -> PodcastScript:

        logger.info(f"Generating podcast script from: {document_path}")
        
        chunks = self.doc_processor.process_document(document_path)
        if not chunks:
            raise ValueError("No content extracted from document")
        
        document_content = "\n\n".join([chunk.content for chunk in chunks])
        source_name = chunks[0].source_file
        script_data = self._generate_conversation_script(
            document_content, 
            podcast_style, 
            target_duration
        )
        
        podcast_script = PodcastScript(
            script=script_data['script'],
            source_document=source_name,
            total_lines=len(script_data['script']),
            estimated_duration=target_duration
        )
        
        logger.info(f"Generated script with {podcast_script.total_lines} lines")
        return podcast_script
    
    def generate_script_from_text(
        self,
        text_content: str,
        source_name: str = "Text Input",
        podcast_style: str = "conversational",
        target_duration: str = "10 minutes"
    ) -> PodcastScript:

        logger.info("Generating podcast script from text input")
        
        script_data = self._generate_conversation_script(
            text_content,
            podcast_style,
            target_duration
        )
        
        podcast_script = PodcastScript(
            script=script_data['script'],
            source_document=source_name,
            total_lines=len(script_data['script']),
            estimated_duration=target_duration
        )
        
        logger.info(f"Generated script with {podcast_script.total_lines} lines")
        return podcast_script
    
    def generate_script_from_website(
        self,
        website_chunks: List[Any],
        source_url: str,
        podcast_style: str = "conversational",
        target_duration: str = "10 minutes"
    ) -> PodcastScript:

        logger.info(f"Generating podcast script from website: {source_url}")
        
        if not website_chunks:
            raise ValueError("No website content provided")
        
        website_content = "\n\n".join([chunk.content for chunk in website_chunks])
        script_data = self._generate_conversation_script(
            website_content,
            podcast_style,
            target_duration
        )
        
        podcast_script = PodcastScript(
            script=script_data['script'],
            source_document=source_url,
            total_lines=len(script_data['script']),
            estimated_duration=target_duration
        )
        
        logger.info(f"Generated website script with {podcast_script.total_lines} lines")
        return podcast_script
    
    def _generate_conversation_script(
        self,
        document_content: str,
        podcast_style: str,
        target_duration: str
    ) -> Dict[str, Any]:

        style_prompts = {
            "conversational": "Create a natural, friendly conversation between two hosts discussing the document. They should build on each other's points and occasionally ask clarifying questions.",
            "educational": "Create an educational discussion where one speaker explains concepts and the other asks thoughtful questions to help clarify complex topics for listeners.",
            "interview": "Create an interview format where Speaker 1 acts as the interviewer asking questions and Speaker 2 provides detailed explanations from the document.",
            "debate": "Create a thoughtful discussion where speakers present different perspectives on the topics, maintaining respect while exploring various viewpoints."
        }
        
        style_instruction = style_prompts.get(podcast_style, style_prompts["conversational"])
    
        duration_guidelines = {
            "5 minutes": "Keep the conversation concise, focusing on 3-4 main points with brief explanations.",
            "10 minutes": "Cover the key topics thoroughly with good explanations and examples.",
            "15 minutes": "Provide comprehensive coverage with detailed discussions and multiple examples.",
            "20 minutes": "Create an in-depth exploration with extensive analysis and supporting details."
        }
        
        duration_guide = duration_guidelines.get(target_duration, duration_guidelines["10 minutes"])
        
        prompt = f"""Using the following document, create a podcast script for two speakers: 'Speaker 1' and 'Speaker 2'. 

STYLE GUIDELINES:
{style_instruction}

DURATION GUIDELINES:
{duration_guide}

CONVERSATION RULES:
1. Each speaker should speak for 2-4 sentences maximum before alternating
2. The conversation should flow naturally with smooth transitions
3. Use engaging, conversational language that's easy to understand
4. Include brief introductions at the start and wrap-up at the end
5. Break down complex concepts into digestible explanations
6. Maintain professional grammar and punctuation throughout
7. Make it engaging for listeners who haven't read the document

RESPONSE FORMAT:
Respond with a valid JSON object containing a 'script' array. Each array element should be an object with either 'Speaker 1' or 'Speaker 2' as the key and their dialogue as the value.

Example format:
{{
  "script": [
    {{"Speaker 1": "Welcome everyone to our podcast! Today we're diving into some fascinating insights from this document..."}},
    {{"Speaker 2": "Thanks for having me! I'm really excited to discuss this topic. The first thing that caught my attention was..."}}
  ]
}}

DOCUMENT CONTENT:
{document_content[:8000]}  

Generate an engaging {target_duration} podcast script now:"""
        
        try:
            response = self._call_llm_with_fallback(prompt)
            
            script_data = json.loads(response)
            
            if 'script' not in script_data or not isinstance(script_data['script'], list):
                raise ValueError("Invalid script format returned by LLM")
            
            validated_script = self._validate_and_clean_script(script_data['script'])
            
            return {'script': validated_script}
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            response_clean = response.strip()
            if response_clean.startswith('```json'):
                response_clean = response_clean[7:-3]
            elif response_clean.startswith('```'):
                response_clean = response_clean[3:-3]
            
            try:
                script_data = json.loads(response_clean)
                validated_script = self._validate_and_clean_script(script_data['script'])
                return {'script': validated_script}
            except:
                raise ValueError(f"Could not parse LLM response as valid JSON: {response}")
        
        except Exception as e:
            logger.error(f"Error generating script: {str(e)}")
            raise
    
    def _validate_and_clean_script(self, script: List[Dict[str, str]]) -> List[Dict[str, str]]:
        cleaned_script = []
        expected_speaker = "Speaker 1"
        for item in script:
            if not isinstance(item, dict) or len(item) != 1:
                continue
            
            speaker, dialogue = next(iter(item.items()))
            speaker = speaker.strip()

            if speaker not in ["Speaker 1", "Speaker 2"]:
                if "1" in speaker or "one" in speaker.lower():
                    speaker = "Speaker 1"
                elif "2" in speaker or "two" in speaker.lower():
                    speaker = "Speaker 2"
                else:
                    speaker = expected_speaker
            
            dialogue = dialogue.strip()
            if not dialogue:
                continue
            if not dialogue.endswith(('.', '!', '?')):
                dialogue += '.'
            
            cleaned_script.append({speaker: dialogue})

            expected_speaker = "Speaker 2" if expected_speaker == "Speaker 1" else "Speaker 1"
        
        if len(cleaned_script) < 2:
            raise ValueError("Generated script is too short or invalid")
        
        return cleaned_script


if __name__ == "__main__":
    import os
    
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    gemini_key = os.getenv("GEMINI_API")
    openai_key = os.getenv("OPENAI_API_KEY")
    llm_provider = os.getenv("LLM_PROVIDER", "deepseek").lower()

    keys = {"deepseek": deepseek_key, "gemini": gemini_key, "openai": openai_key}
    api_key = keys.get(llm_provider)
    if not api_key:
        print("Please set DEEPSEEK_API_KEY, GEMINI_API, or OPENAI_API_KEY")
        exit(1)

    fb_key, fb_provider = (None, None)
    if llm_provider != "gemini" and gemini_key:
        fb_key, fb_provider = gemini_key, "gemini"
    elif llm_provider != "deepseek" and deepseek_key:
        fb_key, fb_provider = deepseek_key, "deepseek"

    generator = PodcastScriptGenerator(
        api_key, provider=llm_provider,
        fallback_api_key=fb_key, fallback_provider=fb_provider,
    )
    
    try:
        sample_text = """
        Artificial Intelligence (AI) represents one of the most significant technological advances of our time. 
        Machine learning, a subset of AI, enables computers to learn and improve from experience without being 
        explicitly programmed for every task. Deep learning, which uses neural networks with multiple layers, 
        has revolutionized fields like computer vision, natural language processing, and speech recognition. 
        The applications are vast, from autonomous vehicles to medical diagnosis, and the potential impact on 
        society is profound. However, ethical considerations around AI development, including bias, privacy, 
        and job displacement, remain important challenges that need to be addressed as the technology continues to evolve.
        """
        
        script = generator.generate_script_from_text(
            sample_text,
            source_name="AI Overview",
            podcast_style="conversational",
            target_duration="5 minutes"
        )
        
        print("Generated Podcast Script:")
        print("=" * 50)
        print(f"Source: {script.source_document}")
        print(f"Lines: {script.total_lines}")
        print(f"Duration: {script.estimated_duration}")
        print("\nScript:")
        
        for i, line_dict in enumerate(script.script, 1):
            speaker, dialogue = next(iter(line_dict.items()))
            print(f"{i}. {speaker}: {dialogue}\n")
        
        # Save to file
        with open("sample_podcast_script.json", "w") as f:
            f.write(script.to_json())
        print("Script saved to sample_podcast_script.json")
        
    except Exception as e:
        print(f"Error: {e}")