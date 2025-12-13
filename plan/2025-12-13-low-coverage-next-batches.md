# Low-Coverage Replan (Dec 13 2025)

**Cobertura actual:** 76% tras `python -m pytest --cov=app` (13 207 sentencias instrumentadas, 3 125 faltantes).  
Las piezas con la cobertura más baja siguen siendo los motores de Recipe AI/Smart Diet y el feed social, así que la próxima ola de batches debe atacarlas en ese orden.

## Hot modules “<50%” que seguimos persiguiendo

| Módulo | Cobertura | Nota de impacto |
|--------|----------:|----------------|
| `app/services/smart_diet_optimized.py` | **25%** | Ruta crítica para sugerencias optimizadas; depende de Redis/DB y se expone desde `smart_diet_optimized` endpoints. |
| `app/services/recipe_database.py` | **39%** | Guarda/recupera y cachea recetas, y se usa desde `recipe_ai.generate` y `smart_diet` flows. |
| `app/services/recipe_translation_service.py` | **50%** | Traductor compartido por `recipe_ai` y `recipe_ai_engine`; necesita errores/proveedores/caché. |
| `app/services/social/feed_service.py` | **44%** | Motor de `list_feed`/`list_following_posts`; con interacciones de `social_feed` y `discover_feed` expone muchos branches. |

## Replanificación de batches

### Batch 8: Smart Diet Optimized + Feed service
- **Objetivo:** Penalizar las ramas donde el optimized engine regresa vacíos o cache fallida, y asegurar que `list_feed`/`list_following_posts` manejan cursors, errores y payloads inválidos.
- **Tests a añadir:**  
  1. `tests/services/test_smart_diet_optimized_integration.py` → mocks para la DB, Redis y SmartDietEngine; forzar `find_healthier_alternatives` para que devuelva listas vacías o lance `OperationalError`.  
  2. Extender `tests/social/test_feed_service.py` con casos para paginación (`has_more`/`next_cursor`) y escenarios donde JSON del payload no se puede decodear.  
- **Verificación:** `python -m pytest tests/services/test_smart_diet_optimized_integration.py tests/social/test_feed_service.py`

### Batch 9: Recipe Database resiliente
- **Objetivo:** Cubrir errores de conexión, toggles y caching grosso modo del `RecipeDatabaseService`, así como la lógica de `log_recipe_generation_request`.
- **Tests a añadir:**  
  1. `tests/services/test_recipe_database_service_cache.py` → simular `db_service.get_connection` que produce `OperationalError` y validar que las funciones registran errores con retornos seguros (`{"error": ...}`) sin fallar.  
  2. Añadir fixtures para cambiar `recipe_service._recipe_tables_ready` y forzar `init_recipe_tables`/`init_shopping_optimization_tables_sync` en modo fallback.  
- **Verificación:** `python -m pytest tests/services/test_recipe_database_service_cache.py tests/services/test_recipe_database_service.py`

### Batch 10: Recipe Translation + AI routes refinado
- **Objetivo:** Completar ramas de `recipe_ai` que surgen cuando `recommendation_engine` rechaza personalización, el `recipe_engine` lanza `RuntimeError`, o `recipe_db_service.create_recipe` falla con `sqlite3.IntegrityError`.
- **Tests a añadir:**  
  1. `tests/test_recipe_ai_routes_fallbacks.py` → usar `monkeypatch` para provocar las excepciones anteriores y confirmar que el endpoint responde 500 con los detalles adecuados.  
  2. `tests/services/test_recipe_translation_service_extra.py` (extendido) → probar `_translate_with_libretranslate` simulando respuesta 500/timeout y la memoización de instancias (`get_translation_service`).  
- **Verificación:** `python -m pytest tests/test_recipe_ai_routes_fallbacks.py tests/services/test_recipe_translation_service_extra.py`

Cada batch reescribirá este plan con los tests creados y los resultados de `coverage.json`/`coverage.xml` antes de pasar al siguiente. Después del Batch 10 deberíamos reevaluar si todavía faltan rutas sociales o de infraestructura antes de volver a correr la suite completa.
