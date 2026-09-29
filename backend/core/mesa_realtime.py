import asyncio
import json
import time
from contextlib import suppress

import asyncpg
import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import AsyncSessionLocal
from core.logger import logger

router = APIRouter()


class MesaConnectionManager:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()
        self.lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        async with self.lock:
            self.connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self.lock:
            self.connections.discard(websocket)

    async def broadcast(self, event: dict) -> None:
        async with self.lock:
            connections = tuple(self.connections)

        disconnected = []
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except (RuntimeError, WebSocketDisconnect):
                disconnected.append(websocket)

        for websocket in disconnected:
            await self.disconnect(websocket)


manager = MesaConnectionManager()


async def notify_mesa_change(db: AsyncSession) -> None:
    try:
        await db.execute(
            text("SELECT pg_notify('mesa_events', :payload);"),
            {"payload": json.dumps({"type": "mesa.updated"})},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("No se pudo notificar el cambio de mesa por WebSocket.")


async def listen_for_mesa_events() -> None:
    dsn = make_url(settings.DATABASE_URL).set(drivername="postgresql").render_as_string(hide_password=False)

    while True:
        connection = None
        try:
            connection = await asyncpg.connect(dsn)

            def on_event(_connection, _process_id, _channel, payload: str) -> None:
                asyncio.create_task(manager.broadcast(json.loads(payload)))

            await connection.add_listener("mesa_events", on_event)
            await asyncio.Future()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Listener PostgreSQL de mesas desconectado; reintentando.")
            await asyncio.sleep(5)
        finally:
            if connection is not None and not connection.is_closed():
                with suppress(Exception):
                    await connection.close()


@router.websocket("/ws/mesas")
async def mesa_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    authenticated = False
    try:
        auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        token = auth_message.get("token") if isinstance(auth_message, dict) else None
        if not isinstance(token, str):
            await websocket.close(code=1008)
            return

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("user_id")
        expires_at = payload.get("exp")
        if not isinstance(user_id, str) or not user_id or not isinstance(expires_at, (int, float)):
            await websocket.close(code=1008)
            return

        async with AsyncSessionLocal() as db:
            user = await db.execute(
                text("SELECT id FROM users WHERE id = :id AND is_active = TRUE;"),
                {"id": user_id},
            )
            if user.first() is None:
                await websocket.close(code=1008)
                return

        await manager.connect(websocket)
        authenticated = True
        await websocket.send_json({"type": "ready"})
        while time.time() < expires_at:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=min(30, expires_at - time.time()))
            except asyncio.TimeoutError:
                if time.time() >= expires_at:
                    break
                await websocket.send_json({"type": "ping"})
        with suppress(RuntimeError):
            await websocket.close(code=1008)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except jwt.PyJWTError:
        with suppress(RuntimeError):
            await websocket.close(code=1008)
    finally:
        if authenticated:
            await manager.disconnect(websocket)