import logging
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from src.llm.llm_client import LLMClient
from src.document_processing.doc_processor import DocumentProcessor

logger = logging.getLogger(__name__)


@dataclass
class PodcastScript:
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
    def __init__(
        self,
        api_key: str,
        provider: str = "deepseek",
        model_name: str = "deepseek-chat",
        fallback_api_key: Optional[str] = None,
        fallback_provider: Optional[str] = None,
        fallback_model: Optional[str] = None,
    ):
        self.llm_client = LLMClient(
            api_key=api_key,
            provider=provider,
            model_name=model_name,
            temperature=0.7,
            max_tokens=2500,
            fallback_api_key=fallback_api_key,
            fallback_provider=fallback_provider,
            fallback_model=fallback_model,
        )
        self.doc_processor = DocumentProcessor()
        logger.info(f"Podcast script generator initialized with {provider}/{model_name}")

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
        script_data = self._generate_conversation_script(document_content, podcast_style, target_duration)

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
        script_data = self._generate_conversation_script(text_content, podcast_style, target_duration)

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
        script_data = self._generate_conversation_script(website_content, podcast_style, target_duration)

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
            "conversational": "Natural, friendly conversation. Hosts build on each other's points.",
            "educational": "One speaker explains, the other asks clarifying questions.",
            "interview": "Speaker 1 interviews; Speaker 2 explains from the document.",
            "debate": "Speakers explore different perspectives respectfully."
        }

        duration_lines = {
            "5 minutes": "~10-14 exchanges, 3-4 key points.",
            "10 minutes": "~20-28 exchanges, cover key topics with examples.",
            "15 minutes": "~30-40 exchanges, detailed coverage.",
            "20 minutes": "~40-52 exchanges, in-depth analysis."
        }

        style_instruction = style_prompts.get(podcast_style, style_prompts["conversational"])
        duration_guide = duration_lines.get(target_duration, duration_lines["10 minutes"])

        prompt = f"""Create a podcast script for 'Speaker 1' and 'Speaker 2' from the document below.
Style: {style_instruction}
Length: {duration_guide}
Rules: alternate speakers every 2-4 sentences; open with an intro, close with a wrap-up; plain conversational language.

Output a JSON object with a 'script' array. Each element is {{"Speaker 1": "..."}} or {{"Speaker 2": "..."}}.

DOCUMENT:
{document_content[:5000]}

JSON script:"""

        try:
            response = self.llm_client.call(prompt)
            script_data = json.loads(response)

            if 'script' not in script_data or not isinstance(script_data['script'], list):
                raise ValueError("Invalid script format returned by LLM")

            validated_script = self._validate_and_clean_script(script_data['script'])
            return {'script': validated_script}

        except json.JSONDecodeError:
            logger.error("Failed to parse LLM response as JSON, attempting cleanup")
            response_clean = response.strip()
            if response_clean.startswith('```json'):
                response_clean = response_clean[7:-3]
            elif response_clean.startswith('```'):
                response_clean = response_clean[3:-3]

            try:
                script_data = json.loads(response_clean)
                validated_script = self._validate_and_clean_script(script_data['script'])
                return {'script': validated_script}
            except Exception:
                raise ValueError(f"Could not parse LLM response as valid JSON: {response}")

        except Exception as e:
            logger.error(f"Error generating script: {e}")
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
