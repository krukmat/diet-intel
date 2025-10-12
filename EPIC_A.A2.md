# EPIC A · Historia A2 — Follow/Unfollow (Plan paso a paso)

> Objetivo: implementar follow/unfollow con reglas de negocio claras (sin duplicados, no self-follow, soft-fail si bloqueado, rate limit 200/día), contadores consistentes y eventos FollowCreated/Removed, siguiendo TDD/KISS.

## Estado actual (pendiente)
- **Backend**: ⚠️ `app/services/social/follow_service.py` contiene stubs; falta implementar lógica real y crear `tests/social/test_follow_routes.py` con casos TDD.
- **Webapp**: ⚠️ Botón Follow/Unfollow y `webapp/public/js/profile.js` necesitan ajustes (pasar `event`, enviar acción correcta, actualizar UI tras éxito) y agregar tests Jest.
- **Mobile**: ⚠️ `ProfileScreen` aún no usa `apiService.followUser/unfollowUser`; falta botón Follow/Unfollow y tests RN.
- **Validación**: ⚠️ pytest/Jest/RN aún no se han ejecutado para A2 (ver sección de Validación).

## 1. Backend (FastAPI)

1.1 DDL (tokens ~120)  
- Archivo: `database/init/015_create_follows.sql`.  
- Contenido exacto (copiar/pegar):
```sql
CREATE TABLE IF NOT EXISTS user_follows (
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','blocked')) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON user_follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id);

CREATE TABLE IF NOT EXISTS follow_activity_log (
  user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('follow')),
  date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, date)
);

CREATE TABLE IF NOT EXISTS event_outbox (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
- En `app/services/database.py:init_database`, incluir estos CREATE si se usa SQLite sin migraciones.

1.2 Modelos Pydantic (tokens ~80)  
- Archivo: `app/models/social/follow.py`.  
- Copiar/pegar:
```python
from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, Field

Status = Literal['active', 'blocked']
Action = Literal['follow', 'unfollow']


class FollowEdge(BaseModel):
    follower_id: str = Field(...)
    followee_id: str = Field(...)
    status: Status = Field('active')
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FollowActionRequest(BaseModel):
    action: Action


class FollowActionResponse(BaseModel):
    ok: bool
    follower_id: str
    followee_id: str
    status: Status
    followers_count: int
    following_count: int


class FollowListItem(BaseModel):
    user_id: str
    handle: str
    avatar_url: Optional[str] = None
    since: datetime


class FollowListResponse(BaseModel):
    items: List[FollowListItem]
    next_cursor: Optional[str] = None
