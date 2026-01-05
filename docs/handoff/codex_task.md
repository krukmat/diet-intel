# CODEX HANDOFF

PRIORITY: HIGH

## Goal

Completar la reducción de complejidad cíclica real en 2 funciones del sistema DietIntel mediante la integración manual de métodos de refactorización ya diseñados e implementados. El objetivo es reducir la complejidad de `_build_meal` y `scan_label_with_external_ocr` de nivel D (21-30) a ≤ C (≤12).

## Non-goals
- Modificar funcionalidades existentes o APIs
- Crear nuevos métodos de refactorización (ya están implementados)
- Cambiar lógica de negocio
- Modificar interfaces de usuario

## Proposed steps

### 1. Integrar métodos de refactorización en meal_planner.py
- Agregar métodos helper al final de la clase MealPlannerService
- Reemplazar `_build_meal()` con versión refactorizada usando pipeline
- Verificar que no hay errores de sintaxis o importación

### 2. Integrar métodos de refactorización en ocr_processor.py  
- Agregar métodos helper a la función `scan_label_with_external_ocr`
- Reemplazar lógica compleja con pipeline estructurado
- Verificar que todas las dependencias están disponibles

### 3. Verificar reducción de complejidad
- Ejecutar análisis de complejidad cíclica con radon
- Confirmar que ambas funciones alcanzan ≤ C (≤12)
- Ejecutar pruebas para asegurar que no hay regresiones

### 4. Documentar resultados
- Actualizar reportes con nuevos resultados de complejidad
- Confirmar que métodos integrados funcionan correctamente

## Files to change
- `app/services/meal_planner.py` - Integrar 6 métodos de refactorización
- `app/routes/product_services/ocr_processor.py` - Integrar 8 métodos de refactorización
- `docs/2026-01-05-final-technical-report.md` - Actualizar resultados

## Commands to run
```bash
# Verificar complejidad antes de cambios
python -m radon cc app/services/meal_planner.py | grep _build_meal
python -m radon cc app/routes/product_services/ocr_processor.py | grep scan_label_with_external_ocr

# Ejecutar pruebas para verificar funcionalidad
python -m pytest tests/ -k "meal_planner or ocr" -v

# Verificar complejidad después de integración
python -m radon cc app/services/meal_planner.py | grep _build_meal
python -m radon cc app/routes/product_services/ocr_processor.py | grep scan_label_with_external_ocr

# Pruebas completas para detectar regresiones
python -m pytest tests/ --tb=short
```

## Acceptance criteria
- ✅ `_build_meal` reduce complejidad de D a ≤ C (≤12)
- ✅ `scan_label_with_external_ocr` reduce complejidad de D a ≤ C (≤12)
- ✅ Todos los tests existentes siguen pasando (sin regresiones)
- ✅ Funcionalidad de meal planning y OCR preservada
- ✅ Métricas de complejidad actualizadas en documentación

## Rollback plan
- Revertir cambios en archivos principales si hay regresiones críticas
- Restaurar versiones anteriores de `meal_planner.py` y `ocr_processor.py`
- Deshacer integración si afecta funcionalidad existente
- Mantener métodos de refactorización como respaldo en archivos separados

## Background context

**Estado actual:**
- Implementación técnica 100% completa con 14 métodos de refactorización
- 1 función exitosa (`update_reminder` reducido D → C)
- 2001 tests pasando sin regresiones
- Métodos ya diseñados y testeados en archivos separados

**Limitaciones técnicas identificadas:**
- Integración automática limitada por sistema de edición
- Requiere intervención manual en archivos principales
- Riesgo moderado de regresiones por cambios en lógica compleja

**Archivos de referencia:**
- `meal_planner_refactored_methods.py` - 6 métodos para `_build_meal`
- `ocr_refactored_methods.py` - 8 métodos para OCR
- `docs/2026-01-05-final-technical-report.md` - Contexto completo

## Additional notes
- Priorizar la integración de `_build_meal` primero
- Verificar que cada método integrado mantiene funcionalidad existente
- Documentar cualquier ajuste necesario durante integración
- El proyecto ya logró 80% del objetivo - esta es la finalización
