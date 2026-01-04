# CODEx Handoff: UI Consistency & Information Architecture (Mobile)

## Rol
Product Owner. El objetivo es simplificar y unificar la interfaz móvil para que la experiencia sea consistente y fácil de entender.

## Contexto actual (fuente: `App.tsx` + `screens/`)
- La navegación es manual (estado `currentScreen`) y hay una barra extensa de botones en `App.tsx`.
- Hay solapamientos de funcionalidades:
  - `DiscoverFeedScreen` vs `FeedScreen`.
  - `SmartDietScreen` vs `RecommendationsScreen`.
  - `VisionLogScreen` vs `UploadLabel` vs scanner principal en `App.tsx`.
- La nomenclatura es inconsistente ("Smart Diet", "Recommendations", "Recipe AI", "Vision").
- Algunas pantallas usan `onBackPress` y otras usan `useNavigation`, lo que rompe el patrón.

## Objetivo principal
Reorganizar la interfaz en un set reducido de áreas consistentes (tabs) y alinear flujos y nomenclatura. Priorizar claridad del usuario final y reducir la fragmentación.

## Alcance solicitado
- Diseñar una IA (Information Architecture) clara y consistente.
- Proponer navegación unificada (tabs + stacks) y renombre lógico.
- Definir qué pantallas se agrupan y qué se considera duplicado.
- Entregar un mapa de navegación y una lista de acciones concretas para implementar.

## No objetivos
- No rehacer la UI visual completa.
- No cambiar la lógica de negocio si no es estrictamente necesario.
- No reescribir toda la app; priorizar cambios mínimos con impacto.

## Propuesta de IA (5 pilares, mínimo de pantallas)
1. **Inicio**
   - Resumen diario + accesos rápidos.
   - Debe reemplazar el scanner como home.

2. **Log / Registrar**
   - Unifica captura: barcode scanner + foto/label + visión como modos en una sola pantalla.
   - Mantener solo un flujo adicional: tracking.
   - Pantallas actuales: scanner en `App.tsx`, `UploadLabel`, `VisionLogScreen`, `TrackScreen`.

3. **Plan**
   - Solo lo esencial: plan y recomendaciones.
   - Pantallas: `PlanScreen`, `SmartDietScreen` (renombrar a "Recomendaciones").
   - `ShoppingOptimizationScreen` y `TastePreferencesScreen` pasan a backlog (ROI a validar).

4. **Mis Recetas (incluye Explorar)**
   - Un único hub integrado en una sola ventana con selector interno.
   - Pantalla base: `DiscoverFeedScreen` con modo “Explorar / Mis Recetas”.
   - `RecipeDetailScreen` se muestra como modal/overlay.
   - `RecipeHomeScreen`, `RecipeSearchScreen`, `RecipeGenerationScreen` pasan a backlog (ROI a validar).

5. **Perfil / Ajustes**
   - Una sola pantalla con edición inline.
   - Mantener: `ProfileScreen` (editar en el mismo screen).
   - `ProfileEditScreen` pasa a backlog (ROI a validar).
   - Configuración secundaria dentro de Perfil como secciones colapsables.

## Nomenclatura sugerida
- "Smart Diet" → "Recomendaciones".
- "Recipe AI / Recipes" → "Recetas".
- "Vision / Upload Label" → "Foto / Scanner".
- "Discover" → "Mis Recetas" (con modo interno "Explorar").

## Mapa de navegación propuesto
### Tabs principales
- **Inicio**
- **Log** (CTA central opcional)
- **Plan**
- **Mis Recetas**
- **Perfil**

### Stacks sugeridos (mínimos)
- **Inicio** → HomeSummary
- **Log** → Scanner (modos: barcode/foto/vision) → Track
- **Plan** → PlanScreen → Recomendaciones (SmartDiet)
- **Mis Recetas** → Hub unico (Explorar / Mis Recetas + modal detalle)
- **Perfil** → ProfileScreen (Settings inline)

### Diagrama (texto, mínimo)
```
Tabs
├─ Inicio
│  └─ HomeSummary
├─ Log
│  ├─ Scanner (modos)
│  └─ Track
├─ Plan
│  ├─ Plan
│  ├─ Recomendaciones
├─ Mis Recetas
│  └─ Hub (Explorar / Mis Recetas + RecipeDetail modal)
└─ Perfil
   └─ Profile (Settings inline)
```

