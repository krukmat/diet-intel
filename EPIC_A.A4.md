# EPIC A · Historia A4 — Feed Público de Actividad Social

> Objetivo: construir un feed cronológico (back-to-front) que muestre eventos recientes de la red social (nuevos follows, publicaciones públicas stub, bloqueos relevantes) consumido por webapp y mobile. Requiere instrumentar un pipeline simple (Outbox → tabla feed), exponer API paginada y renderizar UI básica.

---

## 1. Preparación general
1. Trabajar sobre la rama `gamification-social-diet`. Crear branch de trabajo (`feature/a4-feed`) si se desea.
2. Confirmar árbol limpio con `git status`.
3. Mantener patrones y estilo existentes: Python (PEP 8), JS/TS (ESLint default, Prettier).
4. Todo paso siguiente se asume desde la raíz del repo.
5. Tokens estimados totales: **~6.0k tokens** (desglose por sección incluido más abajo).

---

## 2. Persistencia de eventos social → feed (tokens estimados ~800)
1. Crear migración `database/init/017_create_social_feed.sql` con:
   ```sql
   CREATE TABLE IF NOT EXISTS social_feed (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     actor_id TEXT NOT NULL,
     event_name TEXT NOT NULL,
     payload TEXT NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   CREATE INDEX IF NOT EXISTS idx_feed_user_created_at ON social_feed(user_id, created_at DESC);
   ```
2. Añadir el bloque correspondiente en `app/services/database.py:init_database` (siguiendo patrón actual).
3. Opcional: script de seed (`scripts/create_dummy_data.py`) inserte 2-3 eventos en `social_feed` para pruebas manuales.

---

## 3. Feed ingester (tokens estimados ~1200)
1. Crear módulo `app/services/social/feed_ingester.py` responsable de mover eventos de `event_outbox` a `social_feed`.
   - Función `ingest_pending_events(batch_size: int = 100)`:
     1. Obtener eventos de `event_outbox` con `name` en {`UserAction.UserFollowed`, `UserAction.UserUnfollowed`, `UserAction.UserBlocked`, `UserAction.UserUnblocked`}.
     2. Mapear cada evento a filas `social_feed` (ej.: follow → user_id=followee_id, actor_id=follower_id, payload JSON con follower handle, etc.).
     3. Insertar en `social_feed` usando `uuid4()` como `id`.
     4. Marcar evento como procesado (opción simple: eliminar de `event_outbox`).
     5. Manejar transacciones; registrar errores y continuar con siguiente evento.
2. Crear test `tests/social/test_feed_ingester.py` validando:
   - Ingesta de follow/unfollow produce filas correctas.
   - Payload contiene campos esperados (`actor_id`, `target_id`, `action` ...).
   - Los eventos se eliminan de `event_outbox`.
3. Añadir utilidad CLI: `scripts/run_feed_ingester.py` que invoque `ingest_pending_events()` (para cron/manual runs).

---

## 4. API Backend (FastAPI) para feed (tokens estimados ~900)
1. Crear modelos `app/models/social/feed.py` con:
   ```python
   class FeedItem(BaseModel):
       id: str
       user_id: str
       actor_id: str
       event_name: str
       payload: Dict[str, Any]
       created_at: datetime

   class FeedResponse(BaseModel):
       items: List[FeedItem]
       next_cursor: Optional[str] = None
   ```
2. Servicio `app/services/social/feed_service.py`:
   - Método `list_feed(user_id: str, limit: int = 20, cursor: Optional[str] = None)`
     - Cursor base64(`created_at|id`).
     - Orden por `created_at DESC, id DESC`.
     - Limit `limit+1` para detectar siguiente cursor.
     - Retornar `FeedResponse`.
3. Ruta `app/routes/feed.py`:
   - Endpoint `GET /feed` (feed principal del usuario autenticado).
     - Depende de `get_current_user`.
     - Parámetros `limit`, `cursor`.
     - Devuelve `FeedResponse`.
   - Registrar en `main.py` con tag `['feed']`.
4. Tests `tests/social/test_feed_routes.py`:
   - Mock `feed_service.list_feed`; validar paginación/respuesta.
   - Caso autenticación: 401 si no hay token.

