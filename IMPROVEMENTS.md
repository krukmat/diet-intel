# DietIntel - Registro por Foto con Estimación de Porciones

Feature estratégica para reducir fricción de registro y aumentar adherencia mediante visión por computadora e IA.

---

## 📸 Registro por Foto con Estimación de Porciones - Casos de Uso Detallados

Como Product Owner, he definido los siguientes casos de uso para el **Registro por Foto con Estimación de Porciones** basado en el contexto actual del proyecto DietIntel. Esta feature aprovecha la infraestructura OCR existente y se integra perfectamente con Smart Diet, Recipe AI y el sistema de tracking móvil.

### 🎯 Casos de Uso Principales

#### **Caso de Uso 1: Identificación Visual Inteligente** ⭐⭐⭐⭐⭐
   - **Descripción**: Sistema identifica automáticamente ingredientes y estima porciones con alta precisión usando visión AI
   - **Flujo típico**:
     1. Usuario toma foto de cualquier plato de comida
     2. Sistema identifica ingredientes usando visión por computadora
     3. Estima porciones basado en tamaño, volumen y contexto visual
     4. Calcula calorías y macros usando base de datos nutricional
     5. Proporciona análisis nutricional inmediato con gráficos claros
     6. Registra automáticamente en tracking del usuario
   - **Características clave**:
     - Identificación de ingredientes por apariencia visual
     - Estimación volumétrica automática (tamaño plato → gramos)
     - Cálculo preciso de calorías y macronutrientes
     - Análisis visual simple pero informativo
   - **Complejidad técnica**: Media (3-4 semanas)
   - **Tokens LLM promedio**: 800-900 (identificación + análisis)
   - **Valor de negocio**: ⭐⭐⭐⭐⭐ (base de toda la experiencia)

#### **Caso de Uso 2: Insights Nutricionales Educativos con Ejercicio** ⭐⭐⭐⭐⭐
   - **Descripción**: Proporciona análisis nutricional enriquecedor con recomendaciones de ejercicio que complementan objetivos calóricos
   - **Flujo típico**:
     1. Usuario recibe análisis nutricional inmediato de su foto
     2. Sistema calcula balance calórico actual vs objetivos diarios
     3. Muestra gráficos claros de macronutrientes vs objetivos nutricionales
     4. Calcula déficit calórico y sugiere ejercicio complementario
     5. Recomienda actividades físicas específicas (caminar, correr, nadar)
     6. Estima calorías quemadas por tipo de ejercicio y duración
     7. Proporciona contexto educativo sobre calidad nutricional + ejercicio
     8. Integra recomendaciones con Smart Diet existente
   - **Características clave**:
     - Gráficos visuales simples (macros vs objetivos diarios)
     - Consejos educativos contextuales y accionables
     - **Sugerencias de ejercicio sin dispositivos externos**
     - **Cálculo de calorías quemadas por actividad**
     - **Objetivos de ejercicio alcanzables (30-60 min/día)**
     - Integración natural con recomendaciones Smart Diet
     - Seguimiento de progreso nutricional + físico personal
   - **Ejemplos de ejercicio sugerido**:
     - 🚶 **Caminar**: 30-60 min (200-400 kcal quemadas)
     - 🏃 **Correr**: 20-40 min (300-600 kcal quemadas)
     - 🏊 **Nadar**: 30-45 min (250-450 kcal quemadas)
     - 🚴 **Bicicleta**: 40-60 min (300-500 kcal quemadas)
     - 💪 **Ejercicios en casa**: 20-30 min (150-300 kcal quemadas)
   - **Complejidad técnica**: Media (3-4 semanas)
   - **Tokens LLM promedio**: 850-950 (análisis + recomendaciones + ejercicio)
   - **Valor de negocio**: ⭐⭐⭐⭐⭐ (educación integral + adherencia mejorada)

### 🔧 Casos de Uso Secundarios