## Tareas concretas para el agente
1. Preparar un diagrama de navegación (tab + stack).
2. Proponer cambios mínimos en `App.tsx` para migrar a tabs (o una fase intermedia con router central).
3. Definir una tabla de equivalencias (screen actual → nuevo lugar).
4. Listar duplicados y decisión: fusionar o desactivar.
5. Definir contrato de navegación (responsabilidad por tab, flujos principales y manejo de back).
6. Proponer plan de implementación por fases (mínimo 2 fases).

## Plan por fases (enfoque arquitectonico y minimo)
### Fase 1: Definicion de IA y contrato de navegacion
- Confirmar tabs finales: Inicio, Log, Plan, Mis Recetas, Perfil.
- Definir el contrato de navegacion por tab: flujos, entradas, y reglas de back.
- Acordar que "Mis Recetas" es un hub unico con selector interno y detalle modal.
- Fijar decisiones de backlog por ROI y documentar dependencias.

### Fase 2: Estructura base de navegacion
- Implementar navegacion por tabs con stacks minimos.
- Centralizar el control de navegacion (remover logica dispersa en `App.tsx`).
- Definir un patron unico de header/back para todas las pantallas activas.

### Fase 3: Consolidacion de pantallas
- Crear el Hub de "Mis Recetas" con modos "Explorar" y "Mis Recetas".
- Integrar `RecipeDetailScreen` como modal/overlay dentro del hub.
- Unificar `SmartDietScreen` y `RecommendationsScreen` en una sola pantalla de Recomendaciones.
- Consolidar `UploadLabel` y `VisionLogScreen` como modos dentro de Log.

### Fase 4: Simplificacion funcional y limpieza
- Retirar o feature-flag de pantallas fuera del set minimo (Search/Generation/Social/etc.).
- Mover ajustes secundarios dentro de Perfil (secciones colapsables).
- Revisar estados vacios, errores y cargas para coherencia.

## Mapa de responsabilidades por tab
### Inicio
- **Proposito**: Resumen diario y acceso rapido a acciones clave.
- **Contenido**: Insights generales, KPIs esenciales, CTA principal hacia Log.
- **Reglas**: No duplicar flujos completos; solo entry points.

### Log
- **Proposito**: Registro de datos (barcode/foto/vision/track).
- **Contenido**: Scanner multimodo + tracking en la misma area.
- **Reglas**: Un solo flujo de captura; evitar pantallas paralelas.

### Plan
- **Proposito**: Decisiones y recomendaciones accionables.
- **Contenido**: Plan diario + Recomendaciones (SmartDiet consolidado).
- **Reglas**: No incluir recetas ni discovery aqui.

### Mis Recetas
- **Proposito**: Descubrir y gestionar recetas propias.
- **Contenido**: Hub unico con modos "Explorar" y "Mis Recetas" + detalle modal.
- **Reglas**: Un solo lugar para explorar y gestionar recetas.

### Perfil
- **Proposito**: Identidad, preferencias y configuracion.
- **Contenido**: Perfil + ajustes en secciones colapsables.
- **Reglas**: Evitar flujos largos; todo inline o modal ligero.

## Criterios de aceptación
- La app tiene 5 áreas consistentes, fácilmente explicables.
- Ninguna funcionalidad clave se pierde; solo se reorganiza.
- Navegación coherente (un único patrón para back/headers).
- Nomenclatura consistente en UI y rutas internas.
- Documento con mapa de navegación + listado de pantallas.

## Referencias técnicas
- `App.tsx` maneja la navegación actual.
- `screens/` contiene las pantallas principales.
- `components/` contiene modales y utilidades de UI que hoy viven en `App.tsx`.

---

## MÉTRICAS Y EVALUACIÓN DE ÉXITO
Nota: KPIs y estimaciones son hipótesis iniciales y deben validarse con datos reales.

### KPIs Cuantificables
- **Reducción de complejidad**: Eliminar mínimo 30% de pantallas duplicadas
- **Tiempo de navegación**: Reducir tiempo promedio para encontrar funcionalidades en 40%
- **Consistencia de nomenclatura**: 100% de pantallas con nombres consistentes
- **Retención de usuarios**: Mantener >95% de usuarios activos post-migración
- **Performance**: No degradar tiempo de carga de pantallas en >10%

### Métricas de Implementación por Fase
- **Fase 1**: 100% de pantallas mapeadas y nomenclatura definida
- **Fase 2**: Navegación por tabs funcional sin pérdida de features
- **Fase 3**: 80% de pantallas duplicadas consolidadas
- **Fase 4**: 100% de componentes UI unificados
- **Fase 5**: 0 rutas obsoletas y documentación completa

---

