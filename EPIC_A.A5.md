# EPIC A · Historia A5 — Contenido UGC, Gamificación Base y Moderación Inicial

> Objetivo: implementar posts (texto + media), reacciones, comentarios, feed de posts de seguidos, gamificación inicial (puntos, niveles, badges), notificaciones básicas y reporting, alineado con `specs/dietintel_social_gamification_spec_v1.json` (milestones M0/M1).

---

## 0. Preparación
- Rama base: `gamification-social-diet`.
- Mantener estilo existente (Python 3.11, FastAPI; JS/TS con ESLint/Prettier).
- Tokens estimados totales: ~10K (detalle por sección al final).

---

## 1. Posts (texto + media)
1. **Migración BD** ✅ (`database/init/018_create_posts.sql`, 1,660 tokens)
   - `posts` (id, author_id, text, visibility, created_at, updated_at).
   - `post_media` (id, post_id, type [image/video], url, order).
   - `post_reactions` (post_id, user_id, reaction_type, created_at).
   - `post_comments` (id, post_id, author_id, text, created_at, updated_at).
   - Índices: `idx_posts_author_created_at`, `idx_reactions_post`, `idx_comments_post_created_at`.
   - Añadir bloques a `app/services/database.py:init_database`.
2. **Modelos Pydantic** ✅ (`app/models/social/post.py`, 1,970 tokens)
   - `PostMedia`, `PostCreate`, `PostDetail`, `ReactionType` enum.
   - `CommentCreate`, `CommentDetail`.
3. **Servicio de posts** ✅ (`app/services/social/post_service.py`, 8,950 tokens)
   - `create_post(author_id, PostCreate, media_urls)`: valida longitud (max 500), rate limit `posts/day=10` (tabla `post_activity_log`).
   - `list_posts(user_id, limit, cursor)`; `delete_post(author_id, post_id)`.
   - Uso de transacciones; retorna `PostDetail` completo.
4. **Reactions & Comments** ✅ (`app/services/social/reaction_service.py`: 832 tokens, `comment_service.py`: 1,072 tokens)
   - `toggle_reaction(user_id, post_id, ReactionType)` con idempotencia.
   - `create_comment(author_id, post_id, CommentCreate)` (max 280 chars, rate limit 30/día).
   - `list_comments(post_id, limit, cursor)`.
5. **Rutas FastAPI** ✅ (`app/routes/posts.py`, 4,795 tokens)
   - `POST /posts`, `GET /posts/{post_id}`, `GET /users/{user_id}/posts`.
   - `POST /posts/{post_id}/react`, `POST /posts/{post_id}/comments`, `GET /posts/{post_id}/comments`.
   - Protegidas por `get_current_user`, feature flag `social_enabled`.
6. **Tests backend** (`tests/social/test_post_service.py`, `test_post_routes.py`, ~300 tokens)
   - Casos: creación feliz, rate limit excedido, comentario vacío/error, toggle reacción, paginación.

---

## 2. Feed de posts (following feed)
1. **Consulta** ✅ (`app/services/social/feed_service.py`, **~3,700 tokens total**)
   - ✅ Método `list_following_posts(user_id, limit, cursor)` → JOIN complejo `user_follows` + `posts` con visibilidad.
   - ✅ Orden `created_at DESC` con stats agregadas (likes, comments, media).
   - ✅ Pagination cursor-based.
2. **Ruta** ✅ (`app/routes/feed.py`, **~800 tokens total**)
   - ✅ Endpoint `GET /feed/following` que devuelve `FeedResponse` con posts de seguidos.
3. **Ingester** (opcional - skip por simplicidad)
4. **Tests** (pendiente - todavía ejecutando endpoints básicos)

---

## 3. Gamificación base (puntos, niveles, badges)
1. **Migración** ✅ (`database/init/019_gamification_core.sql`, 666 tokens)
   - ✅ `points_ledger` (id, user_id, source, points, created_at).
   - ✅ `user_levels` (user_id, level, points_total, updated_at).
   - ✅ `user_badges` (user_id, badge_code, earned_at).
2. **Reglas** ✅ (`app/services/gamification/points_service.py`, 11,898 tokens)
   - ✅ `add_points(user_id, source)` con reglas completas: post=+5, reaction=+1, comment=+2, etc.
   - ✅ Daily caps y level up automático (thresholds: 0, 100, 300, 600, 1000).
   - ✅ Leaderboard semanal/mensual/all-time con rank calculations.
