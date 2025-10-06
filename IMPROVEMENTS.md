# DietIntel — Propuestas de Features IA con Enfoque de Negocio

Basado en lo documentado en `README.md` y el estado actual del producto (Recipe AI, Smart Diet, OCR, Shopping Lists, Web/Mobile). No se encontró `NEXT_TASK.md`; si existe, al compartirlo ajusto prioridades y alcance al roadmap vigente.

---

## Resumen de complejidad, esfuerzo y tokens

| Feature | Complejidad técnica | Tiempo MVP (persona-semanas) | Tokens LLM promedio por request | Costo relativo (1 = menor) |
|---|---|---|---|---|
| Registro por Foto con Estimación de Porciones | Alta (visión + parsers unificados) | 5 | 850 – 1 100 | 1 |
| Optimizador de Compra con Precios en Vivo | Media-Alta (integración externa + optimización) | 6 | 700 – 900 | 2 |
| Co‑piloto para Nutricionistas/Clínicas | Alta (reglas clínicas + generación multiformato) | 7 | 2 000 – 2 500 | 3 |
| Asistente Glucémico en Tiempo Real | Muy Alta (modelos fisiológicos + integraciones CGM) | 10 | 1 200 – 1 600 | 4 |

---

## 1) Asistente Glucémico en Tiempo Real (CGM‑aware)

- Problema/Valor
  - Reduce picos postprandiales y mejora control glucémico (diabetes, resistencia a la insulina, control de peso).
  - Diferenciación clínica y potencial B2B con aseguradoras/empresas; alto impacto en outcomes y adherencia.
- Capacidades IA
  - Modelo de respuesta glucémica personalizada por alimento/receta/plan (features: macros, fibra, carga glucémica estimada, hora del día, actividad previa, sueño básico si disponible).
  - Scoring de “riesgo de pico” y recomendaciones de ajustes (timing, swaps, porciones, orden de ingesta).
- Aprendizaje continuo con feedback del usuario y datos de CGM (cuando esté disponible).
- Evaluación técnica
  - Complejidad técnica: Muy alta; combina modelado fisiológico, ingestión de señales CGM y personalización de recomendaciones en tiempo casi real.
  - Tiempo estimado MVP: 6–8 semanas (≈10 persona-semanas considerando ciencia de datos + integración backend/frontend).
  - Tokens LLM promedio por request: 1 200 – 1 600 (predicción + explicación generada).
  - Consideraciones clave: requerirá dataset histórico o fase de cold-start con heurísticas; dependencias con APIs de dispositivos de salud.
- Integración técnica (alineada a la arquitectura DietIntel)
  - Backend
    - Rutas: `app/routes/glycemic.py` con endpoints (ver APIs).
    - Servicios: `app/services/glycemic_service.py` (predicción, scoring, explicación), `app/services/glycemic_insights.py` (tendencias/insights).
    - Modelos: `app/models/glycemic.py` (inputs, predicciones, métricas, insights).
    - Cache: Redis TTL diferenciado (predicción 30–60 min, insights 24 h).
  - Móvil/Web
    - Indicador visual de riesgo en recetas/planes; modo “Glucose Coach” para optimización con 1 toque.
    - Integración con Apple Health/Google Fit (actividad, sueño básico) y, en futuro, proveedores CGM. Variables en `.env` (sin credenciales en repo).
- APIs sugeridas
  - `POST /glycemic/predict` → predicción y score por receta/plan/contexto.
  - `GET /glycemic/insights` → tendencias, ventanas de mayor riesgo, consejos.
  - `POST /recipe-ai/optimize?glucose_mode=true` → genera o ajusta recetas con objetivo “picos bajos”.
- Métricas/KPIs
  - ↓ % de eventos de alto riesgo vs baseline; ↓ variabilidad estimada postprandial.
  - ↑ adherencia a plan; uso del “Glucose Coach”; retención 30/60/90 días.
- Monetización
  - Plan Premium “Glucose Coach”; paquetes B2B (licencias/pmPM) con informes.
- Roadmap
  - MVP (4–6 semanas): modelo heurístico + reglas basadas en carga glucémica, fibra y proteína; UI de riesgo; optimización en Recipe AI.
  - V2 (8–12 semanas): personalización con feedback/actividad; insights automáticos; preparación para integrar CGM.
