# Manual Tasks Checklist

Tracking non-code actions required to complete Sprint 2 and unblock Sprint 3.

## Sprint 2 (API + Gamificación)
- [ ] Definir catálogo final de puntos e insignias con Producto/Gamificación (valores por evento, caps adicionales, reglas de badges).
- [ ] Documentar la configuración acordada en `config/gamification_point_rules` y preparar seeds/migraciones si se crean nuevas insignias.
- [ ] Ejecutar pruebas manuales en `webapp` + `mobile` para validar `/intelligent-flow` (sync/async, diferentes imágenes).
- [ ] QA móvil/web conjunto: checklist de pruebas manuales (sync y async), adjuntar capturas/logs y validar telemetría básica.
- [ ] Scripts de soporte para QA: generar base64 desde CLI, automatizar peticiones async y recopilar latencias.

## Sprint 3 (Endurecimiento y Lanzamiento)
- [ ] Diseñar dashboard y alertas para métricas `intelligent_flow_*` (latencias, errores, ratio de completitud).
- [ ] Elaborar runbook de soporte (resolución de fallos de visión, timeouts de Recipe/Smart Diet, inconsistencias de gamificación).
- [ ] Preparar plan de rollout gradual (beta cerrada, cohortes, criterios de salida, rollback).