---

## 5. Webapp (Express) UI (tokens estimados ~1500)
1. API client `webapp/utils/api.js`:
   - Métodos: `getFeed(limit=20, cursor)` que llame a `/feed` con bearer token.
2. Ruta `webapp/routes/feed.js`:
   - GET `/feed` → requiere auth (reuse middleware `requireAuth`).
   - Obtiene `dietIntelAPI.getFeed` y renderiza vista.
3. Vista `webapp/views/feed/index.ejs`:
   - Listar `items` mostrando actor handle, acción (seguir/bloqueo) y tiempo relativo (usar `new Date(...).toLocaleString()` simple).
   - Botón “Load more” si `next_cursor` existe (enviar querystring `?cursor=`).
   - Mostrar mensaje “No activity yet” si vacío.
4. Añadir `webapp/public/js/feed.js` (opcional) para mejorar UX (AJAX “Load more”).
5. Tests Jest:
   - `webapp/tests/feed.routes.test.js`: mock API y validar render.
   - `webapp/tests/feed.views.test.js`: snapshot simple de la vista con datos.

---

## 6. Mobile (React Native) UI (tokens estimados ~1400)
1. API service `mobile/services/ApiService.ts`:
   - Método `getFeed(limit?: number, cursor?: string)`.
2. Context o hook (según estructura actual):
   - Crear `mobile/hooks/useFeed.ts` que gestione paginación (`items`, `loading`, `loadMore`).
3. Pantalla `mobile/screens/FeedScreen.tsx`:
   - FlatList con `FeedItem` simple: actor avatar inicial (placeholder), texto descriptivo, fecha relativa.
   - Botón/trigger `onEndReached` que usa `getFeed` con `next_cursor`.
   - Estados: loading inicial, empty state, error.
4. Tests RN:
   - `mobile/__tests__/FeedScreen.test.tsx` con mocks de API; validar render de elementos, loadMore y empty state.
5. Actualizar `AppNavigator` / `App.tsx` para incluir la pantalla en la tab o menú (según UX actual).

---

## 7. Instrumentación y documentación (tokens estimados ~400)
1. Añadir contador simple en feed ingester (`logging.info('ingested_%s', event_name)`).
2. Actualizar `docs/api/social.md` con sección “Feed” (endpoint, parámetros, ejemplo de respuesta).
3. Añadir pasos manuales en `manual-user-tests.md`: crear follow→ingest→ver feed web/mobile.

---

## 8. Validación final esperada
1. Ejecutar suites clave:
   ```bash
   python -m pytest tests/social/test_feed_ingester.py
   python -m pytest tests/social/test_feed_routes.py
   NODE_ENV=test npm --prefix webapp run test:profiles feed
   npm --prefix mobile test -- FeedScreen
   ```
2. Lint:
   ```bash
   npm --prefix webapp run lint
   npm --prefix mobile run lint
   ```
3. Documentar resultados en `PENDING_FINAL.md` y actualizar `EPIC_A.md` estado A4.

---

## 9. Estimación de tokens por sección
- Persistencia: ~300 tokens (SQL) + 200 tokens en `database.py` + 300 tokens script → **~800**.
- Feed ingester: `feed_ingester.py` (~500), tests (~400), script (~100) → **~1200**.
- API backend: modelos (~200), servicio (~400), rutas (~200), tests (~100) → **~900**.
- Webapp: API client (~150), rutas (~200), vista (~700), tests (~300), JS (~150) → **~1500**.
- Mobile: API service (~100), hook (~200), screen (~700), tests (~300), navegación (~100) → **~1400**.
- Docs/Instrumentación: ~400 tokens.
- **Total estimado**: 800 + 1200 + 900 + 1500 + 1400 + 400 ≈ **6,200 tokens**.

---

## 10. Checklist de entrega
- [ ] Migración y datos base (`social_feed`).
- [ ] Feed ingester funcional + tests.
- [ ] API `/feed` con paginación y tests.
- [ ] Vista web `/feed` + pruebas.
- [ ] Pantalla móvil Feed + tests.
- [ ] Documentación actualizada.
- [ ] Comandos de validación ejecutados y registrados.

