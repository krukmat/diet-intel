---
title: EPIC A · Historia A3 — Bloqueos y Moderación Básica
---

> Objetivo: Habilitar bloqueos/unblock entre usuarios, impedir interacciones cuando exista bloqueo y exponer listados de bloqueados/bloqueadores en backend, webapp y mobile.

## 0. Preparación general

- Trabajar siempre desde la rama `gamification-social-diet`.
- Antes de empezar, ejecutar `git status` y confirmar que no hay cambios sin guardar.
- Todas las rutas de archivo son relativas a la raíz del repo.
- Mantener formato y estilo existentes (PEP8, ESLint, etc.).

## 1. Base de datos y bootstrap

1. Crear archivo `database/init/016_create_blocks.sql` con el contenido exacto:
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
2. Abrir `app/services/database.py` y, en el método `init_database`, añadir los `CREATE TABLE` análogos para `user_blocks` y `block_events` justo después de la sección de `user_follows`.
3. Si ya existe script de semillas (p. ej. `scripts/create_dummy_data.py`), insertar dos usuarios y una relación de bloqueo para verificar manualmente.

## 2. Modelos Pydantic

1. Crear `app/models/social/block.py` con:
   ```python
   class BlockAction(str, Enum): BLOCK = 'block'; UNBLOCK = 'unblock'

   class BlockActionRequest(BaseModel):
       action: BlockAction
       reason: Optional[str] = None

   class BlockActionResponse(BaseModel):
       ok: bool
       blocker_id: str
       blocked_id: str
       status: Literal['active','revoked']
       blocked_at: datetime

   class BlockListItem(BaseModel):
       user_id: str
       handle: str
       avatar_url: Optional[str]
       since: datetime
       reason: Optional[str]

   class BlockListResponse(BaseModel):
       items: List[BlockListItem]
       next_cursor: Optional[str]
   ```
2. Exportar en `app/models/social/__init__.py`.

## 3. Servicio de Bloqueos

1. Crear `app/services/social/block_service.py` con clase `BlockService` y métodos:
   - `async block_user(blocker_id: str, blocked_id: str, reason: Optional[str] = None) -> BlockActionResponse`
   - `async unblock_user(blocker_id: str, blocked_id: str) -> BlockActionResponse`
   - `async list_blocked(blocker_id: str, limit: int = 20, cursor: Optional[str] = None) -> BlockListResponse`
   - `async list_blockers(blocked_id: str, limit: int = 20, cursor: Optional[str] = None) -> BlockListResponse`
   - `async is_blocking(blocker_id: str, blocked_id: str) -> bool`
   (seguir el patrón de `follow_service` para implementar singletons y transacciones).
2. Reglas obligatorias en cada método (verificar con asserts/tests):
   - Bloquearse a uno mismo debe lanzar `HTTPException(status_code=400, detail="cannot block self")`.
   - Bloquear mismo usuario repetidamente retorna estado actual (sin duplicar fila).
   - Al bloquear, ejecutar DELETE sobre `user_follows` en ambos sentidos y decrementar contadores.
   - Refrescar timestamps `updated_at` y almacenar en `block_events`.
   - Crear payload `{"blocker_id": ..., "blocked_id": ..., "reason": ..., "ts": datetime.utcnow().isoformat()}` para `publish_event`.
   - Cursor: encodear `created_at` + `user_id` con base64; validar cursor inválido con `HTTPException(400)`.
3. Crear `tests/social/test_block_service.py` con los escenarios: bloqueo feliz, bloqueo idempotente, desbloqueo, eliminación de follow existente, cursor > limit, self-block 400.

## 4. ModerationGateway y FollowService

1. Actualizar `app/services/social/moderation_gateway.py`:
   - Importar `block_service`.
   - Implementar métodos:
     ```python
     def is_blocked(self, viewer_id: Optional[str], target_id: str) -> bool:
         if not viewer_id:
             return False
         return block_service.is_blocking(target_id, viewer_id) or block_service.is_blocking(viewer_id, target_id)
     ```
     y `get_block_relation(viewer_id, target_id)` devolviendo `'blocked'`, `'blocked_by'` o `None`.
