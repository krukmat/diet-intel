# Arquitectura · Technical Debts & Questions

## EPIC A · Historia A1

### TD-1 · Determinar viewer autorizado en perfiles privados
- **Origen**: `EPIC_A.A1.md` indicaba tratar `viewer_is_follower` como `False` hasta implementar FollowService, lo que impide que el propietario vea sus posts.
- **Pregunta**: ¿Podemos, como mínimo, considerar `viewer_id == user_id` como seguidor implícito?  
- **Bloqueo**: A falta de aclaración, cualquier perfil privado ocultará sus posts incluso al dueño, rompiendo la aceptación.
- **Resolución**: En A1 se trató `viewer_id == user_id` como seguidor implícito y se dejó un stub `FollowGateway.is_following` para A2. Documentado en `EPIC_A.A1.md` (sección Servicios de dominio).

### TD-2 · Identificar userId real en Webapp/Móvil para endpoints `/profiles/me`
- **Origen**: En Express se propo­ne `dietIntelAPI.getProfile('me')`, pero el backend solo expone `/profiles/{user_id}` y no existe sesión establecida.
- **Pregunta**: ¿Qué mecanismo usaremos para descubrir el `user_id` autenticado (token JWT, sesión server-side, llamado previo a `/auth/me`)?  
- **Bloqueo**: El flujo de edición/verificación de perfil propio queda indefinido hasta que se defina este origen de verdad.
- **Resolución**: Webapp y móvil consumen `/auth/me` con el JWT existente para obtener `user.id`; el plan actualiza `webapp/utils/api.js` y `mobile/ApiService` con métodos `getCurrentUser`. Detalle incluido en `EPIC_A.A1.md`.
