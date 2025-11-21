# Gamification Reward Catalog (Draft)

Working document for Producto + Gamificación to agree on the definitive points/badge scheme.

| Event Key                     | Today (default) | Propuesta │ Razón │ ¿Badge asociado? │ Observaciones |
|------------------------------|-----------------|-----------|-------|------------------|---------------|
| `post_create`                | 5               |           |       |                  |               |
| `first_post_of_day_bonus`    | 3               |           |       |                  |               |
| `like_received`              | 1 (cap 20)      |           |       |                  | Revisar cap si hay campañas de engagement |
| `comment_made`               | 2 (cap 30)      |           |       |                  |               |
| `follow_gained`              | 2 (cap 10)      |           |       |                  |               |
| `referral_completed`         | 25              |           |       |                  | Confirmar diferencia entre referral vs IA |
| `challenge_completed`        | 15              |           |       |                  |               |
| `reaction_given`             | 1               |           |       |                  |               |
| `badge_earned`               | 3               |           |       |                  | ¿Conviene escalar según rareza?           |
| `intelligent_flow_complete`  | 12              |           |       |                  | Nuevo: IA Food Vision → Recipe AI → Smart Diet |

## Próximos pasos para cerrar catálogo
1. **Definir valores finales**: completar la columna “Propuesta” y documentar las justificaciones. Recordar que `gamification_point_rules` admite overrides por entorno.
2. **Insignias vinculadas**: especificar qué badges se desbloquean por evento / frecuencia (p.ej. 10 flujos IA completados → “Visionary Chef”).
3. **Seeds & migraciones**: una vez aprobadas las reglas, generar seeds para badges en BD y actualizar scripts que pre-pueblen el mapa `gamification_point_rules`.
4. **QA**: preparar casos de prueba donde cada evento se dispare manualmente y verifique puntos + badges en `/gamification` (backend + clientes).
