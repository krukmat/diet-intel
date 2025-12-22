# Phase 3 Coverage Roadmap (Target 80%+)
**Date:** 2025-12-31  
**Objective:** Continuar el esfuerzo posterior a la Phase 2 para elevar la cobertura hacia 80%+, atacando rutas y servicios que quedaron fuera de los batches previos (moderación/gamificación, shopping optimization, y visión/imagen), y dejando trazabilidad de cada barrida de pruebas.

## Batches propuestos (3–4 scripts cada uno)

### Batch 1: Moderación y Gamificación (3 scripts)
- **Objetivo:** Cubrir permisos y validaciones de moderación/gamificación y el gateway de follows.
- **Scripts a trabajar:**  
  1. `app/routes/moderation.py` → nuevo `tests/test_moderation_routes.py` (rol admin requerido, 403/400 y ruta feliz mínima).  
  2. `app/routes/gamification.py` → nuevo `tests/test_gamification_routes.py` (validación `time_range`, errores y respuesta feliz).  
  3. `app/services/social/follow_gateway.py` → `tests/services/test_follow_gateway_service.py` (stub follow/unfollow y ramas TODO).  
- **Verificación:** `python -m pytest tests/test_moderation_routes.py tests/test_gamification_routes.py tests/services/test_follow_gateway_service.py`
 - **Progreso (2025-12-31):**  
   - Files touched: `tests/test_moderation_routes.py`, `tests/test_gamification_routes.py`, `tests/services/test_follow_gateway_service.py`  
   - Tests executed: `python -m pytest tests/test_moderation_routes.py tests/test_gamification_routes.py tests/services/test_follow_gateway_service.py`  
   - Cobertura/observaciones: Se cubrieron los guardas de feature flag y auth (con dependency overrides), validaciones de tiempo y autorizaciones de datos propios, además del stub de follow gateway; se siguen observando los avisos de Pydantic ya conocidos.  
   - Pendientes: ningún pendiente para este batch.

### Batch 2: Shopping Optimization y métricas Smart Diet (3–4 scripts)
- **Objetivo:** Aumentar cobertura de consolidación de compras y métricas/feedback pendientes de Smart Diet.
- **Scripts a trabajar:**  
  1. `app/services/shopping_optimization.py` → `tests/services/test_shopping_optimization_service.py` (cost/quantity defaults, consolidación, errores de entrada).  
  2. `app/routes/smart_diet.py` (métricas/feedback) → `tests/test_smart_diet_routes.py` (validaciones, 400/501, flujo feliz simulado).  
  3. Opcional 4.º: `app/services/smart_diet.py` (ramas de métricas/feedback) → extender `tests/services/test_smart_diet_service.py`.  
- **Verificación:** `python -m pytest tests/services/test_shopping_optimization_service.py tests/test_smart_diet_routes.py tests/services/test_smart_diet_service.py`
 - **Progreso (2025-12-31):**  
   - Files touched: `tests/test_smart_diet_routes.py` (nuevo), se reutilizó el suite existente `tests/test_shopping_optimization.py` para cobertura de consolidación.  
   - Tests ejecutados: `python -m pytest tests/test_shopping_optimization.py tests/test_smart_diet_routes.py`  
   - Cobertura/observaciones: Se cubrieron validaciones de feedback (403/400/422) y métricas mock de Smart Diet con override de sesión; shopping optimization ya cubre consolidación, densidades y métricas de eficiencia. Persisten warnings de Pydantic ya conocidos.  
   - Pendientes: No se añadieron casos nuevos a `tests/services/test_smart_diet_service.py`; opcional si se detectan ramas de métricas sin cubrir.

### Batch 3: Visión, Imagen y Notificaciones (3–4 scripts)
- **Objetivo:** Cubrir ramas pendientes de visión, utilidades de imagen y notificaciones.
- **Scripts a trabajar:**  
  1. `app/services/food_vision_service.py` → `tests/services/test_food_vision_service.py` (persistencia simulada, validación de correcciones, manejo de excepciones).  
  2. `app/utils/image_processor.py` → `tests/utils/test_image_processor.py` (creación/limpieza de archivos temporales, errores de IO).  
  3. `app/routes/notifications.py` → `tests/test_notifications_routes.py` (guardas admin, éxito).  
  4. Opcional: `app/routes/food_vision.py` → extender `tests/test_food_vision_routes.py` (ramas de datos originales/cache).  
