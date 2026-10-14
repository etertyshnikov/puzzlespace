# -*- coding: utf-8 -*-
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.services.auth import require_admin

logger = logging.getLogger(__name__)

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
OUT_DIR = BASE_DIR / "frontend" / "schemaspy"
SCRIPT = BASE_DIR / "scripts" / "schemaspy-generate.sh"

_generating = False
_generate_lock = asyncio.Lock()


def _report_info() -> tuple[bool, str | None]:
    index = OUT_DIR / "index.html"
    if not index.is_file():
        return False, None
    mtime = datetime.fromtimestamp(index.stat().st_mtime, tz=timezone.utc)
    return True, mtime.isoformat()


@router.get("/status")
async def schemaspy_status(_user=Depends(require_admin)):
    ready, mod_time = _report_info()
    return {
        "ready": ready,
        "generated_at": mod_time or "",
        "url": "/schemaspy/index.html",
    }


@router.post("/generate")
async def schemaspy_generate(_user=Depends(require_admin)):
    global _generating

    if _generating:
        raise HTTPException(status_code=409, detail="генерация уже выполняется")

    if not SCRIPT.is_file():
        raise HTTPException(status_code=500, detail=f"скрипт не найден: {SCRIPT}")

    async with _generate_lock:
        _generating = True
        try:
            proc = await asyncio.create_subprocess_exec(
                "bash",
                str(SCRIPT),
                cwd=str(BASE_DIR),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            try:
                stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=180)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                raise HTTPException(status_code=500, detail="schemaspy: timeout (3 min)") from None

            log = stdout.decode("utf-8", errors="replace")
            if proc.returncode != 0:
                logger.warning("schemaspy generate failed: %s", log)
                raise HTTPException(
                    status_code=500,
                    detail=f"schemaspy: exit {proc.returncode}\n{log}",
                )

            ready, mod_time = _report_info()
            if not ready:
                raise HTTPException(status_code=500, detail="отчёт не создан после генерации")

            return {
                "ready": True,
                "generated_at": mod_time,
                "url": "/schemaspy/index.html",
                "log": log,
            }
        finally:
            _generating = False


def serve_schemaspy_file(file_path: str) -> FileResponse:
    if not (OUT_DIR / "index.html").is_file():
        raise HTTPException(
            status_code=404,
            detail=(
                "SchemaSpy отчёт не сгенерирован. "
                "Настройки → SchemaSpy → «Сгенерировать отчёт» или bash scripts/schemaspy-generate.sh"
            ),
        )
    rel = file_path or "index.html"
    clean = Path(rel)
    if ".." in clean.parts:
        raise HTTPException(status_code=404, detail="Not Found")
    full = (OUT_DIR / clean).resolve()
    root = OUT_DIR.resolve()
    if not str(full).startswith(str(root)):
        raise HTTPException(status_code=404, detail="Not Found")
    if not full.is_file():
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(full)
