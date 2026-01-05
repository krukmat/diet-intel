# External Agent Guidelines Applied

Se revisaron guías de agentes externas para identificar políticas reutilizables que aplican en este repositorio. Estas son las pautas que hemos adoptado y documentado aquí:

## Instrucciones reutilizadas de AGENTS.md
1. **Planificación documentada**: cada sprint de cobertura cuenta con un archivo en `plan/` que detalla objetivos, módulos y comandos ejecutados (fiel a la instrucción de guardar artefactos en `planning/`).
2. **Pruebas antes de finalizar el cambio**: ejecutamos `python -m pytest` con reportes de cobertura como parte del cierre, tal como se recomienda correr `pytest` antes de un commit.
3. **DRY/TDD/token-optimizado**: mantenemos tests específicos por módulo usando datos controlados y reusando fixtures para evitar repetición; la documentación generada explica por qué existen los tests (no son solo para "subir cobertura").
4. **ERP (enterprise readiness)**: documentamos rutas cambiadas y comandos en el plan, siguiendo el espíritu de registrar artefactos y pasos de QA antes de cerrar un branch importante.

## Instrucciones reutilizadas de guías externas
1. **Comandos de test consistentes**: ejecutamos `.venv/bin/pytest` equivalente (`python -m pytest`) para mantener la paridad con el flujo solicitado por Claude.
2. **TDD y control de historias**: cada nueva prueba fue escrita mirando primero la funcionabilidad a cubrir (ver documento de cobertura) y luego el comportamiento, en línea con la filosofía de "escribir test, verlo fallar, implementarlo, verlo pasar".
3. **Seguimiento de artefactos**: además del plan, mantenemos los reportes de cobertura actualizados (`coverage.json`, `coverage.xml`) para permitir validaciones posteriores, como se recomienda conservar snapshots y documentos.

Esta integración se mantendrá viva actualizando este documento cuando se incorporen nuevas pautas externas que sí apliquen a nuestra base de código, manteniendo un único punto de referencia para los desarrolladores.