- **Verificación:** `python -m pytest tests/services/test_food_vision_service.py tests/utils/test_image_processor.py tests/test_notifications_routes.py tests/test_food_vision_routes.py`

## Instrucciones generales
- Ejecutar los comandos de verificación con `python -m pytest` (evitar el binario de pytest por dependencias).
- Actualizar y versionar `coverage.json`/`coverage.xml` tras cada batch si cambia la cobertura.
- Documentar en este archivo, al cerrar cada batch:
  - **Files touched:** …
  - **Tests executed:** …
  - **Cobertura/observaciones:** …
  - **Pendientes:** …

## Pendientes actuales
- Identificar y añadir los módulos específicos <50% tras Phase 2 usando la última `coverage.json` antes de iniciar el primer batch de Phase 3.

## Sweep Record — 2025-12-11
- **Files touched:** `app/utils/image_processor.py`
- **Tests executed:**  
  1. `python -m pytest tests/services/test_image_processor.py`  
  2. `python -m pytest --cov=app`
- **Cobertura/observaciones:**  
  - Cobertura global: **75%** (12 207 líneas instrumentadas, 3 244 faltantes).  
  - Se revalidaron las nuevas utilidades de imagen (optimización, thumbnails y metadatos) y la suite completa ahora pasa sin errores; los `warnings` de Pydantic ya conocidos persisten, pero no bloquean.  
  - Persisten múltiples módulos críticos por debajo del 70% (más abajo se listan los que aún están <50%), por lo que la fase 3 debe extenderse con nuevas tandas específicas.
- **Pendientes:**  
  - Elaborar pruebas adicionales para los servicios y rutas aún con cobertura baja.  
  - Generar nuevas entradas de plan para cada batch priorizando scripts con impacto en los módulos mencionados.

## Phase 3 Continuation Plan (post-sweep)
Las siguientes tandas proponen 3‑4 scripts cada una, enfocadas en las áreas que más arrastran el porcentaje final.

### Batch 4: Recipe & AI coverage
- **Objetivo:** Aumentar la cobertura de la capa de Recipe AI y sus dependencias directas.
- **Scripts a trabajar:**  
  1. `app/routes/recipe_ai.py` – nuevas pruebas que ejerciten errores del pipeline (timeout, validación inválida) y rutas felices sin mocks pesados.  
  2. `app/services/recipe_database.py` – tests que exploren caching, errores del cursor y ramas de inserción/actualización.  
  3. `app/services/recipe_translation_service.py` – simular diferentes respuestas de traducción y validar fallback/errores.  
- **Verificación:** `python -m pytest tests/test_recipe_ai_routes.py tests/services/test_recipe_database_service.py tests/services/test_recipe_translation_service.py`

### Batch 5: Gamification & Social feeds
- **Objetivo:** Cubrir el motor de puntos/badges y las rutas/social services que aún caen en 40‑50%.
- **Scripts a trabajar:**  
  1. `app/services/gamification/points_service.py` – validar límites, errores de base y casos de cálculo (win/lose).  
  2. `app/services/gamification/badge_service.py` – asegurar ramas de agencias, creación/recuperación.  
  3. `app/services/social/feed_service.py` – tests para paginación, errores upstream y seeding de contenido.  
  4. `app/services/social/post_service.py` – reacciones, comentarios y excepciones de persistencia.  
- **Verificación:** `python -m pytest tests/services/test_points_service.py tests/services/test_badge_service.py tests/services/test_feed_service.py tests/services/test_post_service.py`

