# CODEX HANDOFF - ERRORES CRÍTICOS DE JEST

## PRIORITY: HIGH

## Goal
Resolver errores críticos de Jest en sistema de recompensas mobile que impiden la correcta ejecución de tests

## Non-goals
- No modificar lógica de negocio existente
- No cambiar estructura de base de datos
- No alterar APIs externas

## Error Analysis - Resumen Ejecutivo

### **ESTADÍSTICAS DE ERRORES:**
- **Test Suites**: 4 failed, 113 passed, 117 total
- **Tests**: 41 failed, 1347 passed, 1388 total  
- **Tasa de fallo**: 2.95% de tests fallando

### **ERRORES CRÍTICOS IDENTIFICADOS:**

#### **1. RewardsScreen.test.tsx - Error de Acceso a Null**
```
TypeError: Cannot read properties of null (reading 'totalPoints')
```
**Ubicación**: `screens/RewardsScreen.tsx:52-57`
**Causa**: Componente intenta acceder a propiedades de `data` cuando es `null`
**Tests afectados**: 2/20 tests fallando
**Mensaje**: Los tests no manejan correctamente los casos donde `useRewardsData` retorna `data: null`

#### **2. Componentes Modulares - Importaciones Rotas**
```
Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined
```
**Archivos afectados**:
- `shared/ui/components/rewards/__tests__/RewardsHeader.test.tsx`
- `shared/ui/components/rewards/__tests__/RewardsStats.test.tsx` 
- `shared/ui/components/rewards/__tests__/AchievementsGrid.test.tsx`

**Causa raíz**: 
- Componentes no están correctamente exportados como named exports
- Rutas de importación incorrectas en tests
- Conflicto entre ubicaciones: `/shared/ui/components/rewards/` vs `/components/rewards/`

#### **3. Arquitectura Dual Problemática**
**Ubicaciones duplicadas detectadas**:
- `/mobile/shared/ui/components/rewards/RewardsHeader.tsx`
- `/mobile/shared/ui/components/rewards/RewardsStats.tsx`
- `/mobile/components/rewards/RewardsHeader.tsx` 
- `/mobile/components/rewards/RewardsStats.tsx`

**Impacto**: Confusión en rutas de importación y testing

#### **4. Mock de useRewardsData Hook**
**Problema**: Los tests de `RewardsScreen` usan mocks inconsistentes
**Líneas problemáticas**: Tests esperan diferentes estructuras de datos

## Proposed Steps

### **Fase 1: Corrección de Importaciones (CRÍTICO)**
1. Identificar ubicación correcta de componentes modulares
2. Corregir exportaciones named vs default
3. Actualizar rutas de importación en tests
4. Eliminar duplicados arquitecturales

### **Fase 2: Fix de Null Handling (URGENTE)**  
1. Modificar `RewardsScreen.tsx` para manejar `data: null`
2. Actualizar tests para casos edge con datos null
3. Añadir guards para acceso seguro a propiedades

### **Fase 3: Arquitectura Modular (IMPORTANTE)**
1. Consolidar ubicaciones de componentes
2. Establecer estructura única de imports/exports
3. Validar sistema de estilos modular funciona

### **Fase 4: Testing Integration (NECESARIO)**
1. Verificar todos los mocks funcionan correctamente
2. Asegurar cobertura de tests se mantiene
3. Validar navegación y interacciones

## Files to change

### **Archivos con errores críticos:**
- `mobile/screens/RewardsScreen.tsx` - Manejo de null data
- `mobile/screens/__tests__/RewardsScreen.test.tsx` - Tests con datos null
- `mobile/shared/ui/components/rewards/RewardsHeader.tsx` - Exportaciones
- `mobile/shared/ui/components/rewards/RewardsStats.tsx` - Exportaciones  
- `mobile/shared/ui/components/rewards/AchievementsGrid.tsx` - Exportaciones
- `mobile/shared/ui/components/rewards/__tests__/RewardsHeader.test.tsx` - Importaciones
- `mobile/shared/ui/components/rewards/__tests__/RewardsStats.test.tsx` - Importaciones
- `mobile/shared/ui/components/rewards/__tests__/AchievementsGrid.test.tsx` - Importaciones

### **Archivos de configuración:**
- `mobile/jest.config.js` - Paths de módulos si existe
- `mobile/tsconfig.json` - Path mapping si aplica

## Commands to run