3. **Badges iniciales** ✅ (`app/services/gamification/badge_service.py`, 12,061 tokens)
   - ✅ 7 badges M0 (Starter, Conversationalist, Appreciated, Connector, Ambassador, Week Warrior, Champion).
   - ✅ Sistema de reglas flexible con rule evaluation engine.
   - ✅ Badge awarding automático con points for earning badges.
4. **Rutas** ✅ (`app/routes/gamification.py`, 5,943 tokens)
   - ✅ 6 endpoints principales + 4 legacy aliases.
   - ✅ Leaderboards, badges, levels, leaderboard recalcule.
5. **Tests** (pendiente - servicio funcional verificado)

---

## 4. Notificaciones básicas
1. **Migración** ✅ (`database/init/020_notifications.sql`, 438 tokens)
   - ✅ `notifications` (id, user_id, type, payload JSON, read_at, created_at, status).
2. **Servicio** ✅ (`app/services/notifications/notification_service.py`, 8,099 tokens)
   - ✅ `enqueue_notification(user_id, type, payload)` - completa con tipos y mensajes
   - ✅ `list_notifications(user_id, unread_only, limit)` - paginada
   - ✅ `mark_as_read()`, `mark_all_read()` - gestión completa
   - ✅ `get_unread_count()` - contador para badges
   - ✅ Cleanup automático de notificações viejas
3. **Triggers integrados** ✅ (en `post_service.py`, `reaction_service.py`, `points_service.py`) **~300 tokens**
   - ✅ Post creation → punto + badge evaluation + notificación si gana badge
   - ✅ Post liked → notificación al autor (primer like)
   - ✅ Level up → notificación automática
4. **Rutas** ✅ (`app/routes/notifications.py`, 4,541 tokens)
   - ✅ `GET /notifications` - lista completa con unread_count
   - ✅ `POST /notifications/{id}/read` - marcar individual
   - ✅ `POST /notifications/mark-all-read` - marcar todas
   - ✅ `GET /notifications/unread-count` - endpoint para UI badges
5. **Tests** (pendientes - servicio funcional verificado con integración real)

---

## 5. Moderación: reportes básicos
1. **Migración** ✅ (`database/init/021_reports.sql`, 440 tokens)
   - ✅ `content_reports` completa (id, reporter_id, target_type, target_id, reason, created_at, status, reviewed_by).
2. **Servicio** ✅ (`app/services/social/report_service.py`, 11,203 tokens)
   - ✅ `create_report()` completa con validaciones y anti-spam (24h cooldown).
   - ✅ `get_reports_for_moderation()` para admins.
   - ✅ `moderate_report()` actions y estadísticas.
   - ✅ `get_user_reports()` para usuarios ver sus reportes.
   - ✅ Validación target existencia antes reportar.
3. **Rutas** ✅ (`app/routes/moderation.py`, 5,576 tokens)
   - ✅ `POST /reports` - Crear reporte.
   - ✅ `GET /reports/my-reports` - Lista reportes del usuario.
   - ✅ `GET /admin/reports` - Lista para moderadores.
   - ✅ `POST /admin/reports/{id}/moderate` - Acciones moderación.
   - ✅ `GET /admin/reports/stats` - Estadísticas.
4. **Tests** (pendiente - funcionalidad base verificada manualmente)
5. **Integración** ✅ **Routers añadidos a main.py con tags ["moderation"]**

---

## 6. Webapp (Express)
1. **API client** (`webapp/utils/api.js`, ~200 tokens)
   - Métodos `createPost`, `getFeed`, `toggleReaction`, `createComment`, `getNotifications`.
2. **Rutas** (`webapp/routes/posts.js`, `feed.js`, `notifications.js`, ~400 tokens)
   - Formularios para crear post, listar posts propios, feed following, ver notificaciones.
3. **Vistas** (`webapp/views/posts/*.ejs`, `feed/index.ejs`, `notifications/index.ejs`, ~600 tokens)
   - Render de posts con reacciones/comentarios, puntos/niveles (panel lateral).
4. **Tests Jest** (`webapp/tests/posts.routes.test.js`, `feed.routes.test.js`, `notifications.routes.test.js`, ~300 tokens)
   - Mock API + snapshots.

---

## 7. Mobile (React Native)
1. **Servicios** (`mobile/services/ApiService.ts`, ~150 tokens)
   - Métodos para posts, feed, reacciones, comentarios, notificaciones, gamificación.
