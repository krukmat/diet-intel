# EPIC A · Historia A3 — Bloqueos y Moderación Básica

> Objetivo: implementar la funcionalidad de bloquear/desbloquear usuarios, impedir interacciones cuando existe un bloqueo y exponer listados de bloqueados/bloqueadores en backend, webapp y mobile.

---

## 1. Preparación general

1. Confirmar que estás en la rama `gamification-social-diet` y que el arbol de trabajo está limpio:
   ```bash
git checkout gamification-social-diet
git status
```
2. Desde la raíz del repositorio, crear un branch de trabajo si se desea (`feature/a3-blocks`).
3. Mantener formato existente (PEP 8, ESLint) y reutilizar patrones de A1/A2; todo el código nuevo debe incluir comentarios solo cuando aporten contexto adicional.

---

## 2. Persistencia: tablas de bloqueo y eventos

1. Crear el archivo `database/init/016_create_blocks.sql` con **exactamente** lo siguiente:
   ```sql
   CREATE TABLE IF NOT EXISTS user_blocks (
     blocker_id TEXT NOT NULL,
     blocked_id TEXT NOT NULL,
     reason TEXT,
     status TEXT NOT NULL CHECK(status IN ('active','revoked')) DEFAULT 'active',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (blocker_id, blocked_id)
   );
   CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

   CREATE TABLE IF NOT EXISTS block_events (
     id TEXT PRIMARY KEY,
     blocker_id TEXT NOT NULL,
     blocked_id TEXT NOT NULL,
     action TEXT NOT NULL CHECK(action IN ('block','unblock')),
     reason TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```
2. Editar `app/services/database.py`:
   - Localizar el método `init_database`.
   - Debajo de la sección que crea `user_follows` añadir los bloques `CREATE TABLE`/`CREATE INDEX` equivalentes para `user_blocks` y `block_events`.
   - Asegurarse de cerrar cada sentencia con triple comillas y de mantener la consistencia con el resto de inicializaciones.
3. Si se utiliza el script de datos dummy (`scripts/create_dummy_data.py`), añadir dos usuarios y una relación de bloqueo para pruebas manuales.

---

## 3. Modelos Pydantic para bloqueos

1. Crear `app/models/social/block.py` con los modelos siguientes:
   ```python
   from datetime import datetime
   from enum import Enum
   from typing import List, Optional, Literal
   from pydantic import BaseModel

   class BlockAction(str, Enum):
       BLOCK = 'block'
       UNBLOCK = 'unblock'

   class BlockActionRequest(BaseModel):
       action: BlockAction
       reason: Optional[str] = None

   class BlockActionResponse(BaseModel):
       ok: bool
       blocker_id: str
       blocked_id: str
       status: Literal['active', 'revoked']
       blocked_at: datetime

   class BlockListItem(BaseModel):
       user_id: str
       handle: str
       avatar_url: Optional[str]
       since: datetime
       reason: Optional[str]

   class BlockListResponse(BaseModel):
       items: List[BlockListItem]
       next_cursor: Optional[str] = None
   ```
2. Actualizar `app/models/social/__init__.py` para exportar los nuevos modelos (`BlockAction`, `BlockActionRequest`, etc.).

---

## 4. Servicio de bloqueos

1. Crear `app/services/social/block_service.py` siguiendo esta estructura:
   - Clase `BlockService` con métodos sincrónicos (`block_user`, `unblock_user`, `list_blocked`, `list_blockers`, `is_blocking`). Evitar `async` para reducir complejidad.
   - Utilizar `with db_service.get_connection()` para manejar transacciones.
   - **block_user(blocker_id, blocked_id, reason=None):**
     1. Validar que `blocker_id != blocked_id`; si son iguales, lanzar `HTTPException(400, "cannot block self")`.
     2. Comprobar si ya existe el registro activo; si sí, devolver respuesta idempotente sin modificar datos.
     3. Eliminar cualquier follow en ambos sentidos:
        - `DELETE FROM user_follows WHERE follower_id=? AND followee_id=?` (dos consultas separadas o una con OR).
        - Obtener `changes()` para saber si se borró relación y, solo en ese caso, decrementar contadores en `profile_stats` (`followers_count` del bloqueado, `following_count` del bloqueador) usando `MAX(0, count - 1)`.
     4. Insertar fila en `user_blocks` (`status='active'`, `created_at=CURRENT_TIMESTAMP`).
     5. Insertar evento en `block_events` (`action='block'`) utilizando `uuid.uuid4()`.
     6. Publicar evento `UserAction.UserBlocked` mediante `publish_event` con payload `{'blocker_id', 'blocked_id', 'reason', 'ts'}`.
     7. Devolver `BlockActionResponse` con `blocked_at` (datetime.utcnow()).
   - **unblock_user(blocker_id, blocked_id):**
     1. Verificar si existe fila `status='active'`; si no, retornar `ok=True`, `status='revoked'` sin modificar nada.
     2. Actualizar fila a `status='revoked', updated_at=CURRENT_TIMESTAMP`.
     3. Insertar evento `block_events` con `action='unblock'` y publicar `UserAction.UserUnblocked`.
     4. Retornar `BlockActionResponse` con `status='revoked'`.
   - **list_blocked(blocker_id, limit=20, cursor=None):**
     1. Decodificar cursor si existe (`base64(created_at|user_id)`), validar errores.
     2. Hacer JOIN con `user_profiles` para obtener `handle`/`avatar_url`; ordenar por `created_at DESC, user_id ASC`.
     3. Recuperar `limit+1` filas para detectar paginación; construir `BlockListItem`; generar `next_cursor` si corresponde.
   - **list_blockers(blocked_id, ...):** igual que anterior pero invirtiendo roles.
   - **is_blocking(blocker_id, blocked_id):** devolver `True/False` según exista fila `status='active'`.
   - Al final del archivo, instanciar `block_service = BlockService()`.
