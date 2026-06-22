from pydantic import BaseModel
from typing import List, Optional

class ChatRequest(BaseModel):
    query: str

class ChatSource(BaseModel):
    reference: str
    source_file: str
    source_type: str
    page_number: Optional[int] = None
    chunk_id: str
    relevance_score: float

class ChatResponse(BaseModel):
    response: str
    sources_used: List[ChatSource]
