from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

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


# Serve frontend assets in production if compiled
frontend_dist_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
    "frontend", 
    "dist"
)

if os.path.exists(frontend_dist_path):
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/{file_name:path}")
    async def serve_static_or_spa(file_name: str):
        # Prevent intercepting FastAPI router endpoints or documentation
        if file_name.startswith(("auth/", "users/", "documents/", "chat/", "podcast/", "docs", "redoc", "openapi.json", "health")):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
            
        file_path = os.path.join(frontend_dist_path, file_name)
        if file_name and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        index_path = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
            
        return {"message": "Frontend not built"}

