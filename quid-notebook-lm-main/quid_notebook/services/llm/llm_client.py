import logging
import time
from typing import Optional

from crewai import LLM

logger = logging.getLogger(__name__)

RATE_LIMIT_KEYWORDS = ["429", "RESOURCE_EXHAUSTED", "rate limit", "quota exceeded", "Too Many Requests"]

DEFAULT_MODELS = {
    "deepseek": "deepseek-chat",
    "gemini": "gemini-2.0-flash",
    "openai": "gpt-4o-mini",
}


def default_model(provider: str) -> str:
    return DEFAULT_MODELS.get(provider, provider)


def build_llm(provider: str, model_name: str, api_key: str, temperature: float, max_tokens: int) -> LLM:
    if provider == "deepseek":
        return LLM(
            model=f"openai/{model_name}",
            temperature=temperature,
            max_tokens=max_tokens,
            api_key=api_key,
            base_url="https://api.deepseek.com/v1",
        )
    if provider == "gemini":
        return LLM(model=f"gemini/{model_name}", temperature=temperature, max_tokens=max_tokens, api_key=api_key)
    return LLM(model=f"openai/{model_name}", temperature=temperature, max_tokens=max_tokens, api_key=api_key)


def extract_text(response) -> str:
    if response is None:
        return ""
    if hasattr(response, "content"):
        return response.content
    if hasattr(response, "text"):
        return response.text
    return str(response) if not isinstance(response, str) else response


def is_rate_limit_error(error: Exception) -> bool:
    msg = str(error).lower()
    return any(kw.lower() in msg for kw in RATE_LIMIT_KEYWORDS)


class LLMClient:
    def __init__(
        self,
        api_key: str,
        provider: str = "deepseek",
        model_name: str = "deepseek-chat",
        temperature: float = 0.1,
        max_tokens: int = 2000,
        fallback_api_key: Optional[str] = None,
        fallback_provider: Optional[str] = None,
        fallback_model: Optional[str] = None,
    ):
        self.provider = provider
        self.model_name = model_name

        try:
            self.llm = build_llm(provider, model_name, api_key, temperature, max_tokens)
            logger.info(f"Primary LLM: {provider}/{model_name}")
        except Exception as e:
            logger.error(f"Failed to build primary LLM ({provider}/{model_name}): {e}")
            self.llm = None

        self.fallback_llm: Optional[LLM] = None
        if fallback_api_key and fallback_provider:
            fb_model = fallback_model or default_model(fallback_provider)
            try:
                self.fallback_llm = build_llm(fallback_provider, fb_model, fallback_api_key, temperature, max_tokens)
                logger.info(f"Fallback LLM: {fallback_provider}/{fb_model}")
            except Exception as e:
                logger.error(f"Failed to build fallback LLM ({fallback_provider}/{fb_model}): {e}")

        if self.llm is None and self.fallback_llm is not None:
            logger.warning("Promoting fallback LLM to primary")
            self.llm = self.fallback_llm
            self.fallback_llm = None
        elif self.llm is None:
            raise RuntimeError(f"Could not initialise any LLM (tried {provider}, fallback {fallback_provider})")

    def call(self, prompt: str, retries: int = 1, retry_delay: float = 5.0) -> str:
        primary_error: Optional[Exception] = None

        for attempt in range(1 + retries):
            try:
                return extract_text(self.llm.call(prompt))
            except Exception as e:
                primary_error = e
                if is_rate_limit_error(e) and attempt < retries:
                    logger.warning(f"Primary LLM rate-limited (attempt {attempt + 1}): {e}")
                    time.sleep(retry_delay)
                    continue
                logger.warning(f"Primary LLM failed (attempt {attempt + 1}): {e}")
                break

        if self.fallback_llm:
            logger.info("Switching to fallback LLM")
            for fb_attempt in range(4):
                try:
                    return extract_text(self.fallback_llm.call(prompt))
                except Exception as fb_err:
                    if is_rate_limit_error(fb_err) and fb_attempt < 3:
                        wait = 10.0 * (fb_attempt + 1)
                        logger.warning(f"Fallback rate-limited (attempt {fb_attempt + 1}), retrying in {wait}s")
                        time.sleep(wait)
                        continue
                    raise RuntimeError(
                        f"Both LLMs failed.\n  Primary: {primary_error}\n  Fallback: {fb_err}"
                    ) from fb_err

        raise primary_error
