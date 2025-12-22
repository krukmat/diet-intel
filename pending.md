# Pending Intelligent Flow & Gamification Work

This log tracks the remaining scope after completing Sprint 1 and the partial execution of Sprint 2 for the IA + Gamificación initiative. Update the same file for subsequent sprints.

## Sprint 2 Gaps
- Background processing para IA pesada: se añadió cola en memoria (`app/services/intelligent_flow_queue.py`), pero falta evaluar opción duradera (Redis/Celery), definir política de reintentos/timeouts y documentar semántica de fallos parciales.
- Reward catalog alignment: Product + Gamificación must agree on point values/badge unlock rules para el nuevo flujo. El backend ya permite overrides vía `gamification_point_rules`, pero falta definir los valores finales, revisar daily caps y diseñar insignias específicas.
- Client feature flags: Mobile y Web cuentan con toggles y vistas beta; falta documentar el flujo para QA y preparar scripts para generar imágenes/base64 de prueba antes de habilitar a usuarios finales.
- End-to-end contract validation: add integration-style tests that exercise the full service stack (not mocks) using fixtures, and capture golden responses to detect regressions once the queue/offloading work lands.
- Monitoring dashboards: configure log/metrics aggregation for `intelligent_flow_*` metrics emitted by `PerformanceMonitor` and define alert thresholds (latency, error rates) per environment.

## Sprint 3 Not Started
- Regression test matrix: run and stabilize full `python -m pytest` (backend coverage) plus `npm --prefix webapp run test:e2e`; plug any gaps revealed by coverage reports or Playwright runs.
- Infrastructure performance tuning: benchmark GPU/CPU usage for chained inference, tune worker pool sizes, and codify resource requirements in deployment manifests/Docker images.
- Support & troubleshooting playbook: author runbooks in `docs/` for common flow failures, including base64 validation issues, third-party model outages, and gamification discrepancies.
- Launch plan execution: define staged rollout (beta cohorts, monitoring checkpoints), craft revert criteria, and coordinate marketing/comms deliverables prior to toggling `intelligent_flow_enabled` in production.