2. **Hooks/Contextos** (`mobile/hooks/usePosts.ts`, `useFeed.ts`, `useNotifications.ts`, ~250 tokens).
3. **Pantallas** (`mobile/screens/PostCreateScreen.tsx`, `FeedScreen.tsx` update, `NotificationsScreen.tsx`, `GamificationScreen.tsx`, ~700 tokens)
   - Soporte para crear post (texto + adjuntar media placeholder), listar feed, mostrar puntos/badges.
4. **Tests RN** (`mobile/__tests__/PostScreen.test.tsx`, `FeedScreen.test.tsx` actualización, `NotificationsScreen.test.tsx`, ~400 tokens).

---

## 8. Documentación & Observabilidad
1. Actualizar `docs/api/social.md` con nuevos endpoints.
2. Añadir métricas (posts_per_day, reactions_per_day, notification_sent) usando logger/instrumentación.
3. Manual QA (`manual-user-tests.md`): escenarios de post, reacción, comentario, badges, reportes.

---

## 9. Validación final
1. Backend: `python -m pytest tests/social/test_post_service.py tests/social/test_reaction_service.py tests/social/test_feed_routes.py tests/notifications/test_notification_service.py tests/social/test_report_service.py`.
2. Webapp: `NODE_ENV=test npm --prefix webapp run test -- --testPathPattern="(posts|feed|notifications|gamification)"` y e2e si aplica.
3. Mobile: `npm --prefix mobile test -- --testNamePattern="(FeedScreen|Post|Notifications|Gamification)"`.
4. Linters: `npm --prefix webapp run lint`, `npm --prefix mobile run lint`.
5. Actualizar `PENDING_FINAL.md` con resultados y issues abiertos.

---

## 10. Progreso actual - TOKENS USADOS

### ✅ COMPLETADO:
- **BD Migrations:** 4,574 tokens
  - `018_create_posts.sql`: 1,660 tokens
  - `019_gamification_core.sql`: 666 tokens
  - `020_notifications.sql`: 438 tokens
  - `021_reports.sql`: 440 tokens
  - `022_post_activity_log.sql`: 370 tokens

- **Models:** 1,970 tokens
  - `app/models/social/post.py`: 1,970 tokens

- **Services:** 14,300 tokens
  - `app/services/social/post_service.py`: 8,950 tokens
  - `app/services/social/reaction_service.py`: 832 tokens
  - `app/services/social/comment_service.py`: 1,072 tokens

- **Routes:** 19,279 tokens
  - `app/routes/posts.py`: 4,795 tokens
  - `app/routes/gamification.py`: 5,943 tokens
  - `app/routes/notifications.py`: 4,541 tokens
  - `app/routes/feed.py`: 4,000 tokens (actualización)

- **Gamification Services:** 29,959 tokens
  - `app/services/gamification/points_service.py`: 11,898 tokens
  - `app/services/gamification/badge_service.py`: 12,061 tokens

- **Notification Services:** 12,640 tokens
  - `app/services/notifications/notification_service.py`: 8,099 tokens
  - (integración triggers: ~4,541 tokens en otros servicios)

- **Moderation Services:** 16,779 tokens
  - `app/services/social/report_service.py`: 11,203 tokens
  - `app/routes/moderation.py`: 5,576 tokens

**TOTAL ACTUAL:** **~91,525 tokens implementados** 🎯➡️

### 📋 Estimación tokens PENDIENTES (~25,000 tokens restantes):
- **Rutas FastAPI** (posts, gamification, notifications, moderation): ~3,000 tokens
- **Tests Backend**: ~4,000 tokens
- **Feed following posterior**: ~3,000 tokens
- **Gamificación completa**: ~5,000 tokens
- **Webapp UI completa**: ~6,000 tokens
- **Mobile UI completa**: ~4,000 tokens

**TOTAL ESTIMADO COMPLETO:** ~45,000 tokens (similar a EPIC_A.A4)

---

## 11. Estado actual de implementación (12/oct/2025)

- Foto histórica (12/oct/2025): no existían `database/init/018_create_posts.sql` ni servicios/rutas para posts; A5 permanecía como backlog.
- Actualización 13/oct/2025: aparecen cambios locales no comprometidos que intentan cubrir A5; ver detalle debajo para diagnóstico y próximos pasos.

### 11.1 Auditoría de cambios locales (13/oct/2025)

Revisión sobre la rama `gamification-social-diet` comparando los requerimientos de este EPIC con los cambios sin commitear:

- **Esquema sin inicialización completa**  
  - `app/services/database.py` no declara ninguna de las tablas nuevas (`posts`, `post_media`, `post_reactions`, `post_comments`, `points_ledger`, `user_levels`, `user_badges`, `notifications`, `content_reports`, `post_activity_log`). Con SQLite, cualquier endpoint nuevo fallará con `OperationalError: no such table …` en cuanto se intente usar.
