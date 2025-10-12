# EPIC A – Profiles & Social Graph

## Estado
- A1 (View Profile): COMPLETADO ✅ (backend, webapp, mobile listos; validación local recomendada).
- Próximo: A2 (Follow/Unfollow).

## Estado de Tests y Cobertura (Webapp/Mobile)

### Webapp (Express)
- Suites disponibles: `webapp/tests/profiles.api.test.js`, `webapp/tests/profiles.routes.test.js`, `webapp/tests/profiles.views.test.js`, helper `tests/helpers/mountApp.js`.
- Ejecución local:
  - `npm --prefix webapp i`
  - `npm --prefix webapp run test:profiles`
  - (Cobertura) `npm --prefix webapp test -- --coverage`
- Cobertura esperada (objetivo):
  - `utils/api.js` ≥ 90%; rutas de profiles 70–85%; vistas validadas por contenido clave (no medibles como JS).
- Incidencias conocidas/resueltas:
  - Enlace CSS movido a `views/layout.ejs` (resuelto).
  - Validación 422 en `POST /profiles/me` con re-render y mensaje (resuelto).
  - identity-obj-proxy agregado para mapper de CSS en Jest (resuelto).
- Riesgos de entorno:
  - Si Jest reporta problemas con EJS o mappers, ajustar `moduleNameMapper` o desactivar cobertura sobre `views/**`.

### Mobile (React Native)
- Suites disponibles: `mobile/__tests__/ProfileScreen.test.tsx`, `mobile/__tests__/ProfileEditScreen.test.tsx`.
- Ejecución local:
  - `npm --prefix mobile test -- ProfileScreen`
  - `npm --prefix mobile test -- ProfileEditScreen`
  - (Cobertura) `npm --prefix mobile test -- --coverage`
- Cobertura esperada (objetivo):
  - Módulo perfiles (ProfileScreen + ProfileEditScreen + Context/Types) ≥ 90%.
- Incidencias conocidas/resueltas:
  - Textos UI alineados: "Loading...", "No profile data", testID `avatar-placeholder`, `posts_notice` (resuelto).
  - EditScreen: validaciones (handle/bio) y flujo de guardado con refreshProfile (resuelto).
- Riesgos de entorno:
  - Si aparece error de RN Animated, mock: `jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper')` en setup.

## 1. Contexto y alcance
- **Historias cubiertas**: A1 _View Profile_, A2 _Follow/Unfollow_ según `specs/dietintel_social_gamification_spec_v1.json`.
- **Objetivo**: habilitar perfiles sociales con privacidad básica y relaciones de seguimiento, preparando la base para el feed social y la gamificación.
- **Superficie afectada**: FastAPI (`app/`), base de datos SQLite/PostgreSQL, Express webapp (`webapp/`), app móvil React Native (`mobile/`), documentación y pruebas automatizadas.

## 2. Requerimientos funcionales y técnicos confirmados
- **Perfil**: debe mostrar `avatar`, `bio`, `handle`, visibilidad (`public` | `followers_only`), estadísticas (total de posts, puntos, nivel, cantidad de insignias, seguidores, seguidos) y últimas 10 publicaciones visibles (heredan visibilidad del perfil).
- **Privacidad**: cuando el perfil es `followers_only`, usuarios no seguidores deben ver mensaje “Follow to see posts” y las publicaciones deben ocultarse; el propietario siempre ve sus posts aun si la relación de follow no está establecida.
- **Seguimiento**: `POST /follows/:target_id` crea relación A→B, actualiza contadores y dispara notificación a B; desfollows revierte proceso. Reglas: sin duplicados, no permite seguirse a sí mismo, “soft-fail” si existe bloqueo.
- **Rate limits**: máximo 200 follows por día por usuario (según `abuse_safety.caps.follows_day`).
- **Eventos**: registrar `UserAction.FollowCreated` (ya especificado) y definir `UserAction.FollowRemoved` para telemetría.
- **Feature flags**: todo el epic queda condicionado a `social.enabled` (y subflags específicas si aplica en el futuro).

## 3. Supuestos y dependencias
- **Posts & feed (EPIC B)**: no existe aún persistencia de posts; expondremos interfaz `PostReadService` con implementación temporal que devuelve lista vacía hasta que el equipo de UGC la complete.
- **Gamificación (EPIC D/E)**: `points_total`, `level`, `badges_count` provendrán de futuros servicios; devolveremos cero/placeholder y dejaremos hooks claros.
- **Bloqueos (EPIC I)**: el check de “soft-fail si bloqueado” consultará un stub `ModerationGateway`. Documentar dependencia para validarla en el primer corte de integración.
- **Notificaciones (EPIC C)**: emitiremos evento dominio `FollowCreated`/`FollowRemoved` y escribiremos a cola interna (`app/services/events.py` placeholder) hasta que el motor de notificaciones esté disponible.
- **Autenticación web/mobile**: ambos clientes reutilizan `/auth/me` con el JWT actual para obtener `user.id` y operar contra `/profiles/me`; los métodos se documentan en cada plan de capa.

