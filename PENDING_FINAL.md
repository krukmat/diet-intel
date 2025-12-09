# Pending Final Validation — EPIC A · Historia A2

Las tareas de desarrollo para el flow Follow/Unfollow están completas (migraciones, servicios FastAPI, rutas, lógica web y móvil, suites automatizadas). Falta ejecutar y documentar la validación final cuando el entorno lo permita.

## Validaciones manuales pendientes
- follow/unfollow actualiza contadores correctamente (ver app/web/mobile).
- Soft-fail cuando el target bloquea al follower.
- Rate limit diario (200) devolviendo HTTP 429.
- Botón Follow/Unfollow con feedback en web y mobile.
- Listados followers/following con paginación.
- Eventos `FollowCreated`/`FollowRemoved` registrados en `event_outbox`.

## Comandos restantes
- `NODE_ENV=test npm --prefix webapp run test:profiles` → actualmente falla en este sandbox con `listen EPERM` (Supertest no puede abrir socket). Reejecutar en entorno sin restricción de red ni puertos.
- `npm --prefix webapp install` para descargar `jest-environment-jsdom` desde el registro oficial (bloqueado por red).
- `npm --prefix webapp run lint` / `npm --prefix mobile run lint` según corresponda.

## Notas
- `npm --prefix mobile test -- ProfileScreen` ya pasa (12 tests).
- Backend `python -m pytest tests/social/test_follow_routes.py` pasa (9 tests, avisos de Pydantic v1).
- Documentar resultados y cobertura tras relanzar los comandos.


## A4 Feed – pendientes a revisar
- `/feed` no aparece en `app.routes` (devuelve 404 en tests). Investigar inclusión del router en `main.py`.
- Ajustar asserts en `tests/social/test_feed_ingester.py` (uso de `call.args`, verificación de resultados).
- `tests/social/test_feed_routes.py` sigue recibiendo 404; revisar patch de `auth_service.get_current_user_from_token`.
- Validar `webapp/routes/feed.js` vs backend una vez la API responda 200.