### Batch 6: Infra y traducciones persistentes
- **Objetivo:** Atacar infraestructura de cache/database y las rutas globales que todavía tienen coberturas en los 60s.
- **Scripts a trabajar:**  
  1. `app/services/redis_cache.py` – ramas de expiración, recuperaciones fallidas y errores de conexión.  
  2. `app/services/database.py` – crear fixtures que disparen `OperationalError`, `IntegrityError` y flujos de transacción.  
  3. `app/routes/reminder.py` – validaciones de fechas, flujos felices y errores 400/500.  
  4. `app/routes/translation.py` – fallback de idiomas no soportados y errores de proveedor.  
- **Verificación:** `python -m pytest tests/services/test_redis_cache_service.py tests/services/test_database_service.py tests/test_reminder_routes.py tests/test_translation_routes.py`

Cada uno de estos batches se añadirá al plan con los archivos tocados y los comandos de verificación correspondientes antes de cerrar la fase. Las nuevas propuestas deben documentar cualquier dependencia extra y registrar los resultados en `coverage.json`/`coverage.xml` para mantener trazabilidad.

## Batch A execution — 2025-12-11
- **Objetivo:** Validar la lógica existente de los servicios documentados en el Grupo A (database, product discovery y traducción de recetas) y registrar los comandos que ejercitan sus caminos básicos.
- **Tests ejecutados:**  
  1. `python -m pytest tests/test_database_comprehensive.py`  
  2. `python -m pytest tests/services/test_product_discovery_service.py`  
  3. `python -m pytest tests/test_recipe_translation_service.py`
- **Resultados:**  
  - Todos los suites pasaron sin fallos; los warnings de Pydantic son los mismos ya conocidos del entorno.  
  - La ejecución no reemplazó el `coverage.json` global (la última corrida completa sigue reflejando 75%); estas pruebas refuerzan los caminos de los servicios, pero la cobertura general exige más casos para llegar a 80%.  
  - **Siguientes pasos:**  
  - Enfocar Batch 4 (Recipe & AI coverage) en expandir las pruebas de `app/routes/recipe_ai.py` y de la base de datos/traducciones coincidientes.  
  - Considerar añadir mocks más precisos de proveedores externos para capturar errores de red/cache y alcanzar el objetivo de 80% de cobertura en estos módulos.

## Módulos 50–60% (priorizados para subir a 80%+)
Agrupados de a 3 según prioridad (uso/referencias y criticidad en rutas/servicios):

### Grupo A (núcleo de datos y traducción)
- `app/services/database.py` — **55%**; base de todos los servicios, expuesto a múltiples rutas.
- `app/services/product_discovery.py` — **55%**; alimenta product discovery y rutas de producto.
- `app/services/recipe_translation_service.py` — **50%**; usado por Recipe AI/translation, rutas de recetas.

### Grupo B (social y gamificación)
- `app/services/social/post_service.py` — **55%**; pivote de posts/reacciones/comentarios en varias rutas sociales.
- `app/services/social/profile_service.py` — **59%**; fuente de datos para perfiles y follows.
  - `app/services/gamification/badge_service.py` — **54%**; impacta puntos/badges y rankings.

### Batch B execution — 2025-12-12
- **Objetivo:** Corroborar las pruebas existentes que tocan `app/services/social/post_service.py`/`profile_service.py` y los endpoints de reacciones, consolidando la base para futuras expansiones (points/badge en la fase siguiente).  
- **Tests ejecutados:**  
  1. `python -m pytest tests/social/test_post_service.py`  
  2. `python -m pytest tests/services/test_reaction_service.py`  
  3. `python -m pytest tests/social/test_profile_routes.py`
- **Resultados:**  
  - Las tres suites se completan sin fallos; los warnings de Pydantic quedan como antecedentes conocidos.  
  - No se actualizó el `coverage.json`; hay que diseñar nuevos tests para badges/points y ramas de `profile_service` para empujar la cobertura de estas piezas que solo están en 50–60%.  
- **Siguientes pasos:**  
  - Planificar Batch 5 (Gamification & Social feeds) centrado en ampliar los escenarios de `badge_service`, `points_service`, `feed_service` y `post_service` (por ejemplo, errores de persistencia, límites y fallback).  
  - Evaluar si es necesario mockear gateways externos o datos de feed para alcanzar las ramas críticas antes de lanzar la siguiente corrida de cobertura.