```

1.3 Servicio FollowService (tokens ~220)  
- Archivo: `app/services/social/follow_service.py` (completar).  
- Reglas exactas:
  - Validaciones:  
    - self-follow → `HTTPException(400, "cannot follow self")`.  
    - ModerationGateway.is_blocked → return `FollowActionResponse(ok=False, ...)` sin tocar counters.  
    - Rate limit: insert/update `follow_activity_log`; si `count >= 200`, lanzar `HTTPException(429, "rate limit exceeded")`.
  - Idempotencia:  
    - follow: si `status='active'` → ok=True, counters intactos.  
    - unfollow: si fila no existe → ok=True.
  - Transacciones (usar `with db_service.get_connection()`):  
    - follow: UPSERT user_follows a `status='active'`, `updated_at=CURRENT_TIMESTAMP`.  
      ```sql
      INSERT INTO user_follows(follower_id, followee_id, status)
      VALUES(?, ?, 'active')
      ON CONFLICT(follower_id, followee_id)
      DO UPDATE SET status='active', updated_at=CURRENT_TIMESTAMP;
      ```
      Incrementar `profile_stats.followers_count` del followee y `following_count` del follower (nunca < 0).
    - unfollow: borrar fila (`DELETE FROM user_follows WHERE follower_id=? AND followee_id=?`) y decrementar counters (con `MAX(0, count-1)`).
  - Eventos:  
    - `publish_event('UserAction.FollowCreated', {...})` después del follow.  
    - `publish_event('UserAction.FollowRemoved', {...})` después del unfollow.
  - list_followers/list_following (cursor):  
    - SELECT con JOIN a users (para handle/avatar).  
    - Ordenar `(created_at DESC, follower_id ASC)` o similar.  
    - Cursor base64("created_at|user_id"); next_cursor si quedan más filas.  
  - is_following: `SELECT 1 FROM user_follows WHERE follower_id=? AND followee_id=? AND status='active'`.

1.4 Rutas (tokens ~140)  
- Archivo: `app/routes/follow.py`.  
- Asegurar endpoints:
  - `POST /follows/{target_id}` → body `FollowActionRequest`. Devuelve `FollowActionResponse`. Maneja 400/429.  
  - `GET /profiles/{user_id}/followers` → `FollowListResponse`.  
  - `GET /profiles/{user_id}/following` → `FollowListResponse`.  
- Registrar en `main.py` (ya hecho con skeleton).

1.5 Tests pytest (tokens ~220)  
- Archivo nuevo: `tests/social/test_follow_routes.py`.  
- Casos mínimos:
  1. follow feliz (nuevas filas, counters +1).  
  2. follow idempotente (segunda llamada no cambia counters).  
  3. self-follow → 400.  
  4. rate limit → 429 (201ª llamada en el día).  
  5. bloqueo: mock ModerationGateway.is_blocked → ok=False sin cambios.  
  6. unfollow feliz (counters -1).  
  7. unfollow idempotente (sin fila previa).  
  8. list_followers y list_following con paginación (cursor).  
- Reusar fixtures de tests A1 (usuarios/perfiles).

## 2. Webapp (Express)

2.1 API utils (tokens ~60)  
- `webapp/utils/api.js`: completar métodos `followUser(targetId, token?)` y `unfollowUser(targetId, token?)` (ya esqueleto). Manejar errores con `handleAPIError`.

2.2 UI (tokens ~140)  
- `webapp/views/profiles/show.ejs`:  
  - Botón Follow/Unfollow visible si `currentUser` y `!canEdit`.  
  - Mostrar texto correcto según relación (usar `profile.follow_relation` si backend la expone, o consulta AJAX inicial).  
  - Form/JS deben enviar `action=follow` o `unfollow`.
- `webapp/public/js/profile.js`:  
  - Fix crítico: actualmente guarda la nueva acción antes de enviar la petición y termina enviando la acción inversa. Guardar `const requestAction = actionInput.value;` antes de modificar la UI, usarlo en el fetch, y sólo actualizar UI si la respuesta OK.  
  - Recibir el evento real (firma `toggleFollow(event, targetUserId)` y pasar `event` desde el botón).  
  - Mostrar mensajes de error amigables (Alert o div).  
  - Opcional: mostrar estado inicial (Follow/Unfollow) al cargar (petición GET a follow status).
- `webapp/views/profiles/followers.ejs` y `following.ejs`: renderizar listas (`items`) y `next_cursor`.

2.3 Tests (tokens ~120)  
- `webapp/tests/profiles.routes.test.js`:  
  - Mock `dietIntelAPI.followUser/unfollowUser`.  
  - Verificar que `POST /profiles/:id/follow` con `action=follow`/`unfollow` llama a la API correcta y devuelve JSON esperado.  
- `webapp/tests/profiles.views.test.js`:  
  - Render del botón Follow/Unfollow (según estado).  
  - Mensaje de privacidad (“Follow to see posts”).  
- `webapp/tests/profiles.client.test.js` (opcional):  
  - Tests unitarios de `profile.js` (toggleFollow, updateCount, showFollowError).

## 3. Mobile (React Native)

3.1 ApiService (tokens ~40)  
- `mobile/services/ApiService.ts`: métodos `followUser(targetId)`, `unfollowUser(targetId)` (ya añadidos).  
- Verificar error handling (logs + rethrow).

3.2 UI ProfileScreen (tokens ~120)  
- `mobile/screens/ProfileScreen.tsx`:  
  - Botón Follow/Unfollow visible para no-owner (`!isOwner(profile.user_id)`).  
  - onPress → `apiService.followUser`/`unfollowUser`; usar try/catch con feedback (Alert/Toast).  
  - `refreshProfile()` tras acción exitosa.  
  - Opcional: estado “processing…” para evitar doble click.

3.3 Followers/Following screens (tokens ~60 opcionales)  
- Crear `FollowersScreen` y `FollowingScreen` con FlatList, carga incremental (limit/cursor).

3.4 Tests RN (tokens ~140)  
- `mobile/__tests__/ProfileScreen.test.tsx`:  
  - Mock context + ApiService; simular tap Follow → expect followUser + refreshProfile.  
  - Simular tap Unfollow → expect unfollowUser + refreshProfile.  
  - Verificar mensaje “Follow to see posts”.  
- `mobile/__tests__/FollowersScreen.test.tsx` (si se crea la pantalla):  
  - Render list, estados vacíos, “load more”.

## 4. Observabilidad y eventos
- `event_publisher.publish_event` ya inserta en outbox; validar que follow/unfollow lo llame con payload `{ follower_id, followee_id, ts }`.  
- Solución KISS: no reintentar; sólo log + outbox.  
- Verificar que `event_outbox` se cree una sola vez (migración ya lo cubre).

## 5. Seguridad y límites
- Autenticación obligatoria en `POST /follows/{target_id}` (ya via `requireAuth`).  
- Rate limit diario (200).  
- Soft-fail si bloqueado (ModerationGateway).  
- Self-follow prohibido (return 400).

## 6. Validación y cobertura
- Backend: `python -m pytest tests/social/test_follow_routes.py` (cobertura ≥ 90% en FollowService).  
- Webapp: `npm --prefix webapp run test:profiles` (+ `--coverage`).  
- Mobile: `npm --prefix mobile test -- ProfileScreen` (y `ProfileEditScreen`/Followers si aplica, + `--coverage`).

## 7. Checklist final (QA)
- [ ] follow/unfollow actualiza counters correctamente (manual).  
- [ ] Soft-fail bloqueado (manual).  
- [ ] Rate limit 429 (manual/test).  
- [ ] Botón Follow/Unfollow web/mobile con feedback.  
- [ ] Listados followers/following con paginación operativos.  
- [ ] Eventos FollowCreated/Removed registrados en `event_outbox`.  
- [ ] Lint (webapp eslint, RN si aplica).  
- [ ] Documentar resultados de validación (cobertura, comandos ejecutados).

---

## Registro de implementación A2 (avance y hallazgos)

- ✅ `database/init/015_create_follows.sql` creado e integrado en `app/services/database.py`.
- ✅ Modelos Pydantic en `app/models/social/follow.py` añadidos.
- ✅ `FollowService` implementado con validaciones (self-follow, rate limit 200/día, soft-fail bloqueos), contadores consistentes, outbox y paginación con cursor.
- ✅ Rutas de FastAPI (`app/routes/follow.py`) actualizadas para POST/GET con soporte de cursor y límite.
- ✅ Suite `tests/social/test_follow_routes.py` escrita y aprobada (`python -m pytest tests/social/test_follow_routes.py` → 9 tests OK; warnings por `model.dict()` en otros módulos pendientes de migrar a `model_dump`).
- ✅ Webapp: `webapp/utils/api.js`, `webapp/routes/profiles.js`, `webapp/views/profiles/show.ejs`, `webapp/public/js/profile.js` revisados según epic; pruebas agregadas en `webapp/tests/profiles.routes.test.js`, `webapp/tests/profiles.views.test.js`.
- ✅ Mobile: `mobile/services/ApiService.ts`, `mobile/types/profile.ts`, `mobile/screens/ProfileScreen.tsx` y `mobile/__tests__/ProfileScreen.test.tsx` actualizados con follow/unfollow y cobertura de tests.
- ❗️ Se añadió `jest-environment-jsdom` a `webapp/package.json` y se creó un stub local (`webapp/node_modules/jest-environment-jsdom/index.js`). El intento de `npm install` falló por bloqueo de red (registro npm inaccesible).

### Validación ejecutada
- `python -m pytest tests/social/test_follow_routes.py` ✅
- `npm --prefix webapp run test:profiles` ❌  
  - Se configuró `jest-environment-jsdom`, se ajustaron los asserts de URL, la visibilidad de `follow-feedback` y los timers en `tests/profiles.follow.test.js`.  
  - Aun así, la suite falla porque Supertest no puede abrir un socket (`listen EPERM: operation not permitted 0.0.0.0`) en este entorno. El guard en `app.js` usa `require.main === module`, pero Supertest necesita levantar un server real y el sandbox bloquea el bind del puerto.
- `npm --prefix mobile test -- ProfileScreen` ✅

### Próximos pasos sugeridos
1. ✅ `jest-environment-jsdom` añadido al `package.json` (instalación pendiente por bloqueo de red); `webapp/tests/profiles.follow.test.js` usa `@jest-environment jsdom` y se creó un stub local del paquete.
2. ✅ Asserts de URL actualizados con `new URL(requestUrl).pathname`.
3. ✅ Bloque `catch` confirmado con feedback visible; tests alineados.
4. ✅ Test del toast usa timers falsos sin `done`.
5. ✅ `npm --prefix mobile test -- ProfileScreen` ejecutado; `NODE_ENV=test npm --prefix webapp run test:profiles` sigue fallando porque Supertest no puede abrir un socket (`listen EPERM`), limitación del entorno.
