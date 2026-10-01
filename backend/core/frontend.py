from pathlib import Path

from fastapi.responses import FileResponse


FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


def template_response(filename: str) -> FileResponse:
    return FileResponse(FRONTEND_DIR / "templates" / filename)