## 4. Plan de implementación

### 4.1 Historia A1: View Profile

#### Backend (FastAPI)
1. **Migraciones**  
   - Añadir script `database/init/014_create_social_tables.sql` (número siguiente libre) creando tablas:
     - `user_profiles` (`user_id` PK/ FK a `users.id`, `handle` UNIQUE, `bio` TEXT, `visibility` TEXT CHECK in (`public`,`followers_only`), timestamps).
     - `profile_stats` (`user_id` PK, `followers_count` INT DEFAULT 0, `following_count` INT DEFAULT 0, `posts_count` INT DEFAULT 0, `points_total` INT DEFAULT 0, `level` INT DEFAULT 0, `badges_count` INT DEFAULT 0, timestamps).
   - Refrescar `app/services/database.py` para crear tablas cuando se inicialice SQLite (mantener en sync con SQL).
   - Añadir índices `idx_user_profiles_handle` y `idx_profile_stats_followers`.
2. **Modelos Pydantic**  
   - Crear `app/models/social/profile.py` con `ProfileVisibility` (Enum), `ProfileStats`, `ProfileSummary`, `ProfileDetail` (incluye `posts: list[PostSummary]`).
   - Crear `app/models/social/post_preview.py` (campos: `post_id`, `text`, `media`, `created_at`, `counters`) para reutilizar cuando llegue EPIC B.
3. **Servicios**  
   - Stubs iniciales:
     - `app/services/social/post_read_service.py` con método `list_recent_posts(...)` que retorna `[]` y loguea warning.
     - `app/services/social/gamification_gateway.py` que devuelve contadores `{points_total: 0, level: 0, badges_count: 0}` mientras no exista integración real.
     - `app/services/social/follow_gateway.py` con método `is_following(follower_id, followee_id)` retornando `False` y `TODO` para A2.
   - `app/services/social/profile_service.py` debe inyectar los stubs anteriores y exponer:
     - `ensure_profile_initialized(user_id)`.
     - `get_profile(user_id, viewer_id)` determinando visibilidad con prioridad para `viewer_id == user_id` y usando `follow_gateway` cuando haya autenticación.
     - `update_profile(user_id, payload)` validando unicidad de handle y límite de bio (280 chars).
4. **Controladores**  
   - Nuevo router `app/routes/profile.py` exponiendo:
     - `GET /profiles/me`: requiere auth y delega en `profile_service.get_profile(current_user.id, current_user.id)` para garantizar visibilidad del propietario.
     - `GET /profiles/{user_id}`: usa dependencia opcional `get_current_user_optional`, calcula `viewer_id` cuando hay usuario autenticado y aplica la lógica de privacidad/notice.
     - `PATCH /profiles/me`: requiere auth, valida payload (`bio`, `handle`, `visibility`, `avatar_url`) y devuelve perfil actualizado.
     - `GET /profiles/{user_id}/followers` & `/following`: respuestas stub vacías con `TODO` para A2 (mantener shape de paginación).
   - Añadir guardas de feature flag leyendo de `config.feature_flags.social_enabled` (ver tarea 4.3.1).
   - Registrar router en `main.py` con tag `["profiles"]`.
5. **Lógica de privacidad y métricas**  
   - En `get_profile` determinar banderas `viewer_is_owner = viewer_id == user_id` y `viewer_is_follower = follow_gateway.is_following(...)`. Si `visibility == followers_only` y ninguna de las banderas es verdadera, reemplazar `posts` por `[]` y devolver `{"message": "Follow to see posts"}` en campo `posts_notice`.
   - El servicio debe actualizar `profile_stats.posts_count` cuando se reciba actualización desde EPIC B (dejar método `update_posts_count(user_id, total)` para ser invocado posteriormente).
6. **Pruebas backend**  
   - Nuevos tests en `tests/social/test_profile_routes.py` cubriendo:
     - Creación automática de perfiles.
     - Respuesta de perfil público vs privado (anónimo vs propietario).
     - Validación de handle único y formato (`[a-z0-9_]{3,30}`).
     - Serialización de placeholders de gamificación.
   - Añadir fixtures en `tests/fixtures/social.py` con utilidades para crear usuarios/perfiles.

#### Webapp (Express)
1. **Cliente API**  
   - Extender `webapp/utils/api.js` con métodos `getCurrentUser(authToken)`, `getProfile(userId, authToken?)`, `updateProfile(data, authToken?)`, `listFollowers`, `listFollowing`, reusando el JWT almacenado en cookies (`access_token`) para la cabecera `Authorization`.