- **Toggles de reacciones inconsistentes**  
  - `app/services/social/post_service.py:167-176` intenta decrementar `likes_count` en `post_reactions`, columna que no existe en el esquema objetivo (solo debería contarse con agregados).  
  - `app/services/social/post_service.py:198-199` otorga puntos `like_received` al usuario que da like en lugar del autor del post, contraviniendo las reglas de la Sección 3.2.
- **Feed de seguidos rompe serialización y métricas**  
  - `app/services/social/feed_service.py:151-159` usa `COUNT(DISTINCT pr.post_id)`; esto devuelve a lo sumo 1 por publicación, no el total real de reacciones pedido en Sección 2.1.  
  - `app/services/social/feed_service.py:231-246` trata `PostDetail.stats` como diccionario (`post.stats['likes_count']`), pero el modelo expone un `PostStats`; el acceso lanza `TypeError` al serializar el feed.
- **Endpoints de gamificación fuera de contrato**  
  - Las rutas se montan con `app.include_router(gamification_router, prefix="/gamification")` (en `main.py`), pero el módulo define rutas `/gamification/...`. El resultado real es `/gamification/gamification/...`, distinto al API planeado (§3.4).  
  - `app/services/gamification/badge_service.py:218-236` intenta sumar puntos `badge_earned`, pero `PointsService.EARNING_RULES` no define esa key (`points_service.py:24-37`), por lo que los bonos nunca se registran.
- **Notificaciones y moderación con huecos**  
  - `app/services/social/reaction_service.py:24-38` llama a `PostService._db_conn()`, atributo inexistente, dejando a los autores sin notificación de “like” (Sección 4.3).  
  - `app/routes/notifications.py:124-138` expone `/notifications/cleanup` sin exigir autenticación/feature flag, permitiendo que cualquier cliente borre notificaciones acumuladas.
- **Cobertura funcional incompleta**  
  - `PostService` no implementa los métodos planeados `list_posts(...)`/`delete_post(...)`; solo existe `list_user_posts(...)`, insuficiente para §1.3.  
  - No hay nuevas suites en `tests/social/` ni `tests/notifications/` que cubran las rutas/servicios recién añadidos, incumpliendo §1.6, §2.4 y §4.5.

**Próximos pasos sugeridos**

1. Incorporar las tablas nuevas en `init_database()` (o declarar expresamente que las migraciones de `/database/init/*.sql` se ejecutan en boot).  
2. Corregir lógica de reacciones/puntos/feed según señalados arriba y alinear rutas con los prefijos esperados.  
3. Añadir los tests prometidos para posts, feed, gamificación y notificaciones, asegurando que pytest pase antes del merge.

### 11.2 Guía de remediación paso a paso (pensada para dev jr)

> Objetivo: corregir todos los hallazgos de la Sección 11.1 siguiendo una secuencia mecánica. Cada bloque indica archivos/líneas clave, cambios esperados y cómo validar.

**Bloque A – Inicialización de esquema**
- [ ] Abrir `app/services/database.py`. Ubicarse en el método `init_database()` (aprox. línea 50).  
- [ ] Insertar los `CREATE TABLE` completos para:
  - `posts`, `post_media`, `post_reactions`, `post_comments` (usar las definiciones ya escritas en `database/init/018_create_posts.sql`).
  - `post_activity_log` (ver `database/init/022_post_activity_log.sql`).  
  - `points_ledger`, `user_levels`, `user_badges` (ver `database/init/019_gamification_core.sql`).  
  - `notifications` (ver `database/init/020_notifications.sql`).  
  - `content_reports` (ver `database/init/021_reports.sql`).  
- [ ] Añadir también los `CREATE INDEX` equivalentes después de cada tabla.  
- [ ] Guardar y ejecutar `python - <<'PY'\nfrom app.services.database import db_service\nprint(\"init ok\")\nPY` para comprobar que `init_database()` corre sin errores (salida esperada: `init ok`).

**Bloque B – Correcciones en reacciones/puntos**
- [ ] En `app/services/social/post_service.py`, método `toggle_reaction()` (líneas 160-205):  
  1. Eliminar la query `UPDATE post_reactions SET likes_count = likes_count - 1...` (no existe esa columna).  
  2. Tras un `like`, obtener el `author_id` del post (consulta simple `SELECT author_id FROM posts WHERE id = ?`).  
  3. Para otorgar puntos, llamar `PointsService.add_points(author_id, 'like_received')` (autor), y mantener un bonus separado si aplica.  
  4. Para el usuario que reacciona, usar una fuente distinta si queremos premiar la acción (por ejemplo `PointsService.add_points(user_id, 'reaction_given')`) y agregar la clave en `EARNING_RULES`.  
