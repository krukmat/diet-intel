# Plan de Ejecución IA + Gamificación

## Contexto y Alcance
- Rama de trabajo: `ia-gamification-plan`.
- Objetivo: implementar un flujo unificado que combine `Food Vision`, `Recipe AI` y `Smart Diet`, reforzado con gamificación alineada al uso del flujo.
- Exclusiones: refactorizaciones de la red social, cambios de pricing o actualizaciones de modelos IA.

## Supuestos y Dependencias
- Servicios `food_vision`, `recipe_ai` y `smart_diet` ya operativos y accesibles vía la API interna.
- Equipo de producto alinea métricas de gamificación antes del Sprint 2.
- QA cuenta con entornos staging y datasets de prueba para visión/recetas.
- Mobile y web pueden consumir endpoints experimentales (`feature flag` en clientes).

## Roadmap por Sprint (2 semanas cada uno)

### Sprint 1 – Fundamentos Técnicos
**Objetivos**
- Normalizar contratos de datos entre servicios de IA.
- Implementar orquestador backend inicial y observabilidad básica.

**Backlog Clave**
- [x] Crear modelos Pydantic compartidos en `app/models/intelligent_flow.py`.
- [x] Publicar documentación de contratos en `docs/intelligent_flow.md`.
- [x] Construir `app/services/intelligent_flow.py` con encadenamiento síncrono y métricas (latencia, errores).
- [x] Añadir pruebas unitarias del orquestador y fixtures base en `tests/services`.
- [ ] Revisar límites actuales de `FoodVisionService` y tiempos de inferencia para establecer SLAs.

**Entregables**
- [x] Schemas versionados y aprobados por backend/web/mobile.
- [x] Servicio de orquestación funcional detrás de `feature flag` interno.
- [ ] Dashboard temporal en logging/metrics con distribución de latencias por paso.

### Sprint 2 – Exposición de API y Gamificación
**Objetivos**
- Exponer endpoint público controlado por flag.
- Reutilizar gamificación para reaccionar a eventos del flujo IA.

**Backlog Clave**
- [x] Crear `app/routes/intelligent_flow.py` con endpoint `/intelligent-flow`.
- [x] Gestionar latencias pesadas via cola en memoria (`app/services/intelligent_flow_queue.py`).
- [x] Ajustar `app/services/gamification.py` para escuchar eventos del orquestador.
- [ ] Definir catálogo de logros/recompensas con producto y seed de datos si aplica.
- [x] Implementar pruebas de integración (`tests/routes/test_intelligent_flow.py`) y actualizar cobertura de servicios.
- [ ] Coordinar con web y mobile para habilitar flag y probar integración end-to-end (vista móvil lista; falta web y pruebas manuales).

**Entregables**
- [x] Endpoint FastAPI protegido por `feature flag`.
- [x] Eventos gamificados disparados en base al uso real del flujo.
- [ ] Reporte de pruebas manuales con clientes (web/mobile) y resultados de `pytest`.

### Sprint 3 – Endurecimiento y Lanzamiento Controlado
**Objetivos**
- Asegurar calidad, observabilidad y alineación go-to-market.
- Preparar despliegue gradual y métricas de éxito.

**Backlog Clave**
- Ejecutar pruebas completas (`python -m pytest`, `npm --prefix webapp run test:e2e`) y documentar resultados.
- Afinar monitoreo: alertas de latencia, ratio de éxito, métricas de engagement gamificado.
- Revisar costos operativos (CPU/GPU) y ajustar configuraciones de colas/timeouts.
- Preparar guías en `docs/` para soporte y troubleshooting del flujo IA+gamificación.
- Coordinar plan de lanzamiento gradual (beta cerrada → general) con producto/marketing.

**Entregables**
- Checklist de readiness firmado por backend, QA y producto.
- Plan de despliegue escalonado con hitos y métricas de salida.
- Actualización final de documentación para equipos internos.

## Gestión de Riesgos
- **Latencias elevadas:** mitigar con procesamiento asíncrono, caché de resultados recurrentes y timeouts claros.
- **Incentivos mal configurados:** revisar métricas junto a producto semanalmente; ajustar catálogo de logros mediante configuración.
- **Acoplamiento excesivo:** mantener contratos versionados y feature flags para revertir rápidamente.

## Próximos Pasos
1. Validar este plan con producto y liderazgo técnico.
2. Estimar esfuerzo por equipo y asignar owners por historia clave.
3. Configurar tablero (Jira/Trello) con historias del Sprint 1 y dependencias identificadas.