## ESTIMACIÓN DE ESFUERZO Y TIMELINE
Nota: rangos de esfuerzo y tiempo son aproximaciones y deben recalibrarse con el equipo.

### Fase 1: Alineación de IA sin refactor profundo (Semana 1-2)
**Esfuerzo**: 16-24 horas
- Definir tablas de equivalencia: 4-6 horas
- Normalizar nomenclatura: 2-4 horas
- Preparar documentación técnica: 4-6 horas
- Análisis de duplicados: 6-8 horas

### Fase 2: Migración de navegación base (Semana 3-4)
**Esfuerzo**: 20-32 horas
- Implementar tabs + stacks: 12-16 horas
- Reubicar scanner: 4-6 horas
- Mover settings a Perfil: 4-6 horas
- Configurar rutas alias: 2-4 horas

### Fase 3: Consolidación de pantallas duplicadas (Semana 5-6)
**Esfuerzo**: 16-28 horas
- Unificar SmartDiet/Recommendations: 6-8 horas
- Elegir DiscoverFeed vs FeedScreen: 4-6 horas
- Consolidar Vision/Upload/Scanner: 6-10 horas
- Testing de flujos consolidados: 4-4 horas

### Fase 4: Pulido y consistencia visual (Semana 7-8)
**Esfuerzo**: 12-20 horas
- Unificar headers/back pattern: 6-8 horas
- Extraer componentes UI base: 4-8 horas
- Estados empty/loading/error: 2-4 horas

### Fase 5: Limpieza técnica (Semana 9-10)
**Esfuerzo**: 8-16 horas
- Remover rutas obsoletas: 4-6 horas
- Validar analytics: 2-4 horas
- Documentar flujos: 2-6 horas

**Total estimado**: 72-120 horas (3-6 semanas con 1-2 desarrolladores)

---

## ESTRATEGIA DE TESTING Y QA

### Plan de Testing por Fase
#### Fase 1: Testing de Documentación
- **Unit Tests**: Validación de mapeo de pantallas
- **Integration Tests**: Verificación de flujos existentes
- **Documentation Review**: Validación técnica por PO/UX

#### Fase 2: Testing de Navegación
- **E2E Tests**: Navegación entre tabs y stacks
- **Regression Tests**: Funcionalidades existentes
- **Cross-platform Testing**: iOS/Android consistency

#### Fase 3: Testing de Consolidación
- **Feature Tests**: Cada pantalla consolidada
- **Data Migration Tests**: Estado y persistencia
- **User Journey Tests**: Flujos completos de usuario

#### Fase 4: Testing Visual
- **Visual Regression Tests**: Screenshots comparison
- **Component Tests**: Componentes UI unificados
- **Accessibility Tests**: Navegación y headers

#### Fase 5: Testing de Limpieza
- **Performance Tests**: Bundle size, memoria, navegación
- **Analytics Tests**: Tracking de eventos
- **Documentation Tests**: Validación de docs finales

### Herramientas de Testing Recomendadas
- **Jest**: Unit tests de componentes
- **Detox**: E2E testing móvil (opcional si se incorpora al repo)
- **Storybook**: Testing visual de componentes (opcional si se incorpora al repo)
- **Screenshots comparison**: Visual regression (opcional si se incorpora al repo)

---

## PLAN DE ROLLBACK Y MITIGACIÓN DE RIESGOS

### Riesgos Identificados y Mitigaciones

#### Riesgo Alto: Pérdida de funcionalidades críticas
**Probabilidad**: Media | **Impacto**: Alto
**Mitigación**:
- Feature flags para rollback rápido
- Testing exhaustivo antes de cada fase
- Backup de estados de navegación
- **Plan de rollback**: Revertir a commit anterior + flag de feature toggle

#### Riesgo Medio: Performance degradation
**Probabilidad**: Media | **Impacto**: Medio
**Mitigación**:
- Performance budgets en CI
- Monitoreo continuo durante implementación
- **Rollback**: Optimizaciones específicas revertidas

#### Riesgo Medio: Confusión de usuarios con nueva navegación
**Probabilidad**: Alta | **Impacto**: Medio
**Mitigación**:
- Gradual rollout (10% → 50% → 100%)
- Tooltips/onboarding para nueva navegación
- **Rollback**: Feature flag por segmento de usuarios

#### Riesgo Bajo: Inconsistencias de datos
**Probabilidad**: Baja | **Impacto**: Alto
**Mitigación**:
- Testing de migración de datos
- Validación de estado global
- **Rollback**: Sincronización de estado manual

