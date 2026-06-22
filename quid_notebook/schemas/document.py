from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentResponse(BaseModel):
    id: str
    name: str
    type: str
    size: Optional[str] = None
    chunks: int
    uploaded_at: datetime

    class Config:
        from_attributes = True
