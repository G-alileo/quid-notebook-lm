from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from typing import Generator

from quid_notebook.core.config import settings


class Database:
    _instance = None
    _engine = None
    _session_factory = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._engine = create_engine(
                settings.DATABASE_URL,
                pool_pre_ping=True,
                pool_recycle=300,
                echo=settings.DEBUG
            )
            cls._session_factory = sessionmaker(autocommit=False, autoflush=False, bind=cls._engine)
        return cls._instance

    @classmethod
    def get_session(cls) -> Generator[Session, None, None]:
        db = cls._session_factory()
        try:
            yield db
        finally:
            db.close()

    @classmethod
    def create_tables(cls, base):
        base.metadata.create_all(bind=cls._engine)


Base = declarative_base()
database = Database()
