from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from quid_notebook.core import settings, database, Base
from quid_notebook.api.routers import auth_router, users_router
from quid_notebook.api.routers.documents import router as documents_router
from quid_notebook.api.routers.chat import router as chat_router
from quid_notebook.api.routers.podcast import router as podcast_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.create_tables(Base)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None
)

# Extend CORS origins to support Vite dev server
cors_origins = list(settings.CORS_ORIGINS)
if "http://localhost:5173" not in cors_origins:
    cors_origins.append("http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(documents_router)
app.include_router(chat_router)
app.include_router(podcast_router)


@app.get("/health")
def health():
    return {"status": "healthy"}