#### **Caso de Uso 3: Flujo Recipe AI → Tracking** ⭐⭐⭐⭐
   - **Descripción**: Experiencia integrada desde receta generada hasta registro automático en tracking
   - **Flujo típico**:
     1. Usuario genera receta con Recipe AI
     2. Prepara siguiendo instrucciones de la app
     3. Toma foto del resultado final preparado
     4. Sistema reconoce automáticamente la receta específica
     5. Usa datos nutricionales precisos de la receta original
     6. Registra automáticamente en meal plan del día
   - **Características clave**:
     - Reconocimiento automático de recetas preparadas
     - Cálculo preciso basado en receta original
     - Registro one-click en tracking
   - **Complejidad técnica**: Baja-Media (2-3 semanas)
   - **Tokens LLM promedio**: 600-700 (contexto receta reduce análisis)
   - **Valor de negocio**: ⭐⭐⭐⭐ (cierre perfecto del loop receta→tracking)

#### **Caso de Uso 4: Corrección y Aprendizaje Simple** ⭐⭐⭐
   - **Descripción**: Sistema aprende de ajustes simples del usuario para mejorar precisión futura
   - **Flujo típico**:
     1. Usuario ajusta porciones estimadas con controles simples (+/- gramos)
     2. Sistema registra corrección con contexto mínimo
     3. Mejora gradualmente precisión para tipos de comida frecuentes
     4. Reduce necesidad de correcciones futuras
   - **Características clave**:
     - Controles de ajuste simples e intuitivos
     - Aprendizaje basado en correcciones frecuentes
     - Mejora progresiva sin complejidad técnica
   - **Complejidad técnica**: Baja (2-3 semanas)
   - **Tokens LLM promedio**: 400-500 (ajustes simples)
   - **Valor de negocio**: ⭐⭐⭐⭐ (mejora continua con mínima fricción)

### 📊 Nueva Priorización: Simplicidad (Tokens) vs Valor de Negocio

| Caso de Uso | Tokens Promedio | Valor de Negocio | Tiempo Estimado | Prioridad Óptima |
|-------------|-----------------|------------------|----------------|------------------|
| **Caso 3: Flujo Recipe AI** | **600-700** | ⭐⭐⭐⭐ | **2-3 semanas** | **P0 (MVP Core)** |
| **Caso 4: Corrección Simple** | **400-500** | ⭐⭐⭐⭐ | **2-3 semanas** | **P1 (Base UX)** |
| **Caso 1: Identificación Visual** | **800-900** | ⭐⭐⭐⭐⭐ | **3-4 semanas** | **P1 (Core Feature)** |
| **Caso 2: Insights + Ejercicio** | **850-950** | ⭐⭐⭐⭐⭐ | **3-4 semanas** | **P1 (Valor Integral)** |

**Beneficios de la nueva estructura**:
- ✅ **Menos complejidad inicial**: Empezar con casos más simples
- ✅ **Valor inmediato**: Features que dan resultado desde el día 1
- ✅ **Experiencia coherente**: Flujo integrado Recipe AI → Tracking
- ✅ **Aprendizaje progresivo**: Sistema mejora naturalmente con uso

### 🚀 Roadmap Realista y Enfocado

**MVP Core (Semanas 1-3)**: Base funcional sólida
- 🔥 **Caso 3: Flujo Recipe AI → Tracking** (P0) - 600-700 tokens, ⭐⭐⭐⭐ valor
- 🔥 **Caso 4: Corrección y Aprendizaje Simple** (P1) - 400-500 tokens, ⭐⭐⭐⭐ valor

**MVP Extended (Semanas 4-6)**: Experiencia diferenciadora
- 🔥 **Caso 1: Identificación Visual Inteligente** (P1) - 800-900 tokens, ⭐⭐⭐⭐⭐ valor
- 🔥 **Caso 2: Insights Nutricionales + Ejercicio** (P1) - 850-950 tokens, ⭐⭐⭐⭐⭐ valor

**Estrategia de Desarrollo**:
- ✅ **Primero lo más simple**: Empezar con casos de menor complejidad técnica
- ✅ **Valor inmediato**: Recipe AI integration da resultado desde el día 1
- ✅ **Experiencia coherente**: Flujo integrado y natural para el usuario
- ✅ **Escalabilidad inteligente**: Añadir análisis visual cuando la base esté sólida

### 🎯 Métricas de Éxito

**Métricas de Adopción**:
- % de comidas registradas por foto vs manual
- Tiempo promedio de registro por comida
- Retención semanal de usuarios activos