2. Crear pruebas unitarias `tests/social/test_block_service.py` cubriendo:
   - Bloqueo feliz (inserta fila, elimina follow, ajusta contadores, graba evento).
   - Bloqueo idempotente (segunda llamada no cambia datos).
   - Unblock feliz.
   - Auto-bloqueo -> HTTP 400.
   - Cursor válido/ inválido en `list_blocked` y `list_blockers`.
   - Confirmar que `publish_event` se invoca con nombre correcto.

---

## 5. Integración con ModerationGateway y FollowService

1. Editar `app/services/social/moderation_gateway.py`:
   - Importar `block_service`.
   - Hacer que `is_blocked(viewer_id, target_id)` retorne `True` si `block_service.is_blocking(target_id, viewer_id)` **o** `block_service.is_blocking(viewer_id, target_id)`.
   - Añadir `get_block_relation(viewer_id, target_id)` que devuelva `'blocked'`, `'blocked_by'` o `None` usando las mismas consultas.
2. Actualizar `app/services/social/follow_service.py`:
   - Antes de aplicar la lógica de follow, llamar `moderation_gateway.is_blocked` y, si devuelve `True`, retornar `FollowActionResponse(ok=False, status='blocked', blocked=True, ...)` sin tocar contadores.
   - El response model ya debe incluir `blocked: bool`; verificar que se establece en todos los caminos relevantes.
   - Ajustar listados (`list_followers`/`list_following`) para omitir usuarios bloqueados si así lo define la historia (opcional, documentar decisión).
3. Añadir pruebas adicionales en `tests/social/test_follow_routes.py` para confirmar que intenta seguir a usuario bloqueado retorna `ok=False, blocked=True` y HTTP 200.

---

## 6. Rutas FastAPI de bloqueos

1. Crear `app/routes/block.py` con el siguiente contenido base:
   ```python
   from typing import Optional
   from fastapi import APIRouter, Depends, HTTPException, Query
   from app.models.user import User
   from app.services.auth import get_current_user
   from app.models.social.block import BlockActionRequest, BlockActionResponse, BlockListResponse
   from app.services.social.block_service import block_service

   router = APIRouter(prefix="", tags=["blocks"])

   @router.post("/blocks/{target_id}", response_model=BlockActionResponse)
   async def block_toggle(target_id: str, request: BlockActionRequest, current_user: User = Depends(get_current_user)):
       ...

   @router.get("/profiles/{user_id}/blocked", response_model=BlockListResponse)
   async def list_blocked(...):
       ...

   @router.get("/profiles/{user_id}/blockers", response_model=BlockListResponse)
   async def list_blockers(...):
       ...
   ```
   - Dentro de `block_toggle`, impedir self-block, llamar a `block_service.block_user` o `...unblock_user` según `request.action` y manejar excepciones genéricas con `HTTPException(500)`.
   - En listados, validar que `current_user.id == user_id` o que el usuario tenga rol admin (si existe). Manejar cursores inválidos devolviendo 400.
2. Registrar el router en `main.py`:
   ```python
   from app.routes.block import router as block_router
   ...
   app.include_router(block_router)
   ```
3. Añadir `tests/social/test_block_routes.py` con los casos:
   - Bloqueo y desbloqueo exitosos (mockear `block_service`).
   - Intento de bloquearse a sí mismo -> 400.
   - Listados paginados devolviendo `items` y `next_cursor`.
   - Cursor inválido -> 400.

---

## 7. Webapp (Express)

