from quid_notebook.api.main import app
import os

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("DEBUG", "false").lower() == "true"
    if reload:
        uvicorn.run("main:app", host=host, port=port, reload=reload, reload_dirs=["quid_notebook"])
    else:
        uvicorn.run("main:app", host=host, port=port, reload=reload)