- Riesgos/Compliance
  - No es consejo médico; disclaimers claros; privacidad reforzada (PHI si CGM). Cumplir GDPR/consentimiento.
- Testing
  - Unit y contract tests para `glycemic_service`; `@pytest.mark.integration` para flujos de optimización de receta/plan.

---

## 2) Co‑piloto para Nutricionistas/Clínicas (B2B)

- Problema/Valor
  - Reduce tiempo de armado de plan y reporte clínico; uniformiza criterios; mejora adherencia del paciente.
  - Ingreso B2B por asiento/licencia; diferenciado frente a apps sólo B2C.
- Capacidades IA
  - Resumen de anamnesis/recordatorio 24h/FFQ; sugerencia de plan semanal con intercambios; check de guías (DM2, HTA, dislipemias) y alertas (sodio, grasas saturadas, fibra baja).
- Generación de reporte PDF/HTML para historia clínica con métricas y racionales.
- Evaluación técnica
  - Complejidad técnica: Alta; mezcla procesamiento de lenguaje, reglas clínicas determinísticas y gestión de plantillas multiformato.
  - Tiempo estimado MVP: 5–6 semanas (≈7 persona-semanas entre backend, frontend y UX para profesionales).
  - Tokens LLM promedio por request: 2 000 – 2 500 (resumen de anamnesis + plan personalizado + justificativos).
  - Consideraciones clave: requiere curado de reglas clínicas y validación con expertos externos para asegurar seguridad y cumplimiento.
- Integración técnica
  - Backend
    - Rutas: `app/routes/clinician.py`.
    - Servicios: `app/services/clinical_rules.py` (reglas y chequeos), `app/services/clinician_reports.py` (plantillas PDF/HTML), `app/services/clinician_plans.py` (generación guiada).
    - Modelos: `app/models/clinician.py` (anamnesis, hallazgos, plan, métricas).
    - RBAC: reutilizar roles existentes y añadir “scopes” para endpoints clínicos; opcional rol “Clinician” en una iteración posterior.
  - Web/Mobile
    - Vistas de paciente, generador de plan con intercambios, descarga de reporte. En `webapp/routes/clinician.js` y vistas EJS.
- APIs sugeridas
  - `POST /clinician/plan/generate` → plan semanal con objetivos y restricciones clínicas.
  - `GET /clinician/report/{user_id}` → reporte clínico (HTML/PDF).  
  - `POST /clinician/followup` → pauta de seguimiento y adherencia.
- Métricas/KPIs
  - Tiempo medio por consulta; NPS profesional; adherencia a 30/60/90 días; % alertas clínicas resueltas.
- Monetización
  - Licencias por profesional/organización; onboarding y soporte prioritario.
- Roadmap
  - MVP (4–6 semanas): reglas clínicas base, generador de plan, reporte HTML/PDF simple.
  - V2: analítica de cohortes, plantillas personalizadas por institución, interoperabilidad (export FHIR si aplica).
- Riesgos/Compliance
  - No sustituye juicio clínico; disclaimers; privacidad y seguridad reforzadas en endpoints B2B.
- Testing
  - Suites de reglas clínicas determinísticas; pruebas de generación de reporte; `@pytest.mark.integration` para flujos end‑to‑end.

---

## 3) Optimizador de Compra con Precios en Vivo

- Problema/Valor
  - Ahorra 10–20% del ticket sin perder calidad nutricional; impulsa conversión y retención.
  - Vía de ingresos por afiliación/retail media y diferenciación B2C.
- Capacidades IA
  - Optimización multiobjetivo (costo, calidad macro/micro, desperdicio) con sustituciones por tienda/temporada.
  - Consolidación de listas multi‑receta con estimación de costos y equivalencias.
- Integración técnica
  - Backend
    - Rutas: `app/routes/shopping_optimize.py`.
    - Servicios: `app/services/retail_pricing.py` (agregadores/ofertas), `app/services/shopping_optimizer.py` (modelo coste‑nutrición), `app/services/substitutions.py`.
    - Modelos: `app/models/shopping.py` (ofertas, equivalencias, optimización).
  - WebApp
    - Comparador de ahorro y sustituciones en `webapp/` (p. ej. `webapp/routes/shopping-price.js` y vistas).
  - Config
    - Variables `.env`: `RETAILER_API_URL`, `RETAILER_API_KEY`, `SHOPPING_OPT_WIN_SIZE` (ventana de consolidación), etc.
