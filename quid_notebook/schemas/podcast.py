from pydantic import BaseModel
from typing import List, Dict

class PodcastScriptRequest(BaseModel):
    source_name: str
    style: str
    length: str

class PodcastScriptResponse(BaseModel):
    total_lines: int
    estimated_duration: str
    source_document: str
    script: List[Dict[str, str]]