### Batch 5 execution — 2025-12-11
- **Objetivo:** Documentar y ejecutar los scripts creados en la fase B5 (Points, Badge y Feed) para cubrir rules, límites y trasformaciones del discover feed antes de regresar al sweep completo.  
- **Tests ejecutados:**  
  1. `python -m pytest tests/services/test_points_service.py`  
  2. `python -m pytest tests/services/test_badge_service.py`  
  3. `python -m pytest tests/social/test_feed_service.py`
- **Resultados:**  
  - Todas las pruebas pasan (24 avisos de Pydantic continúan como referencia).  
  - Las nuevas suites limpian los registros temporales en las tablas `points_ledger`, `user_levels`, `user_badges`, `profile_stats` y `social_feed`, y ahora se pueden extender con más escenarios de errores/validaciones.  
  - El `coverage.json` global no cambió (sigue en 75%), pero ahora hay una base concreta para subir los módulos ~50% antes de Batch 6.  
- **Siguientes pasos:**  
  - Anidar pruebas adicionales para cubrir los límites de puntos diarios, las reglas `conversationalist`/`connector` de badges y la ruta `list_following_posts` del feed.  
  - Mientras tanto, preparar los scripts propuestos en Batch 6 e ir planificando un nuevo `python -m pytest --cov=app` tras cerrar la tanda de gamification/social.

### Batch 6 execution — 2025-12-11
- **Objetivo:** Ejecutar las suites que soportan la infraestructura de cache/database y los helpers de reminders/traducción antes de re correr el sweep completo (Batch 6 pendiente de pruebas de traducción en vivo).  
- **Tests ejecutados:**  
  1. `python -m pytest tests/services/test_database_service.py`  
  2. `python -m pytest tests/services/test_redis_cache_service.py`  
  3. `python -m pytest tests/routes/test_reminder_utils.py`  
  4. `python -m pytest tests/test_translation_routes_extra.py`
- **Resultados:**  
  - Todas las suites pasan; los warnings de Pydantic son los mismos históricos y no bloquean.  
  - Los tests cubren creación/actualización de usuarios/sesiones, batch helpers del recordatorio, operaciones de `RedisCacheService` (set/get/multiple/health) y rutas de traducción con respuestas de éxito/fallo.  
  - `coverage.json` permanece en 75% porque no se re corrió el barrido global, pero ahora hay pruebas adicionales que apuntan a los módulos infra/translation para acercarlos al 80%.  
- **Siguientes pasos:**  
  - Expandir `tests/routes/test_reminder_utils.py` y las pruebas de traducción para cubrir flujos HTTP completos (clientes FastAPI o TestClient) antes de la próxima corrida de cobertura.  
  - Re ejecutar `python -m pytest --cov=app` cuando los siguientes batches Ci6/7 estén listos para medir la ganancia neta de cobertura en infra y servicios sociales.

### Full sweep — 2025-12-11
- **Objetivo:** Registrar la corrida completa `python -m pytest --cov=app` y anotar el nuevo porcentaje de cobertura tras todas las tandas planeadas hasta ahora.  
- **Cobertura:** **76%** (13 207 declaraciones, 3 125 carpetas faltantes).  
- **Notas:**  
  - Ninguna prueba falla; los warnings de Pydantic/Torch siguen siendo los de siempre.  
  - Sigue habiendo módulos críticos por debajo del 60% (`app/routes/recipe_ai.py`, `app/services/recipe_database.py`, `app/services/smart_diet_optimized.py`, `app/services/social/feed_service.py`), por lo que todavía se necesitan más batches.  
  - El próximo ciclo debe priorizar esos módulos antes de la siguiente corrida global para alcanzar el objetivo del 80%.

### Grupo C (colas y utilidades de sesión)
- `app/services/intelligent_flow_queue.py` — **54%**; coordina la cola de Intelligent Flow.
- `app/utils/auth_context.py` — **51%**; utilitario central para contexto de autenticación en rutas/servicios.
- `app/utils/rate_limiter.py` — **52%**; helper de rate limiting usado por endpoints sensibles.
