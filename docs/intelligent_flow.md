# Intelligent Flow Contracts

Este documento describe los contratos de datos compartidos por el flujo unificado
`Food Vision → Recipe AI → Smart Diet`. Su objetivo es permitir que los equipos
de backend, web y mobile consuman un mismo esquema sin ambigüedades.

## Resumen del Flujo

1. **Food Vision** procesa la imagen y devuelve `VisionLogResponse`.
2. **Recipe AI** genera una receta aprovechando las preferencias del usuario y
   los ingredientes detectados.
3. **Smart Diet** produce sugerencias y optimizaciones alineadas con el contexto.

## Modelos Clave (`app/models/intelligent_flow.py`)

- `IntelligentFlowRequest`
  - `user_id`: Identificador del usuario.
  - `image_base64`: Imagen en Base64 validada antes de ejecutar el flujo.
  - `meal_type`: Contexto de la comida (breakfast|lunch|dinner|snack).
  - `user_context`: Datos opcionales (peso, objetivos, etc.).
  - `recipe_preferences`: Preferencias de Recipe AI alineadas con `EngineRequest`.
  - `smart_diet_config`: Configuración para Smart Diet (`SmartDietContext`, flags y límites).

- `IntelligentFlowRecipePreferences`
  - Campos mapeables 1:1 con `RecipeGenerationRequest` del motor (`cuisine_preferences`,
    `dietary_restrictions`, `difficulty_preference`, tiempos máximos, macros, etc.).
  - `include_identified_ingredients`: cuando es `true`, agrega automáticamente los ingredientes
    detectados por Food Vision como `available_ingredients`.

- `IntelligentFlowSmartDietConfig`
  - Permite configurar el contexto (`SmartDietContext`), límites de sugerencias, idioma,
    restricciones y presupuesto calórico opcional.

- `IntelligentFlowResponse`
  - `status`: `complete`, `partial` o `failed`.
  - `vision_result`: `VisionLogResponse` (sin modificaciones).
  - `recipe_result`: `GeneratedRecipeResponse` (puede ser `None` si falla esa etapa).
  - `smart_diet_result`: `SmartDietResponse` (ídem).
  - `timings`: `FlowStepTiming` por paso (`success|skipped|error`, duración y timestamp).
  - `metadata`: `FlowMetadata` con `user_id`, `meal_type`, duración total y warnings.

## Conversión a Servicios Existentes

### Recipe AI
- Los datos se convierten a `RecipeGenerationRequest` (dataclass del motor) tomando:
  - `difficulty_preference`, tiempos y macros directamente de `recipe_preferences`.
  - `available_ingredients` combinando preferencias manuales + ingredientes detectados.
  - `meal_type` se define con prioridad: `recipe_preferences.meal_type` > `IntelligentFlowRequest.meal_type`.

### Smart Diet
- Se instancia `SmartDietRequest` aplicando:
  - `context_type`, `include_optimizations`, `include_recommendations`, límites y restricciones
    desde `smart_diet_config`.
  - `meal_context` utiliza `smart_diet_config.meal_context` con fallback al `meal_type` de la solicitud.
  - `calorie_budget` puede derivarse del análisis nutricional cuando esté disponible.

## Métricas y Observabilidad

Cada paso del flujo registra métricas mediante `performance_monitor.measure_api_call`
con nombres `intelligent_flow_vision`, `intelligent_flow_recipe` e
`intelligent_flow_smart_diet`. La respuesta expone la duración total y la
descomposición por paso en `timings` para facilitar inspecciones en logs.

## Modo asíncrono

- `POST /intelligent-flow?async_mode=true` encola la ejecución y responde con `job_id` y estado inicial.
- `GET /intelligent-flow/{job_id}` permite consultar el estado (`queued|running|completed|failed`) y recuperar el resultado cuando esté disponible.
- La cola actual es en memoria (`app/services/intelligent_flow_queue.py`); reemplazar por infraestructura duradera en producción.
- Cada job almacena `user_id`, por lo que solo el propietario puede consultar su estado.

- ### Configuración y Flags

- Activar el endpoint: establecer `intelligent_flow_enabled=true` en la configuración (`Config`) o en la variable de entorno correspondiente.
- Recompensas de gamificación: ajustar el mapa `gamification_point_rules` en `Config` para modificar/añadir fuentes (por ejemplo, `{'intelligent_flow_complete': 15}`).
- Si `gamification_enabled` está deshabilitado, el flujo se ejecuta sin otorgar puntos.

## Consideraciones de Clientes

- Web y mobile pueden activar gradualmente el flujo consumiendo `/intelligent-flow`
  (endpoint expuesto en Sprint 2).
- `recipe_result` y `smart_diet_result` son opcionales; los clientes deben manejar
  estados `partial` sin romper la experiencia.
- Para pruebas locales, generar imágenes base64 pequeñas (inferiores a 1 MB) y
  reutilizar fixtures existentes en `tests/fixtures/images/`.
