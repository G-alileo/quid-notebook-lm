from sqlalchemy import Column, String, Integer, DateTime, LargeBinary, ForeignKey
from sqlalchemy.dialects.mysql import CHAR
from datetime import datetime, timezone
import uuid

from quid_notebook.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # PDF, Website, YouTube, Text, Audio
    size = Column(String(50), nullable=True)
    chunks = Column(Integer, default=0)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    file_bytes = Column(LargeBinary, nullable=True)  # Store raw PDF bytes for rendering