2. **Rutas y controladores**  
   - Crear `webapp/routes/profiles.js`:
     - Registrar primero rutas estáticas (`/me`, `/me/edit`) antes de `/:userId`.
     - `GET /profiles/me/edit` (middleware `requireAuth`): obtiene `currentUser` desde `res.locals`, lee token de cookies, llama a `dietIntelAPI.getProfile(currentUser.id, token)` y renderiza vista de edición.
     - `POST /profiles/me` (middleware `requireAuth`): valida payload, usa token para `dietIntelAPI.updateProfile`, redirige a `/profiles/${currentUser.id}`.
     - `GET /profiles/:userId` (middleware `checkAuth`): pasa token si existe, renderiza perfil con mensaje de privacidad cuando corresponda.
   - Registrar router en `webapp/app.js` (`app.use('/profiles', profilesRouter);`).
3. **Vistas**  
   - Nueva plantilla `webapp/views/profiles/show.ejs` mostrando datos + lista de posts (placeholder) + botón follow/unfollow (controlado vía datos inyectados).
   - Añadir vista `webapp/views/profiles/edit.ejs` para ajustes propios.
4. **Estado/estilos**  
   - Actualizar CSS global (`webapp/public/stylesheets/main.css` si existe; de lo contrario crear) para layout de tarjetas de perfil.
5. **Pruebas web**  
   - Agregar tests Jest en `webapp/tests/profiles.test.js` (mock API) verificando render de perfil público/privado, mensaje “Follow to see posts” para visitantes y que `/profiles/me/edit` usa `res.locals.currentUser.id`.
   - Actualizar Playwright `webapp/tests/e2e` con un flujo: ver perfil público, cambiar visibilidad, confirmar mensaje para usuario visitante.

#### Mobile (React Native)
1. **Cliente API**  
   - Extender `mobile/services/ApiService.ts` agregando `getCurrentUser()` (GET `/auth/me` con token adjunto), `getProfile`, `updateProfile`, `getFollowers`, `getFollowing`.
2. **Contexto de estado**  
   - Crear `mobile/contexts/ProfileContext.tsx` para cachear perfil propio; `refreshProfile` debe llamar primero `ApiService.getCurrentUser()` para obtener `user.id` y luego `getProfile`.
3. **Pantallas**  
   - Nueva pantalla `mobile/screens/ProfileScreen.tsx` mostrando info y posts (placeholder).  
   - Añadir `FollowersListScreen` y `FollowingListScreen` reutilizando `FlatList`.
4. **Integración navegación**  
   - Registrar pantallas en `mobile/navigation` (ver estructura existente; si usa React Navigation, actualizar stack o tab).
5. **Tests**  
   - Añadir pruebas en `mobile/__tests__/ProfileScreen.test.tsx` usando mocks de API; verificar mensaje de privacidad y que `ApiService.getCurrentUser` se invoque antes de `getProfile`.

#### QA & Observabilidad
1. Instrumentar métricas en FastAPI usando `app/services/performance_monitor.py` (si ya existe) para medir latencia `profile_view_duration`.
2. Registrar evento analítico `ProfileViewed` en stub `app/services/social/analytics.py` (enviando a logger).
3. Documentar pasos manuales en `manual-user-tests.md` para revisar perfiles privados/públicos.

### 4.2 Historia A2: Follow/Unfollow

#### Backend (FastAPI)
1. **Persistencia**  
   - Extender migración `014_create_social_tables.sql` agregando tabla `user_follows`:
     - Columnas: `follower_id`, `followee_id`, `status` (`active|blocked`), `created_at`, `updated_at`.
     - Clave primaria compuesta (`follower_id`, `followee_id`), índice `idx_user_follows_followee`.
   - Añadir tabla `follow_activity_log` para rate-limit (`user_id`, `action`, `date`, `count`).
2. **Modelos**  
   - Crear `app/models/social/follow.py` con `FollowEdge`, `FollowActionResponse`, `FollowListItem`.
3. **Servicios**  
   - Nuevo `app/services/social/follow_service.py` con métodos:
     - `follow_user(follower_id, followee_id)` (valida autoseguimiento, duplicados, bloqueos, rate limit; actualiza `profile_stats` contadores; emite evento).
     - `unfollow_user(follower_id, followee_id)` (marca como removido, decrementa contadores, emite evento).
     - `list_followers(user_id, limit, cursor)` y `list_following(...)`.
     - `is_following(follower_id, followee_id)` usado por `profile_service`.
   - Implementar rate limiting simple: al inicio de `follow_user`, incrementar contador diario en `follow_activity_log`; lanzar `HTTPException status 429` si excede 200.
   - Integrar con `ModerationGateway.is_blocked(follower_id, followee_id)` (stub devuelve False, TODO para EPIC I).