**Métricas de Precisión**:
- Precisión promedio de identificación de ingredientes
- Precisión promedio de estimación de porciones
- % de correcciones necesarias por usuario

**Métricas de Negocio**:
- Aumento en adherencia al plan nutricional
- Incremento en uso de Recipe AI (cierre del loop)
- NPS de la feature específica

### 🔗 Integración con Arquitectura Existente

**Backend Integration**:
- Nueva ruta: `POST /food/vision-log`
- Servicio: `app/services/food_vision.py`
- Modelo: `app/models/food_vision.py`
- Reutiliza: OCR pipeline existente, nutrición database

**Mobile Integration**:
- Nueva pantalla: `VisionLogScreen`
- Cámara: Usa `expo-camera` existente
- Storage: AsyncStorage para modo offline
- UI: Integración con tabs existentes

**Smart Diet Integration**:
- Usa análisis visual para mejorar recomendaciones
- Proporciona contexto adicional para Smart Diet
- Cierra loop de feedback nutricional

Esta definición de casos de uso asegura que el **Registro por Foto** se convierta en la feature estrella que diferencie DietIntel en el mercado, aprovechando al máximo la infraestructura existente y proporcionando valor inmediato a los usuarios.

---

---

## 🎯 Estrategia de Desarrollo Optimizada

### 🔥 Principios de Priorización

**1. Simplicidad Técnica (Tokens)**
- Menos tokens = desarrollo más rápido y predecible
- Mayor simplicidad = menos riesgo de errores
- Iteración más rápida = feedback más temprano

**2. Valor de Negocio Inmediato**
- Features que resuelvan problemas reales de usuarios
- Impacto directo en métricas clave (adherencia, retención)
- Diferenciación competitiva clara

**3. Tiempo vs Complejidad**
- P0: 1-2 semanas (alto valor, baja complejidad)
- P1: 2-3 semanas (valor crítico, complejidad media)
- P2: 3-4 semanas (valor importante, complejidad media-alta)
- P3-P4: 4-6 semanas (valor futuro, alta complejidad)

### 📈 Beneficios de Esta Estrategia

**Para el Desarrollo**:
- ✅ MVP funcional en 2 semanas (vs 4 semanas tradicionales)
- ✅ Menos riesgo de errores por simplicidad
- ✅ Iteración más rápida y feedback temprano
- ✅ Desarrollo más predecible y costos controlados

**Para el Negocio**:
- ✅ Valor inmediato para usuarios
- ✅ Mayor adherencia y retención
- ✅ Diferenciación competitiva clara
- ✅ Cierre de loops importantes (Recipe AI → Tracking)

**Para el Usuario**:
- ✅ **Análisis nutricional educativo**: Insights visuales sobre calidad de comida
- ✅ **Experiencia integrada**: Flujo natural desde Recipe AI hasta análisis
- ✅ **Aprendizaje personalizado**: Sistema que mejora con cada interacción
- ✅ **Valor inmediato**: Resultados accionables desde el primer uso

### 🚦 Métricas de Decisión

**Criterios para P0 (MVP Core)**:
- Tokens: < 800 promedio
- Valor: ⭐⭐⭐⭐ o superior
- Tiempo: 1-2 semanas
- Dependencias: mínimas o existentes

**Criterios para P1 (Insights Premium)**:
- Tokens: 750-850 promedio
- Valor: ⭐⭐⭐⭐⭐ (excepcional)
- Tiempo: 2-3 semanas
- **Impacto educativo**: proporciona insights nutricionales avanzados

**Criterios para P2 (Inteligencia)**:
- Tokens: 600-700 promedio
- Valor: ⭐⭐⭐⭐ o superior
- Tiempo: 3-4 semanas
- **Aprendizaje continuo**: mejora precisión con feedback del usuario

### 📊 Nueva Estructura de Features

**Eliminadas para enfoque**:
- ❌ **Modo Offline**: Complejidad innecesaria para MVP
- ❌ **Reconocimiento Restaurante**: Alcance muy amplio para inicio
- ❌ **Batch Processing**: Feature avanzada, no crítica inicial