1. `webapp/utils/api.js`:
   - Añadir métodos `blockUser`, `unblockUser`, `getBlockedUsers`, `getBlockers` que llamen a `/blocks/:id` o `/profiles/:id/blocked|blockers` con el token actual.
2. `webapp/routes/profiles.js`:
   - Añadir endpoint `POST /profiles/:id/block` que use `dietIntelAPI.blockUser/unblockUser` y devuelva JSON (para AJAX) o redireccione en HTML normal.
   - Añadir GET `/profiles/:id/blocked` y `/profiles/:id/blockers` que obtengan los listados y rendericen nuevas vistas.
3. Vistas EJS:
   - Actualizar `webapp/views/profiles/show.ejs` para mostrar botones Follow/Unfollow **y** Block/Unblock basados en `profile.block_relation`.
   - Crear `webapp/views/profiles/blocked.ejs` y `webapp/views/profiles/blockers.ejs` con tablas/listas que muestren `handle`, `avatar`, fecha `since` y `next_cursor`.
4. JS cliente `webapp/public/js/profile.js`:
   - Implementar `toggleBlock(event, targetUserId)` similar a `toggleFollow`, gestionando errores y actualizando contadores/estados.
   - Asegurar que `toggleFollow` deshabilite el botón si `profile.block_relation` es `'blocked'` o `'blocked_by'`.
5. Tests webapp:
   - Actualizar/crear suites en `webapp/tests/profiles.routes.test.js` y `webapp/tests/profiles.views.test.js` para cubrir los flujos de bloqueo.
   - Si se usa JS modular, considerar tests con JSDOM para `toggleBlock`.

---

## 8. Mobile (React Native)

1. `mobile/services/ApiService.ts`:
   - Métodos `blockUser`, `unblockUser`, `getBlockedUsers`, `getBlockers` usando rutas backend.
2. `mobile/types/profile.ts`:
   - Añadir `block_relation?: 'blocked' | 'blocked_by' | null` al modelo `Profile`.
3. `mobile/screens/ProfileScreen.tsx`:
   - Añadir botón Block/Unblock sólo para usuarios que no sean dueños del perfil.
   - Si el usuario bloquea, limpiar estado de follow y deshabilitar botón de follow.
   - Mostrar mensajes con `Alert` o `ToastAndroid`.
4. Nuevas pantallas:
   - Crear `mobile/screens/BlockedListScreen.tsx` y `mobile/screens/BlockedByScreen.tsx` con `FlatList`, paginación por cursor y botón “Load more”.
   - Asegurar manejo de estados `loading`, `empty`, `error`.
5. Tests Jest:
   - Actualizar `mobile/__tests__/ProfileScreen.test.tsx` para cubrir bloqueos.
   - Crear `mobile/__tests__/BlockedListScreen.test.tsx` y `mobile/__tests__/BlockedByScreen.test.tsx` que validen render y paginación.

---

## 9. Eventos y outbox

1. Definir constantes en un módulo central (p.ej. `app/services/social/event_names.py`) para `UserAction.UserBlocked` y `UserAction.UserUnblocked`.
2. Verificar que `publish_event` inserta en `event_outbox` para bloqueos igual que para follows.
3. Añadir pruebas que consulten `event_outbox` después de bloquear/desbloquear en el servicio.

---

## 10. Validación y documentación final

1. Ejecutar suites automatizadas:
   ```bash
   python -m pytest tests/social/test_block_service.py
   python -m pytest tests/social/test_block_routes.py
   NODE_ENV=test npm --prefix webapp run test:profiles
   npm --prefix mobile test -- ProfileScreen
   npm --prefix mobile test -- BlockedList
   ```
2. Correr linters:
   ```bash
   npm --prefix webapp run lint
   npm --prefix mobile run lint
   ```
3. Documentación:
   - Actualizar `docs/api/social.md` describiendo los endpoints de bloqueos.
   - Añadir pasos manuales en `manual-user-tests.md` (bloquear, intentar seguir, desbloquear, revisar listados paginados, verificar eventos).
4. Regenerar notas en `PENDING_FINAL.md` con resultados y comandos ejecutados.

---

## 11. Checklist de verificación manual

- [ ] Bloquear un usuario elimina follows en ambos sentidos y bloquea nuevas solicitudes de follow.
- [ ] Desbloquear permite volver a seguir.
- [ ] Los listados `/profiles/:id/blocked` y `/blockers` muestran usuarios y paginan correctamente.
- [ ] Los eventos `UserAction.UserBlocked/UserUnblocked` aparecen en `event_outbox`.
- [ ] Webapp y mobile reflejan el estado de bloqueo (botones, mensajes) y los flujos funcionan sin errores visibles.
