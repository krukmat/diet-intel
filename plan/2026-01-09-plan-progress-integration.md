# Plan: Integración Plan ↔ Progreso (Comidas del Plan en Registrar Comida)

**Fecha**: 09/01/2026  
**Objetivo**: Unificar las comidas del Plan Nutricional con el sistema de Registro de Comidas

---

## Problema Actual

1. **PlanScreen.tsx** - Muestra comidas planificadas con progreso **hardcodeado**:
   ```javascript
   const [consumed] = useState({
     calories: 850,  // ← ¡VALOR HARDCODADO!
     protein: 35,
     fat: 25,
     carbs: 120,
   });
   ```

2. **MealLogScreen.tsx / TrackScreen.tsx** - Muestra comidas consumidas registradas por el usuario

3. **Ambos sistemas están desconectados** - Las comidas del Plan no aparecen en "Registrar Comida"

---

## Principios Aplicados

- **SOC (Separation of Concerns)**: Cada fase tiene responsabilidad única
- **KISS (Keep It Simple, Stupid)**: Funcionalidad mínima viable por fase
- **TDD (Test-Driven Development)**: Tests primero, luego implementación
- **Complejidad Ciclomática Baja**: Funciones pequeñas, un solo propósito

---

## FASE 1: Foundation Backend
**Objetivo**: Crear endpoint base para obtener estado del día

### Tareas (dependencias lineales):
```
Tarea 1.1 → Tarea 1.2 → Tarea 1.3
```

| Tarea | Descripción | Archivo | Complejidad |
|-------|-------------|---------|-------------|
| 1.1 | Definir tipos DTO para `DayDashboardResponse` | `app/models/tracking.py` | Baja |
| 1.2 | Crear endpoint `/track/dashboard` básico | `app/routes/track/router.py` | Baja |
| 1.3 | Escribir tests para endpoint `/track/dashboard` | `tests/track/test_dashboard.py` | Baja |

**Criterio de salida**: El endpoint devuelve comidas consumidas + progreso 0

---

## FASE 2: Backend - Progreso Real
**Objetivo**: Calcular progreso real desde comidas consumidas

### Tareas (paralelizables Tarea 2.1 y 2.2):
```
        ┌── Tarea 2.1 ──┐
Tarea 1.3 ─┤              ├─→ Tarea 2.3
        └── Tarea 2.2 ──┘
```

| Tarea | Descripción | Archivo | Complejidad |
|-------|-------------|---------|-------------|
| 2.1 | Implementar lógica `calculate_day_progress()` | `app/services/tracking_service.py` | Media |
| 2.2 | Obtener plan activo del usuario | `app/services/plan_storage.py` | Baja |
| 2.3 | Integrar progreso en endpoint `/track/dashboard` | `app/routes/track/router.py` | Baja |
| 2.4 | Escribir tests de integración progreso | `tests/track/test_progress.py` | Media |

**Criterio de salida**: El endpoint devuelve progreso real (no hardcodeado)

---

## FASE 3: Backend - Consumir Item del Plan
**Objetivo**: Permitir marcar items del plan como consumidos

### Tareas (dependientes de FASE 2):
```
Tarea 2.4 ──→ Tarea 3.1 ──→ Tarea 3.2 ──→ Tarea 3.3
```

| Tarea | Descripción | Archivo | Complejidad |
|-------|-------------|---------|-------------|
| 3.1 | Definir endpoint `POST /track/plan-item/{id}/consume` | `app/routes/track/router.py` | Baja |
| 3.2 | Implementar lógica `consume_plan_item()` | `app/services/tracking_service.py` | Media |
| 3.3 | Escribir tests para consumir item | `tests/track/test_consume.py` | Baja |

**Criterio de salida**: Se puede marcar un item del plan como consumido

---

## FASE 4: Mobile Foundation
**Objetivo**: Agregar tipos y servicios base

### Tareas (paralelizables, independientes de backend):
```
       ┌── Tarea 4.1 ──┐
       │               ├──→ Tarea 4.3
       └── Tarea 4.2 ──┘
```

| Tarea | Descripción | Archivo | Complejidad |
|-------|-------------|---------|-------------|
| 4.1 | Agregar tipos `DayDashboard`, `PlanProgress` | `mobile/types/tracking.ts` | Baja |
| 4.2 | Agregar tipos para items del plan consumidos | `mobile/types/mealPlan.ts` | Baja |
| 4.3 | Agregar método `getDayDashboard()` | `mobile/services/MealLogService.ts` | Baja |
| 4.4 | Agregar método `consumePlanItem()` | `mobile/services/MealLogService.ts` | Baja |