4. **Eventos y notificaciones**  
   - Crear util `app/services/social/event_publisher.py` con `publish_follow_event(event_name, payload)` escribiendo en logger y guardando en tabla `event_outbox` (si no existe crear) para futura integración.
   - Añadir esquema `UserAction.FollowRemoved` en `specs` actualización pendiente → registrar tarea en docs (ver sección 5).
5. **Endpoints**  
   - Añadir a `app/routes/profile.py` endpoint `POST /follows/{target_id}`:
     - Body `{"action": "follow" | "unfollow"}` (hasta redefinir API).  
     - Retorna `FollowActionResponse` con nuevos contadores.
   - Considerar alias `DELETE /follows/{target_id}` como mejora futura → dejar `TODO` documentado.
6. **Pruebas backend**  
   - Crear `tests/social/test_follow_routes.py` cubriendo: follow feliz, duplicado idempotente, autoseguimiento (400), límite diario (429), privado + follow habilitado, decremento contadores.

#### Webapp (Express)
1. **API utils**  
   - Añadir `followUser(targetId)` y `unfollowUser(targetId)` en `webapp/utils/api.js`.
2. **UI**  
   - En `webapp/views/profiles/show.ejs`, renderizar botón follow/unfollow (POST AJAX).  
   - Crear script cliente en `webapp/public/js/profileFollow.js` que haga fetch al backend y actualice contadores en DOM.
3. **Rutas**  
   - En `webapp/routes/profiles.js`, exponer `POST /profiles/:userId/follow` que llame a API y maneje errores (rate limit).
4. **Pruebas**  
   - Tests Jest para follow handler (mock axios).  
   - Playwright: flujo seguir/deseguir, validar mensajes de error cuando se supera límite.

#### Mobile (React Native)
1. **UI/UX**  
   - Añadir botón follow en `ProfileScreen` con estado local; mostrar alertas en caso de rate limit (usar `Toast`/`Alert`).
   - Añadir `pull-to-refresh` para recargar contadores.
2. **Servicios**  
   - Métodos `followUser`/`unfollowUser` en `ApiService`.
3. **Tests**  
   - Caso en `mobile/__tests__/ProfileScreen.test.tsx` con simulación de follow/unfollow y validación de estados de botón.

#### QA & Observabilidad
1. **Alertas**: configurar en `app/services/performance_monitor.py` contador `follow_requests_total` + `follow_rate_limit_hits`.
2. **Manual**: actualizar `manual-user-tests.md` con caso de límite diario y flujo de bloqueo (marcar como pendiente hasta EPIC I).

### 4.3 Cross-cutting
1. **Feature flags**  
   - Añadir a `app/config.py` sección `feature_flags` con `social_enabled: bool = True` (por defecto) y exponer helper `is_feature_enabled('social')`.
   - Crear `FeatureFlagMiddleware` ligero en `app/utils/feature_flags.py` (si `False`, endpoints devuelven 404).
2. **Seeds de datos**  
   - Actualizar `create_dummy_data.py` para generar perfiles demo y relaciones básicas.
3. **Documentación**  
   - Añadir sección “Social Graph” en `docs/architecture.md` (o crear si no existe) describiendo tablas y flujos de eventos.
   - Documentar endpoints en `docs/api/social.md`.
4. **Actualización de specs**  
   - Registrar `UserAction.FollowRemoved` en `specs/dietintel_social_gamification_spec_v1.json` (abrir issue para sincronizar con producto).

## 5. Plan de pruebas y verificación
- Backend: `python -m pytest tests/social` (nuevo paquete) + suites existentes.
- Webapp: `npm --prefix webapp run test` y `npm --prefix webapp run test:e2e`.
- Mobile: `npm --prefix mobile test -- ProfileScreen` y pruebas manuales en emulador.
- Cobertura: revisar `htmlcov/index.html` para asegurar nuevas rutas tienen cobertura mínima.
- Validación manual guiada (público/privado, follow/unfollow, rate limit).

## 6. Riesgos y mitigaciones
- **Integración con epics futuros**: Stubs claros y TODOs para B, C, D, I; planificar refactor cuando dichos módulos estén listos.
- **Consistencia de contadores**: emplear transacciones al actualizar `profile_stats`; agregar tarea futura para job de reconciliación nocturna.
- **Escalabilidad**: índices en tablas `user_follows` y `profile_stats`; considerar mover a PostgreSQL cuando se active `DatabaseService` con SQLAlchemy (fuera de alcance aquí).
- **Experiencia usuario**: asegúrese que mensajes de error (rate limit, bloqueos) estén traducidos (`locales/`) y cubiertos por QA.