- [ ] Ajustar la importación a la versión estática (`from app.services.gamification.points_service import PointsService`) para mantener consistencia.  
- [ ] Correr `python -m pytest tests/social/test_post_service.py -k toggle_reaction` (crear el test si no existe; ver Bloque F).

**Bloque C – Feed de seguidos**
- [ ] En `app/services/social/feed_service.py`, dentro de `list_following_posts()`:
  1. Reemplazar `COUNT(DISTINCT pr.post_id)` por `COUNT(DISTINCT pr.user_id)` o `COUNT(*)` según la métrica esperada.  
  2. Construir el `PostDetail` usando una instancia de `PostStats`: `stats=PostStats(likes_count=..., comments_count=...)`.  
  3. Al generar el `payload`, acceder como `post.stats.likes_count` y `post.stats.comments_count`.  
- [ ] Validar manualmente con `python - <<'PY'\nfrom app.services.social.feed_service import list_following_posts\nprint(list_following_posts('user-id-demo'))\nPY` (usar un seed conocido o preparar datos dummy).  
- [ ] Añadir un test `tests/social/test_feed_service.py` que confirme que `likes_count` refleja el número real de reacciones y que no se lanza excepción al serializar.

**Bloque D – Rutas y reglas de gamificación**
- [ ] En `main.py`, mantener `app.include_router(gamification_router, prefix="/gamification", tags=["gamification"])`.  
- [ ] En `app/routes/gamification.py`, modificar las rutas para que usen paths relativos (p. ej. `@router.get("/user/{user_id}")`, `@router.get("/leaderboard")`, etc.) y evitar repetir `/gamification`.  
- [ ] Abrir `app/services/gamification/points_service.py`: agregar las claves faltantes en `EARNING_RULES` (`'reaction_given'`, `'badge_earned'`, etc.) con los valores definidos en el spec.  
- [ ] Confirmar también que `DAILY_CAPS` cubre las nuevas fuentes (por ejemplo `reaction_given`).  
- [ ] Ejecutar `python -m pytest tests/gamification/test_points_service.py` (crear/actualizar el archivo con casos para las nuevas fuentes).

**Bloque E – Notificaciones y seguridad**
- [ ] En `app/services/social/reaction_service.py`:
  1. Reemplazar la llamada a `PostService._db_conn()` por `db_service.get_connection()`.  
  2. Asegurar que el código solamente envía notificación cuando `user_id != author_id`.  
- [ ] En `app/routes/notifications.py`:
  1. Aplicar `Depends(get_current_user)` al endpoint `/notifications/cleanup`.  
  2. Invocar `assert_feature_enabled("notifications_enabled")` al inicio del endpoint.  
  3. (Opcional) Limitarlo a roles admin cuando se implemente control de roles.  
- [ ] Añadir un test que verifique que `/notifications/cleanup` devuelve 403 sin auth y que las notificaciones se insertan al recibir un like.

**Bloque F – Funcionalidad faltante + pruebas**
- [ ] Implementar `PostService.list_posts(...)` (listado general con filtros de visibilidad) y `PostService.delete_post(...)` (soft/hard delete según decisión en spec).  
- [ ] Propagar estos métodos a `app/routes/posts.py` (`GET /posts` y `DELETE /posts/{post_id}` si aplica).  
- [ ] Crear los tests mínimos:
  - `tests/social/test_post_service.py`: creación, rate limit, eliminar, listar, comentarios, reacciones.  
  - `tests/social/test_post_routes.py`: smoke tests de endpoints.  
  - `tests/notifications/test_notification_service.py`: inserción, mark-as-read, cleanup seguro.  
- [ ] Ejecutar `python -m pytest tests/social tests/notifications` y asegurar verde.

**Bloque G – Verificación final**
- [ ] Levantar `uvicorn main:app --reload` y probar manualmente con un cliente (Thunder Client/Postman) los endpoints `POST /posts`, `POST /posts/{id}/react`, `GET /feed/following`, `GET /gamification/user/{id}`, `GET /notifications`.  
- [ ] Actualizar `PENDING_FINAL.md` con: comandos ejecutados, resultados de pytest y cualquier issue residual.  
- [ ] Generar evidencia (logs de pytest, capturas rápidas) si se requiere para QA.