**Potenciadas**:
- ✅ **Análisis Visual Completo**: Convertido en feature premium ⭐⭐⭐⭐⭐
- ✅ **Integración Recipe AI**: Base fundamental para experiencia completa
- ✅ **Registro Rápido**: Feature core con máximo impacto en adherencia
- ✅ **Aprendizaje Personalizado**: Inteligencia que mejora con el tiempo

Esta estrategia asegura desarrollo eficiente, valor máximo y riesgo mínimo.

---

---

## 🎯 Experiencia Completa Propuesta

### 🔥 Flujo de Usuario Integrado

**Experiencia Recipe AI → Foto → Tracking**:

1. **Usuario genera receta** con Recipe AI (funcionalidad existente)
2. **Prepara siguiendo instrucciones** de la app
3. **Toma foto del resultado** preparado
4. **Sistema reconoce automáticamente** la receta específica
5. **Calcula nutrición precisa** basada en receta original
6. **Registra automáticamente** en meal plan del día
7. **Proporciona análisis visual** educativo
8. **Aprende de ajustes** para mejorar precisión futura

### 💡 Beneficios de Esta Experiencia

**Para el Usuario**:
- ✅ **Cero fricción**: De receta a tracking en un solo gesto
- ✅ **Precisión garantizada**: Basado en receta conocida vs estimación
- ✅ **Educación integrada**: Aprende sobre nutrición mientras usa
- ✅ **Mejora automática**: Sistema se vuelve más preciso con cada uso

**Para el Negocio**:
- ✅ **Aprovecha infraestructura existente**: Recipe AI ya desarrollado
- ✅ **Cierre de loop perfecto**: De generación a consumo registrado
- ✅ **Diferenciación clara**: Experiencia integrada vs apps fragmentadas
- ✅ **Bajo riesgo técnico**: Empieza con funcionalidades existentes

**Para el Desarrollo**:
- ✅ **Tiempo mínimo**: 2-3 semanas para funcionalidad completa
- ✅ **Tokens optimizados**: 400-700 tokens promedio (más económico)
- ✅ **Dependencias claras**: Se basa en sistemas ya probados
- ✅ **Escalabilidad natural**: Crece orgánicamente con uso

### 🚀 Propuesta de Implementación

**Week 1-2**: Flujo Recipe AI → Tracking + Corrección Simple
- **Mínimo código nuevo**: Aprovechar endpoints existentes
- **Máximo valor**: Feature funcional desde el día 1
- **Bajo riesgo**: Tecnologías y arquitectura conocidas

**Week 3-4**: Análisis Visual Inteligente + Insights Educativos
- **Feature diferenciadora**: Análisis nutricional único en mercado
- **Experiencia premium**: Educación + adherencia mejorada
- **Base sólida**: Construir sobre funcionalidad ya probada

**Week 5-6**: Optimización y expansión
- **Mejora continua**: Basado en feedback real de usuarios
- **Métricas claras**: Validación de impacto en adherencia
- **Iteración inteligente**: Añadir complejidad solo donde genere valor

### 📈 Métricas Esperadas

**Impacto en Adherencia**:
- Aumento 40-60% en registro de comidas vs métodos manuales
- Reducción 50% en tiempo de registro por comida
- Mejora 25-35% en adherencia al plan nutricional

**Impacto Educativo Integral**:
- 70% de usuarios interactúan con insights nutricionales
- 60% engagement con sugerencias de ejercicio complementario
- Aumento en conocimiento nutricional medido por engagement
- Correlación positiva entre análisis visual + ejercicio y adherencia

**Impacto en Actividad Física**:
- % usuarios que siguen sugerencias de ejercicio diarias
- Aumento promedio en actividad física semanal
- Mejora en objetivos de peso/forma física por balance energético
- Tiempo de ejercicio complementario promedio por usuario

**Impacto Técnico**:
- Tiempo de respuesta < 3 segundos para identificación
- Precisión > 80% en identificación de ingredientes comunes
- Reducción progresiva de correcciones necesarias por usuario

Esta experiencia propuesta es **simple pero enriquecedora**, aprovechando al máximo la infraestructura existente mientras proporciona valor diferenciador inmediato.

---

Última actualización: generado automáticamente en base a `README.md` actual.