**Criterio de salida**: Mobile tiene tipos y servicios base

---

## FASE 5: Mobile - TrackScreen Dinámico
**Objetivo**: TrackScreen usa datos reales del API

### Tareas (dependientes de FASE 4):
```
Tarea 4.4 ──→ Tarea 5.1 ──→ Tarea 5.2 ──→ Tarea 5.3
```

| Tarea | Descripción | Archivo | Complejidad |
|-------|-------------|---------|-------------|
| 5.1 | Reemplazar `consumed` hardcodeado por API | `mobile/screens/TrackScreen.tsx` | Baja |
| 5.2 | Conectar progreso real del endpoint | `mobile/screens/TrackScreen.tsx` | Baja |
| 5.3 | Escribir tests para TrackScreen | `mobile/__tests__/TrackScreen.test.tsx` | Media |

**Criterio de salida**: TrackScreen muestra progreso real

---

## FASE 6: Mobile - Items del Plan en Progreso
**Objetivo**: Mostrar items del plan con estado consumible

### Tareas (dependientes de FASE 5):
```
Tarea 5.3 ──→ Tarea 6.1 ──→ Tarea 6.2 ──→ Tarea 6.3
```

| Tarea | Descripción | Archivo | Complejidad |
|-------|-------------|---------|-------------|
| 6.1 | Crear componente `PlanMealItem` | `mobile/components/tracking/PlanMealItem.tsx` | Baja |
| 6.2 | Agregar sección "Items del Plan" en TrackScreen | `mobile/screens/TrackScreen.tsx` | Media |
| 6.3 | Implementar toggle consumible | `mobile/components/tracking/PlanMealItem.tsx` | Baja |
| 6.4 | Tests para PlanMealItem | `mobile/__tests__/PlanMealItem.test.tsx` | Baja |

**Criterio de salida**: Se ven items del plan y se pueden marcar como consumidos

---

## FASE 7: Unificación Meal List (Opcional)
**Objetivo**: Mostrar comidas consumidas + items del plan en lista unificada

### Tareas (independiente, puede omitirse):
```
Tarea 6.4 ──→ Tarea 7.1 ──→ Tarea 7.2
```

| Tarea | Descripción | Archivo | Complejidad |
|-------|-------------|---------|-------------|
| 7.1 | Agregar prop `showPlannedMeals` a MealList | `mobile/components/mealLog/MealList.tsx` | Media |
| 7.2 | Unificar visualización | `mobile/components/mealLog/MealList.tsx` | Media |

---

## Resumen de Dependencias

```
FASE 1 ──→ FASE 2 ──→ FASE 3 ──→ FASE 5 ──→ FASE 6
   │                         ↑
   └── FASE 4 ───────────────┘
   
FASE 7 (opcional, puede hacerse después)
```

**Camino crítico**: FASE 1 → 2 → 3 → 5 → 6  
**Total de tareas**: 20 (18 obligatorias + 2 opcionales)

---

## Flujo de Usuario Esperado

1. Usuario genera un plan en **PlanScreen**
2. En **Progreso** (TrackScreen) ve:
   - Items del plan con estado "pendiente" ✅/☐
   - Comidas consumidas manualmente
   - Progreso real (no hardcodeado)
3. Al marcar ✅ un item del plan → se registra como consumido
4. El progreso se actualiza automáticamente

---

## Respuesta API Esperada

```json
GET /track/dashboard
{
  "consumed_meals": [...],
  "active_plan": {
    "id": "plan-123",
    "daily_calorie_target": 2000,
    "meals": [...]
  },
  "progress": {
    "calories": { "consumed": 850, "planned": 2000, "percentage": 42 },
    "protein": { "consumed": 35, "planned": 120, "percentage": 29 },
    "fat": { "consumed": 25, "planned": 65, "percentage": 38 },
    "carbs": { "consumed": 120, "planned": 250, "percentage": 48 }
  },
  "plan_items_consumed": ["item-1", "item-3"]
}
```

---

## Notas

- Las Fases 1-3 pueden ejecutarse con Codex si se prefiere
- Las Fases 4-6 son ideales para desarrollo local (Ollama)
- Mantener complejidad ciclomática < 10 por función
- Cada endpoint debe tener tests de integración