### Estrategia de Rollback por Fase
1. **Fase 1-2**: Rollback inmediato (feature flags)
2. **Fase 3**: Rollback con datos migrados (manual intervention)
3. **Fase 4**: Rollback visual (styles/theme/component rollback)
4. **Fase 5**: Rollback completo (git revert + data sync)

---

## ESPECIFICIDAD TÉCNICA DETALLADA

### Implementación de Navegación
```typescript
// Configuración de tabs + stacks sugerida
const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: true,
      tabBarStyle: { backgroundColor: '#fff' }
    }}
  >
    <Tab.Screen name="Inicio" component={HomeStack} />
    <Tab.Screen name="Log" component={LogStack} />
    <Tab.Screen name="Plan" component={PlanStack} />
    <Tab.Screen name="Mis Recetas" component={MisRecetasStack} />
    <Tab.Screen name="Perfil" component={ProfileStack} />
  </Tab.Navigator>
);

// Stack example
const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="HomeSummary" component={HomeSummaryScreen} />
    <Stack.Screen name="QuickActions" component={QuickActionsScreen} />
  </Stack.Navigator>
);
```

### Estructura de Componentes Base Unificados
```typescript
// Componentes UI base a extraer
interface BaseComponents {
  Card: typeof CardComponent;
  SectionHeader: typeof SectionHeaderComponent;
  PrimaryButton: typeof PrimaryButtonComponent;
  SecondaryButton: typeof SecondaryButtonComponent;
  LoadingState: typeof LoadingComponent;
  EmptyState: typeof EmptyComponent;
  ErrorState: typeof ErrorComponent;
}
```

### Configuración de Alias de Pantallas (estado actual)
```typescript
// Alias temporales entre nombres actuales y el nuevo esquema Tab/Stack.
const screenAliases = {
  recommendations: 'Plan/Recomendaciones',
  'discover-feed': 'Mis Recetas/Explorar',
  vision: 'Log/VisionLog',
  upload: 'Log/UploadLabel',
  recipes: 'Mis Recetas/Explorar',
};
```

---

## ANÁLISIS DE IMPACTO EN UX

### Estrategia de Migración de Usuarios
1. **Comunicación previa** (1 semana antes):
   - Email informativo sobre mejoras
   - In-app banner explicativo
   - FAQ sobre nueva navegación

2. **Onboarding gradual** (primera semana):
   - Tooltips en nueva navegación
   - Tours guiados opcionales
   - Botón "versión anterior" temporal

3. **Feedback loop** (primeras 2 semanas):
   - In-app feedback widget
   - Analytics de uso intensivo
   - Hotfixes rápidos para fricciones

### Métricas de UX Post-Implementación
- **Task completion rate**: >90% en funcionalidades principales
- **Time to complete**: Comparación pre/post implementación
- **Error rate**: Reducción en navegación errónea
- **User satisfaction**: Survey NPS >7/10

---

## MATRIZ DE DECISIÓN PARA PANTALLAS DUPLICADAS

### Criterios de Priorización
| Criterio | Peso | SmartDiet | Recommendations | FeedScreen | DiscoverFeed |
|----------|------|-----------|-----------------|------------|--------------|
| Uso actual (30%) | 30% | 8/10 | 6/10 | 7/10 | 9/10 |
| Features únicas (25%) | 25% | 9/10 | 7/10 | 5/10 | 8/10 |
| Complejidad migración (20%) | 20% | 6/10 | 8/10 | 9/10 | 7/10 |
| Valor estratégico (15%) | 15% | 9/10 | 6/10 | 6/10 | 8/10 |
| Consistencia naming (10%) | 10% | 5/10 | 9/10 | 8/10 | 7/10 |
| **Total ponderado** | **100%** | **7.4** | **7.0** | **7.1** | **8.0** |

### Decisiones Resultantes
1. **SmartDiet vs Recommendations**: Mantener SmartDiet (renombrar a "Recomendaciones")
2. **FeedScreen vs DiscoverFeed**: Mantener DiscoverFeed (mejor puntuación)
3. **VisionLog vs UploadLabel vs Scanner**: Consolidar bajo "Log" con prioridad al scanner

---

## CONSIDERACIONES DE PERFORMANCE

### Impacto Esperado en Performance (supuestos, validar con mediciones)
- **Bundle size**: +5-8% por nueva librería de navegación
- **Memoria**: +2-4% por stacks adicionales
- **Tiempo de carga**: +100-200ms inicial por tab initialization

### Optimizaciones Propuestas
1. **Lazy loading** de stacks no activos
2. **Memoization** de componentes de navegación
3. **Code splitting** por tab
4. **Preloading** estratégico de stacks frecuentes