```bash
# Ejecutar tests específicos de recompensas
cd /Users/matiasleandrokruk/Documents/DietIntel/mobile
npm test -- --testPathPattern="RewardsScreen|RewardsHeader|RewardsStats|AchievementsGrid"

# Verificar cobertura de recompensas
npm test -- --coverage --testPathPattern="Rewards"

# Ejecutar tests globales para validar
npm test -- --verbose --passWithNoTests

# Limpiar cache de Jest
npm test -- --clearCache

# Verificar imports con TypeScript
npx tsc --noEmit --skipLibCheck
```

## Acceptance criteria

### **Criterios de Éxito:**
- ✅ Todos los tests de recompensas pasando (0 errores)
- ✅ Componentes modulares importando correctamente  
- ✅ Null handling robusto en RewardsScreen
- ✅ Cobertura de tests mantenida (>85%)
- ✅ Arquitectura modular consistente

### **Validaciones Post-Fix:**
```bash
# Tests específicos deben pasar
npm test -- --testPathPattern="RewardsScreen|RewardsHeader|RewardsStats|AchievementsGrid"

# Cobertura debe mantenerse  
npm test -- --coverage --testPathPattern="Rewards"
```

## Rollback plan

### **Si algo falla durante el fix:**
1. **Backup inmediato**: Git stash de cambios
2. **Revertir a estado estable**: `git checkout HEAD~1` si es necesario
3. **Restaurar funcionalidad**: `git stash pop` después de diagnóstico
4. **Recovery específico**: Revisar archivos de logs para contexto

### **Pasos de recuperación:**
```bash
# Backup del estado actual
git stash save "pre-jest-fix-backup"

# Si el fix rompe algo
git checkout HEAD
git stash pop

# Verificar estado funcional
npm test -- --testPathPattern="RewardsScreen"
```

## Additional Context

### **Sistema de Recompensas:**
- Refactor reciente: 1 archivo estilos → 8 módulos modulares
- Objetivo: Cobertura >85% (meta cumplida)
- Arquitectura: Sistema de estilos modular en `/shared/ui/styles/`

### **Historial de Cambios:**
- Fase 1.5: Migración a sistema modular completada
- Tests creados: 39 tests nuevos para componentes modulares
- Cobertura: 100% en sistema de estilos, 75% en RewardsScreen

### **Dependencies:**
- React Native + TypeScript
- Jest + React Native Testing Library  
- Sistema de estilos modular con exports named/default
- Mock del hook `useRewardsData` en tests

## Error Output Samples

### **Error Type 1 - Null Access:**
```
TypeError: Cannot read properties of null (reading 'totalPoints')
    52 |         <View style={styles.statsSection}>
    53 |           <Text style={styles.sectionTitle}>Estadísticas</Text>
  > 54 |           <Text style={styles.statItem}>Puntos Totales: {data.totalPoints}</Text>
       |                                                               ^
```

### **Error Type 2 - Import Invalid:**
```
Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.

Check the render method of `RewardsHeader`.
```

### **Error Type 3 - Text Not Found:**
```
Unable to find an element with text: 5 días

<testID="rewards-stat-current-streak">
  <div>
    🔥
    Racha Actual
  </div>
  <div>
    5  <!-- Renderizado pero test busca "5 días" -->
  </div>
  <div>
    días consecutivos
  </div>
</testID>
```

## Impact Assessment

### **Business Impact:**
- **Funcionalidad**: Sistema de recompensas no puede ser verificado
- **Desarrollo**: Tests fallan impiden CI/CD pipeline
- **QA**: Cobertura reducida en feature crítica

### **Technical Debt:**
- Arquitectura dual confusa
- Manejo inconsistente de null cases
- Mock setup inconsistente entre tests

### **Priority Classification:**
- **P0 - Critical**: Tests fallan, funcionalidad core bloqueada
- **P1 - High**: Import/export errors afectan todos los components
- **P2 - Medium**: Null handling afecta solo edge cases
- **P3 - Low**: Refactoring arquitectural (nice-to-have)

## Success Metrics

### **Before Fix:**
- Test Suites: 4/117 failing (3.4% failure rate)
- Tests: 41/1388 failing (2.95% failure rate)  
- Coverage: Inconsistent across components

### **Target After Fix:**
- Test Suites: 0/117 failing (0% failure rate)
- Tests: 0/1388 failing (0% failure rate)
- Coverage: >85% maintained across all components

### **Validation Commands:**
```bash
# Quick validation
npm test -- --testPathPattern="RewardsScreen|RewardsHeader|RewardsStats|AchievementsGrid"

# Full validation  
npm test -- --passWithNoTests

# Coverage validation
npm test -- --coverage --testPathPattern="Rewards"
```