2. Modificar `follow_service`:
   - En `follow_user`, llamar `moderation_gateway.is_blocked` y devolver `ok=False` con `status='blocked'` sin modificar contadores.
   - En `list_followers`/`list_following`, filtrar usuarios con bloqueo activo (opcional según pauta).
3. Ajustar `FollowActionResponse` para incluir `blocked: bool = False`.

## 5. Rutas FastAPI

1. Crear `app/routes/block.py`:
   - `POST /blocks/{target_id}` body `BlockActionRequest`.
   - `GET /profiles/{user_id}/blocked`
   - `GET /profiles/{user_id}/blockers`
2. Proteger con `Depends(get_current_user)` y flag `moderation_enabled`.
3. Registrar router en `main.py`.
4. Tests `tests/social/test_block_routes.py`:
   - Happy path block/unblock.
   - Soft-fail follow al bloquear.
   - Listados con cursor.
   - Rate limit opcional (dejar TODO si no definido).

## 6. Webapp (Express)

1. API utils (`webapp/utils/api.js`):
   - `blockUser(targetId, token?)`
   - `unblockUser(targetId, token?)`
   - `getBlockedUsers(userId, token?, options)` con `limit/cursor`.
2. Rutas:
   - En `webapp/routes/profiles.js`, manejar `POST /profiles/:id/block` y `GET /profiles/:id/blocked|blockers`.
   - Pasar datos `profile.block_relation` al render.
   - Reutilizar middleware `requireAuth` para proteger acciones.
3. Vistas:
   - Actualizar `webapp/views/profiles/show.ejs` para mostrar botón Block/Unblock (similar a follow).
   - Crear `webapp/views/profiles/blocked.ejs` y `blockers.ejs`.
4. JS cliente:
   - Extender `webapp/public/js/profile.js` con funciones `toggleBlock`.
5. Tests:
   - `webapp/tests/profiles.routes.test.js`: verificar llamadas a API block/unblock.
   - `webapp/tests/profiles.views.test.js`: verificar render de botón block/unblock y listados.
   - Añadir tests cliente si se usa lógica compleja.

## 7. Mobile (React Native)

1. Servicio API (`mobile/services/ApiService.ts`):
   - `blockUser(targetId)`, `unblockUser(targetId)`, `getBlockedUsers`.
2. Interfaz `Profile` (`mobile/types/profile.ts`): agregar `block_relation?: 'blocked' | 'blocked_by' | null`.
3. `ProfileScreen.tsx`:
   - Mostrar botón Block/Unblock para no-owners.
   - Deshabilitar follow si existe bloqueo.
   - Feedback con `Alert`/`Toast`.
   - Asegurar que `refreshProfile()` se llama tras bloquear/desbloquear.
4. Nuevas pantallas:
   - `BlockedListScreen.tsx`, `BlockedByScreen.tsx` (FlatList con paginación).
5. Tests:
   - Actualizar `ProfileScreen.test.tsx` (tap block/unblock, refreshProfile).
   - Crear `BlockedListScreen.test.tsx` con mocks.

## 8. Eventos y outbox

1. Definir constantes `UserAction.UserBlocked`, `UserAction.UserUnblocked`.
2. `event_publisher` debe insertar en `event_outbox`.
3. Tests: verificar filas creadas tras block/unblock.

## 9. Lints y documentación

1. Ejecutar y documentar: `npm --prefix webapp run lint`, `npm --prefix mobile run lint`.
2. Documentar endpoints en `docs/api/social.md` (añadir sección Bloqueos).
3. Crear guía manual en `manual-user-tests.md` con pasos de verificación (bloquear, intentar follow, desbloquear, etc.).

## 10. Validación final esperada

Comandos en entorno sin restricciones:
- `python -m pytest tests/social/test_block_routes.py`
- `python -m pytest tests/social/test_block_service.py`
- `NODE_ENV=test npm --prefix webapp run test:profiles`
- `npm --prefix mobile test -- BlockedList`

Checklist manual:
- Blocker elimina follow existente.
- Usuarios bloqueados ven mensaje apropiado.
- Paginación en listados funciona.
- Eventos aparecen en `event_outbox`.