- APIs sugeridas
  - `POST /recipe-ai/shopping/price-optimize` → optimización de lista con precios/vendedores.
  - `GET /shopping/retailer/{id}/offers` → ofertas sincronizadas por retailer.
- Métricas/KPIs
  - Ahorro medio por usuario/semana; conversión a canasta; tasa de sustitución aceptada; churn↓.
- Monetización
  - Afiliación/CPA, plan Premium “Smart Savings”, bundles familiares.
- Roadmap
  - MVP (4–6 semanas): conector 1–2 retailers (mock o partner), heurística de sustitución + costo; UI comparativa.
  - V2: algoritmo multiobjetivo avanzado, tiempos de entrega, preferencias de marca.
- Riesgos/Compliance
  - Términos de APIs de retailers; manejo de cookies/consentimiento en UI.
- Testing
  - Simulaciones con fixtures de precios, pruebas de consolidación y sustitución; marcas `@pytest.mark.integration`.

---

## 4) Registro por Foto con Estimación de Porciones

- Problema/Valor
  - Reduce fricción de registro → más adherencia; aporta datos para coaching y analítica.
- Capacidades IA
  - Visión por computadora para identificar platos/ingredientes y estimar porciones; combina con OCR y base OpenFoodFacts.
  - Bucle de aprendizaje con feedback del usuario (confirmar/ajustar etiquetas y porciones).
- Integración técnica
  - Backend
    - Rutas: `app/routes/food_vision.py`.
    - Servicios: `app/services/food_vision.py` (inferencia), `app/services/portion_estimator.py` (volumen→gramos), integrando OpenCV/PIL ya presentes.
    - Modelos: `app/models/food_vision.py` (clases detectadas, porciones, confianza, mapeo a nutrimentos).
    - Reutilizar pipeline de OCR: unificar parsers y normalización de unidades.
  - Mobile/Web
    - Carga de foto, bounding boxes, slider de porciones y confirmación; modo offline con caché de inferencias frecuentes.
  - Config
    - `.env`: `VISION_MODEL_PATH`, `ENABLE_EXTERNAL_VISION=false` (si se usa servicio externo como fallback), límites de tamaño.
- APIs sugeridas
  - `POST /food/vision-log` → detecta, estima porción y registra comida.
  - `POST /food/vision/estimate` → sólo estimación (para UI interactiva).
- Métricas/KPIs
  - % comidas registradas por foto; tiempo de registro; retención semanal; precisión percibida (encuestas) y correcciones por el usuario.
- Monetización
  - Plan Premium “Auto‑Log”; bundles con Smart Diet/Recipe AI.
- Roadmap
  - MVP (4–6 semanas): modelo base + heurísticas de porción; UI de confirmación; integración con tracking.
  - V2: mejora de estimación volumétrica y personalización por vajilla/contexto.
- Riesgos/Compliance
  - Variabilidad por iluminación/ángulo; gestionar expectativas y pedir confirmación de usuario.
- Testing
  - Pruebas de inferencia con fixtures de imágenes; validación de pipeline y normalización de unidades.

---

## Priorización sugerida (MVP de 2 frentes)

1) Registro por Foto + Integración con Smart Diet/Recipe AI
- Impacto directo en adherencia; reusa componentes OCR; rápido de validar en B2C.
2) Co‑piloto para Nutricionistas (B2B)
- Abre línea de ingresos B2B; reposiciona la plataforma; usa motores ya existentes (planes/recetas/insights).

Asistente Glucémico y Optimizador de Compra son excelentes 3er/4to frente: el primero requiere integración con salud/CGM y validación clínica; el segundo depende de acuerdos con retailers o mocks sólidos.

---

## Siguientes pasos

- Aprobación de 1–2 features para MVP y definición de KPIs de éxito.
- Diseño de API y contratos (Pydantic) por feature; esqueletos de rutas/servicios/modelos en `app/` conforme a guías del repo.
- Plan de tests: unitarios + `@pytest.mark.integration`; cobertura en `app/` y `webapp/` cuando aplique.
- Revisión de `.env` y secrets; documentación de nuevas variables y dependencias.
- Si se comparte `NEXT_TASK.md`, ajustar alcance y orden al roadmap existente.

---

Última actualización: generado automáticamente en base a `README.md` actual.
