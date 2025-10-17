# Reporte de Tests Fallidos - 15/10/2025

## Resumen Ejecutivo
- **Total de tests ejecutados:** 92
- **Tests exitosos:** 91
- **Tests fallidos:** 1
- **Advertencias:** 50 (principalmente Pydantic V1 → V2 migration)

## Test Fallido

### 1. `test_social_feature_disabled` (tests/social/test_block_routes.py:133)

**Ubicación:** `tests/social/test_block_routes.py::TestFeatureFlag::test_social_feature_disabled`

**Error:** `AttributeError: <module 'app.services.auth' from '/Users/matiasleandrokruk/Documents/DietIntel/app/services/auth.py'> does not have the attribute 'verify_token'`

**Lógica del Test:**
- **Propósito:** Verificar que cuando la funcionalidad social está deshabilitada, el sistema responda correctamente
- **Método:** Usa `patch` para mockear `is_social_feature_enabled` retornando `False`
- **Comportamiento esperado:** El endpoint debe retornar un error 404 indicando que la funcionalidad está deshabilitada
- **Contexto:** Forma parte de la suite de tests de funcionalidades sociales, específicamente testeando el comportamiento de bloqueo de usuarios cuando el feature flag está apagado

**Posible Razón de la Falla:**
1. **Función faltante en módulo auth:** El test intenta hacer patch de `app.services.auth.verify_token` pero esta función no existe en el archivo `auth.py`
2. **Import incorrecto:** El test puede estar intentando acceder a una función que fue renombrada o movida
3. **Dependencia de autenticación:** El test requiere verificar tokens de autenticación pero la función `verify_token` no está disponible

**Código Problemático:**
```python
with patch('app.services.auth.verify_token', return_value=False), \
```

**Solución Potencial:**
- Verificar qué funciones de autenticación están disponibles en `app.services.auth`
- Usar la función correcta para verificación de tokens (posiblemente `get_current_user_from_token` o similar)
- Actualizar el import del test para usar la función correcta

## Tests Exitosos (91 tests)

### Tests Sociales que Pasan:
- **Block Routes:** 8/9 tests pasan (solo falla el de feature flag)
- **Block Service:** 18 tests pasan completamente
- **Discover Feed Service:** 12 tests pasan
- **Feed Ingester:** 11 tests pasan
- **Feed Routes:** 8 tests pasan
- **Feed Service:** 4 tests pasan
- **Follow Routes:** 9 tests pasan
- **Post Service:** 7 tests pasan
- **Profile Routes:** 14 tests pasan

## Advertencias (50 warnings)

### Principales Categorías:
1. **Pydantic V1 → V2 Migration:** 44 warnings
   - `@validator` deprecated → usar `@field_validator`
   - `.dict()` deprecated → usar `.model_dump()`
   - `min_items`/`max_items` deprecated → usar `min_length`/`max_length`

2. **Configuración Pydantic:** 6 warnings sobre configuración basada en clases

**Impacto:** Estas son advertencias de deprecación que no rompen funcionalidad pero indican deuda técnica que debería ser abordada en futuras versiones.

## Conclusión

El estado general de los tests sociales es **muy bueno** con un 98.9% de éxito (91/92 tests). El único fallo es menor y está relacionado con una función de autenticación faltante en el módulo auth. Los tests cubren ampliamente la funcionalidad social incluyendo bloqueos, follows, posts, feeds y perfiles.

**Prioridad de Corrección:** Baja - El fallo no afecta la funcionalidad core del sistema.
