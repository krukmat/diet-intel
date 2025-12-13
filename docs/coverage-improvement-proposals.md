# Coverage Improvement Proposals (Dec 2025)

Estos apuntes describen la estrategia aplicada para subir la cobertura de los módulos que estaban por debajo del 50 %:

## 1. `app/routes/block.py`
- **Series de errores**: simular que `block_service.block_user` lanza `ValidationError` y `RuntimeError` para cubrir los manejadores que retornan `422` y `500`.
- **Ruta de unblock**: invocar `POST /blocks/{target_id}` con `action="unblock"` para garantizar que el servicio se utiliza y que la lista de pares bloqueados se limpia.
- **Listados paginados**: forzar excepción `HTTPException` y una excepción genérica al llamar `list_blocked`/`list_blockers` para que los bloques `except` queden cubiertos sin tocar la base de datos real.
- **Mocks mínimos**: se reutiliza el `block_client_factory` para sobrescribir sólo los métodos necesarios sin tocar `db_service`.

## 2. `app/routes/recommendations.py`
- **Feedback extremo**: verificar que una retroalimentación con `record_feedback` devolviendo `False` provoca el `HTTPException` de estado `500`.
- **Métricas**: cubrir las validaciones de `days`, la ruta feliz y la ruta de excepción para `GET /recommendations/metrics` usando un `RecommendationMetrics` construido con datos reales.
- **Preferencias de usuario**: probar los caminos de éxito, negación por otro usuario, ausencia de datos (404) y falla del motor (500) en `/user-preferences/{user_id}`.
- **Mock estratégico**: el motor de recomendaciones destilado sólo implementa los métodos `record_feedback`, `get_metrics` y `get_user_preferences` con `AsyncMock`, sin llamar a redux u otros servicios.

## 3. `app/services/smart_diet.py`
- **Hash determinista**: validar `_generate_request_hash` con distintos `SmartDietRequest` y asegurar invariancia/respuestas distintas.
- **Insights y resúmenes**: ejecutar `_generate_insights` y `_generate_nutritional_summary` con `lang != en` para cubrir ramas de traducción, incluido el manejo de errores (fallback en texto original).
- **Optimización**: confirmar que `_generate_optimizations` corta cuando no existe plan y que llama a `OptimizationEngine` cuando sí hay plan (mockeando la respuesta).
- **Aprendizaje**: ejercitar `process_suggestion_feedback` y `get_diet_insights` con sugerencias/retroalimentaciones de prueba, enfocándose en los filtros `accepted` vs. `ignored`.
- **Mocks ligeros**: se parchan el cache (dummy en memoria), el plan storage y el servicio de traducción para evitar dependencias externas.

## 4. `app/routes/posts.py`
- **Rutas completas**: agregar pruebas de éxito/errores para listado de posts, reacciones y comentarios (incluyendo `ValueError` de los servicios).
- **Errores controlados**: forzar `PostService.create_post` y `CommentService.get_comments` para que lancen `ValueError` y que los `HTTPException` capturen dicha lógica.
- **Mínimos mocks**: se reutilizan los `FakeService` existentes para devolver respuestas consistentes sin tocar la lógica de negocio.

## 5. `app/services/translation_service.py`
- **LibreTranslate**: simular respuestas JSON, respuestas de texto plano y errores (timeout/500) para cubrir `_translate_with_libretranslate`.
- **Singleton y formatos**: validar `get_supported_languages`, `is_language_supported` y que `get_translation_service` retorna la misma instancia.
- **Caching**: usar la caché en memoria (`_MemoryCache`) para mantener comportamiento real sin dependencias externas.

Los tests propuestos priorizan el uso de datos reales/estructuras simples cuando es posible y sólo simulan lo estrictamente necesario (p. ej. clientes HTTP). El objetivo es garantizar un paso claro por cada `try/except` crítico sin recurrir a infra innecesaria.

## 6. `app/services/database.py`, `app/services/smart_diet_cache.py`, `app/services/smart_diet_optimized.py` (60% range)
- **Database resilience**: realice pruebas en `tests/services/test_database_service.py` que disparen `OperationalError`, `IntegrityError` y `ConnectionError` dentro de las transacciones de `database.py`, y compruebe que los helpers de rollback/caching responden con valores previsibles cuando la base de datos cae.
- **Smart Diet cache**: en `tests/services/test_smart_diet_cache.py`, fuerce series de TTL expiradas, valores corruptos y `redis_client` inaccesible para cubrir los bordes de `get_cached_suggestion`, `store_suggestion` e `invalidate`.
- **Smart Diet optimized**: en `tests/services/test_smart_diet_optimized_utils.py` o el suite de integración respectivo, simule que Redis está caído y que el motor de optimización responde con listas vacías; asegúrese de que los caminos de fallback (plan predeterminado, logging y métricas de cache hit/miss) estén cubiertos.

Agregar estos tests antes de la próxima corrida `python -m pytest --cov=app` debería empujar estos módulos por encima del 80%. Recuerde documentar los scripts nuevos/modificados dentro de `plan/` y actualizar `coverage.json` tras cada barrida global para conservar una trazabilidad clara de los avances.