### Benchmarks de Performance (placeholders)
- **Cold start**: <2.5s (actual: TBD)
- **Tab switch**: <200ms (actual: TBD)
- **Memory footprint**: <150MB (actual: TBD)

---

## ESTRATEGIA DE DATOS Y ESTADO

### Manejo de Estado de Navegación
```typescript
// Estado global de navegación propuesto
interface NavigationState {
  currentTab: 'inicio' | 'log' | 'plan' | 'descubrir' | 'perfil';
  currentStack: string;
  history: NavigationHistory[];
  preferences: {
    defaultTab: string;
    lastVisitedScreen: string;
  };
}
```

### Sincronización de Estado Durante Migración
1. **Persistencia**: AsyncStorage para navegación state
2. **Migración**: Script de migración para estados existentes
3. **Validación**: Verificación de integridad post-migración
4. **Rollback**: Restauración de estado anterior si falla

### Estrategias de Persistencia
- **Tab activo**: AsyncStorage + Redux persist
- **Stack position**: Navigation state + deep linking
- **User preferences**: AsyncStorage + default fallbacks

---

## TABLA DE EQUIVALENCIAS DETALLADA (mínimo)

### Mapping Actual → Nuevo
| Pantalla Actual | Nuevo Tab/Stack | Estado | Notas |
|----------------|-----------------|--------|-------|
| `App.tsx` (scanner home) | Log → Scanner | Migrar | El home deja de ser scanner |
| `DiscoverFeedScreen` | Mis Recetas → Hub (modo Explorar) | Mantener | Base del hub integrado |
| `FeedScreen` | Mis Recetas → Hub (modo Explorar) | Consolidar | Deprecar o fusionar |
| `SmartDietScreen` | Plan → Recomendaciones | Mantener | Renombrar en UI |
| `RecommendationsScreen` | Plan → Recomendaciones | Consolidar | Fusionar en SmartDiet |
| `PlanScreen` | Plan → Plan | Mantener | Core plan |
| `ShoppingOptimizationScreen` | Backlog | Deprecar | ROI a validar |
| `TastePreferencesScreen` | Backlog | Deprecar | ROI a validar |
| `TrackScreen` | Log → Track | Mantener | Registro de tracking |
| `UploadLabel` | Log → Scanner (modo) | Consolidar | Integrar como modo |
| `VisionLogScreen` | Log → Scanner (modo) | Consolidar | Integrar como modo |
| `VisionHistoryScreen` | Log → Track (historial) | Consolidar | Integrar como sección |
| `RecipeHomeScreen` | Backlog | Deprecar | ROI a validar |
| `RecipeSearchScreen` | Backlog | Deprecar | ROI a validar |
| `RecipeGenerationScreen` | Backlog | Deprecar | ROI a validar |
| `RecipeDetailScreen` | Mis Recetas → Hub (modal detalle) | Consolidar | Modal/overlay |
| `MyRecipesScreen` | Mis Recetas → Hub (modo Mis Recetas) | Consolidar | Selector interno |
| `IntelligentFlowScreen` | Plan → IntelligentFlow | Mantener | Flujo IA de optimizacion |
| `ProfileScreen` | Perfil → Profile | Mantener | Perfil |
| `ProfileEditScreen` | Backlog | Deprecar | Edición inline en Profile |
| `FollowersListScreen` | Backlog | Deprecar | Social fuera del MVP |
| `FollowingListScreen` | Backlog | Deprecar | Social fuera del MVP |
| `BlockedListScreen` | Backlog | Deprecar | Social fuera del MVP |
| `BlockedByScreen` | Backlog | Deprecar | Social fuera del MVP |
| `LoginScreen` | Auth → Login | Mantener | Fuera de tabs |
| `RegisterScreen` | Auth → Register | Mantener | Fuera de tabs |
| `SplashScreen` | Auth → Splash | Mantener | Fuera de tabs |
| `ApiConfigModal` | Perfil → Settings/ApiConfig | Mover | Solo si developer mode |
| `DeveloperSettingsModal` | Perfil → Settings/Developer | Mover | Solo si developer mode |
| `LanguageSwitcher` | Perfil → Settings/Language | Mover | Integrar en Profile |
| `ReminderSnippet` | Backlog | Deprecar | ROI a validar |
| `ProductDetail` | Log → Scanner/ProductDetail | Mantener | Overlay post-scan |
| `HomeSummary` (nuevo) | Inicio → HomeSummary | Nuevo | Basarse en resumen de datos existentes |
