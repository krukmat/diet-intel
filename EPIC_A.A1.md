# EPIC A · Historia A1 — View Profile

Objetivo: entregar la visualización de perfiles sociales conforme a la especificación `A1 View Profile` del documento `specs/dietintel_social_gamification_spec_v1.json`. Las tareas están divididas por capa (backend, webapp, móvil) y **cada paso indica exactamente qué archivo tocar, qué validar y cómo comprobar el resultado**.

> **Notas de arquitectura resueltas**
> - El propietario del perfil siempre debe ver sus publicaciones. Mientras el seguimiento no esté implementado (A2), tratamos `viewer_id == user_id` como seguidor implícito y dejamos un TODO para validar seguidores reales.
> - Los clientes (web y móvil) obtienen el `user_id` autenticado consumiendo `/auth/me`. La webapp usa el middleware `requireAuth/checkAuth` existente y la app móvil agrega un método `getCurrentUser` en sus servicios para reutilizar esa respuesta.

---

## Backend (FastAPI)

### 1. Migraciones y modelo de datos
1. Crear el archivo `database/init/014_create_social_tables.sql` (usar siguiente número libre en la carpeta). Copiar este contenido base:
   ```sql
   CREATE TABLE IF NOT EXISTS user_profiles (
       user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       handle TEXT UNIQUE NOT NULL,
       bio TEXT,
       avatar_url TEXT,
       visibility TEXT NOT NULL CHECK (visibility IN ('public', 'followers_only')),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE IF NOT EXISTS profile_stats (
       user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       followers_count INTEGER NOT NULL DEFAULT 0,
       following_count INTEGER NOT NULL DEFAULT 0,
       posts_count INTEGER NOT NULL DEFAULT 0,
       points_total INTEGER NOT NULL DEFAULT 0,
       level INTEGER NOT NULL DEFAULT 0,
       badges_count INTEGER NOT NULL DEFAULT 0,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE INDEX IF NOT EXISTS idx_user_profiles_handle ON user_profiles(handle);
   ```
   - No agregar más columnas ni índices en esta historia.
   - Confirmar que no exista `014_*.sql` previo. Si ya está usado, utilizar el siguiente número incremental.
2. Abrir `app/services/database.py` y dentro del método `init_database`:
   - Localizar la sección de creación de tablas.
   - Después del bloque `users`, añadir bloques `cursor.execute(...)` para `user_profiles` y `profile_stats` replicando el esquema SQL del paso anterior (usar triple comillas).
   - Añadir también la creación del índice `idx_user_profiles_handle` usando `cursor.execute("CREATE INDEX IF NOT EXISTS ...")`.
   - Seguir el patrón existente (no romper el orden ni los comentarios).

### 2. Modelos Pydantic
1. Crear directorio `app/models/social` si no existe (asegúrate de añadir `__init__.py` vacío).
2. En `app/models/social/profile.py` definir:
   - `class ProfileVisibility(str, Enum)` con valores `PUBLIC = "public"` y `FOLLOWERS_ONLY = "followers_only"`.
   - `class ProfileStats(BaseModel)` con campos `followers_count`, `following_count`, `posts_count`, `points_total`, `level`, `badges_count` (todos `int` con `Field(..., ge=0)`).
   - `class PostPreview(BaseModel)` **solo para esta historia** con propiedades `post_id: str`, `text: str`, `media: list[dict] = Field(default_factory=list)`, `created_at: datetime`, `counters: dict[str, int]`.
   - `class ProfileDetail(BaseModel)` con:
     - `user_id: str`
     - `handle: str`
     - `bio: Optional[str]`
     - `avatar_url: Optional[str]`
     - `visibility: ProfileVisibility`
     - `stats: ProfileStats`
     - `posts: list[PostPreview]`
     - `posts_notice: Optional[str] = None`
3. Exportar las clases en `app/models/social/__init__.py` para uso desde otros módulos.

### 3. Servicios de dominio
1. Crear directorio `app/services/social` (con `__init__.py`).
2. Archivo `app/services/social/post_read_service.py`:
   - Implementar clase `PostReadService` con método `list_recent_posts(user_id: str, limit: int = 10) -> list[PostPreview]`.
   - El método debe retornar `[]` y usar `logger.warning("PostReadService.list_recent_posts not implemented")`.
   - Añadir singleton simple `post_read_service = PostReadService()`.
3. Archivo `app/services/social/gamification_gateway.py`:
   - Crear clase `GamificationGateway` con método `get_profile_counters(user_id: str) -> dict[str, int]` devolviendo `{"points_total": 0, "level": 0, "badges_count": 0}` y log de advertencia.
   - Exponer instancia `gamification_gateway = GamificationGateway()`.
4. Archivo `app/services/social/follow_gateway.py`:
   - Crear clase `FollowGateway` con método `is_following(follower_id: str, followee_id: str) -> bool`.
   - Por ahora devolver siempre `False` y registrar warning `FollowGateway.is_following stub`. Añadir `TODO` indicando que A2 reemplazará la lógica.
   - Exponer instancia `follow_gateway = FollowGateway()`.
5. Archivo `app/services/social/profile_service.py`:
   - Implementar clase `ProfileService`.
   - Inyectar dependencias en constructor (`database_service`, `post_read_service`, `gamification_gateway`, `follow_gateway`).
   - Métodos obligatorios:
     1. `ensure_profile_initialized(user_id: str, handle: Optional[str] = None)`:
        - Comprobar si existe registro en `user_profiles`. Si no, crear fila con `handle` (`handle` obligatorio -> usar email local-part en minúsculas reemplazando caracteres no alfanuméricos por `_`), visibilidad `public`.
        - Insertar también fila en `profile_stats`.
     2. `get_profile(user_id: str, viewer_id: Optional[str]) -> ProfileDetail`:
        - `ensure_profile_initialized` al inicio.
        - Recuperar perfil + stats en una sola conexión (usar `JOIN` o dos queries).
        - Obtener contadores adicionales desde `gamification_gateway.get_profile_counters`.
        - Obtener posts `posts = post_read_service.list_recent_posts(user_id, limit=10)`.
        - Determinar si el viewer puede ver posts:
          - `viewer_is_owner = viewer_id is not None and viewer_id == user_id`.
          - `viewer_is_follower = follow_gateway.is_following(viewer_id, user_id)` cuando `viewer_id` no es `None` (el stub actual siempre retorna `False`, dejar `TODO`).
          - Si `visibility == followers_only` y **no** se cumple `viewer_is_owner` ni `viewer_is_follower`, establecer `posts = []` y `posts_notice = "Follow to see posts"`.
        - Devolver instancia `ProfileDetail`.
     3. `update_profile(user_id: str, payload: ProfileUpdatePayload)` (definir payload en mismo archivo o en `app/models/social/profile.py`):
        - Validar `handle` con regex `^[a-z0-9_]{3,30}$` (usar `re.fullmatch`).
        - Verificar unicidad consultando `user_profiles` (SELECT COUNT(*) WHERE handle=:handle AND user_id != :user_id`).
        - Limitar `bio` a 280 caracteres (lanzar `HTTPException(status_code=422, detail="Bio too long")` si excede).
        - Actualizar campos enviados (`bio`, `handle`, `avatar_url`, `visibility`) y `updated_at`.
   - Exponer instancia global `profile_service = ProfileService(database_service, post_read_service, gamification_gateway, follow_gateway)`.

### 4. Esquemas de solicitud/respuesta
1. En `app/models/social/profile.py`, añadir:
   - `class ProfileUpdateRequest(BaseModel)` con campos opcionales `handle`, `bio`, `avatar_url`, `visibility` (usar `ProfileVisibility`).
   - `class ProfileResponse(ProfileDetail)` si se requiere versión pública (evitar sobrescribir la lógica del servicio).

### 5. Rutas FastAPI
1. Crear archivo `app/routes/profile.py` con router `router = APIRouter(prefix="/profiles", tags=["profiles"])`.
2. Implementar endpoints:
   - `GET /profiles/me`:
     - Requiere autenticación (`Depends(get_current_user)` ya existente en módulo `app.services.auth`).
     - Retornar `profile_service.get_profile(current_user.id, current_user.id)` para garantizar visibilidad de posts propios.
   - `GET /profiles/{user_id}`:
     - Usar dependencia opcional `get_current_user_optional` si existe; en caso contrario crear helper local que devuelva `Optional[User]`.
     - Calcular `viewer_id = current_user.id` si hay usuario autenticado.
     - Llamar `profile_service.get_profile(user_id, viewer_id)`.
   - `PATCH /profiles/me`:
     - Requiere autenticación.
     - Validar request con `ProfileUpdateRequest`.
     - Llamar a `profile_service.update_profile`.
     - Retornar el perfil actualizado reutilizando `profile_service.get_profile(current_user.id, current_user.id)`.
   - `GET /profiles/{user_id}/followers` y `/following`:
     - **Para A1** devolver lista vacía con mensaje `{"items": [], "next_cursor": null}` y añadir comentario `TODO: implementar en A2`.
3. Añadir import y registro en `main.py` justo después de `auth_router`:  
   ```python
   from app.routes.profile import router as profile_router
   ...
   app.include_router(profile_router, tags=["profiles"])
   ```

### 6. Feature flag
1. Abrir `app/config.py` y añadir:
   - Campo `social_enabled: bool = Field(default=True)` dentro de la clase `Config`.
2. Crear `app/utils/feature_flags.py` con función `assert_feature_enabled(flag_name: str)` que lea `config.social_enabled`. Si `False`, lanzar `HTTPException(status_code=404)`.
3. En cada endpoint sensible (`GET /profiles/{user_id}`, `PATCH /profiles/me`) llamar `assert_feature_enabled("social_enabled")` al inicio.

### 7. Pruebas automatizadas
1. Crear carpeta `tests/social/`.
2. Archivo `tests/social/test_profile_routes.py` con casos:
   - `test_get_public_profile_returns_default_values`.
   - `test_get_private_profile_hides_posts_for_anonymous`.
   - `test_get_private_profile_returns_posts_for_owner`.
   - `test_update_profile_validates_handle_format`.
   - Para base de datos, usar fixtures existentes (`tests/fixtures`). Si falta fixture para crear usuario rápido, añadir en `tests/fixtures/social.py`.
3. Ejecutar `python -m pytest tests/social/test_profile_routes.py` y documentar el resultado en la historia (no subir evidencia aún).

---

## Webapp (Express)

### 1. Cliente API
1. Editar `webapp/utils/api.js`:
   - Añadir métodos que acepten opcionalmente un JWT para cabecera `Authorization`:
     ```js
     async getProfile(userId, authToken) {
       const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
       const response = await this.client.get(`/profiles/${userId}`, { headers });
       return response.data;
     }

     async updateProfile(profileData, authToken) {
       const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
       const response = await this.client.patch('/profiles/me', profileData, { headers });
       return response.data;
     }
     
     async getCurrentUser(authToken) {
       const response = await this.client.get('/auth/me', {
         headers: { Authorization: `Bearer ${authToken}` }
       });
       return response.data;
     }
     ```
   - No modificar métodos existentes. Colocar funciones nuevas justo después de métodos similares (por ejemplo, tras `getMealPlan`).

### 2. Router Express
1. Crear archivo `webapp/routes/profiles.js`:
   - Importar `express`, crear `router`, y requerir los middlewares `checkAuth` y `requireAuth` de `webapp/middleware/auth`.
   - Registrar primero las rutas estáticas antes de `/:userId` para evitar colisiones.
   - Endpoint `GET /me/edit` (usa `requireAuth`):
     - Tomar `const currentUser = res.locals.currentUser` y `const token = req.cookies.access_token`.
     - Obtener perfil propio llamando `dietIntelAPI.getProfile(currentUser.id, token)`.
     - Renderizar vista `profiles/edit`.
   - Endpoint `POST /me` (usa `requireAuth`):
     - Validar campos (`handle`, `bio`, `visibility`) con `express-validator`.
     - Recuperar `const token = req.cookies.access_token` y llamar `dietIntelAPI.updateProfile(body, token)`.
     - Redirigir a `/profiles/${currentUser.id}` al terminar.
   - Endpoint `GET /:userId` (usa `checkAuth` para disponer de usuario actual opcional):
     - Obtener `const token = req.cookies.access_token` (puede ser `undefined` si no hay login).
     - Invocar `dietIntelAPI.getProfile(req.params.userId, token)`.
     - Pasar a la vista `profiles/show` junto con `res.locals.currentUser` y flag `canEdit = res.locals.currentUser?.id === req.params.userId`.
2. Registrar router en `webapp/app.js`:
   ```js
   const profilesRouter = require('./routes/profiles');
   app.use('/profiles', profilesRouter);
   ```
   - Insertar registro junto a otros `app.use`.

### 3. Vistas
1. Crear directorio `webapp/views/profiles`.
2. Archivo `webapp/views/profiles/show.ejs`:
   - Mostrar avatar (`<img>`), handle (`@handle`), bio.
   - Mostrar stats (usar lista `<ul>` con números).
   - Renderizar posts en `<section>`; si `posts` vacío y llega `posts_notice`, mostrar `<p class="notice"><%= posts_notice %></p>`.
3. Archivo `webapp/views/profiles/edit.ejs`:
   - Formulario con campos `handle`, `bio`, `visibility` (select con opciones `public`, `followers_only`), botón submit.
4. Asegurarse de incluir enlaces de navegación de regreso al dashboard.

### 4. Estilos y scripts
1. Si existe `webapp/public/stylesheets/main.css`, añadir bloques `.profile-card`, `.profile-stats`, `.profile-posts`. Si no existe, crear archivo y registrarlo (link en `layout.ejs`).
2. (Opcional) Añadir script `webapp/public/js/profile.js` para mejorar UX (p.ej. contado de caracteres de bio). Comentar que es opcional.

### 5. Pruebas
1. Archivo `webapp/tests/profiles.test.js`:
   - Mockear `dietIntelAPI.getProfile` y `dietIntelAPI.updateProfile`.
   - Verificar escenarios:
     - Perfil privado sin seguimiento muestra `Follow to see posts`.
     - Ruta `/profiles/me/edit` usa `res.locals.currentUser.id` y renderiza formulario con datos correctos.
2. Ejecutar `npm --prefix webapp run test -- profiles` y guardar resultado.

---

## Mobile (React Native)

### 1. Servicios API
1. Abrir `mobile/services/ApiService.ts`:
   - Añadir métodos `getProfile(userId: string)`, `updateProfile(data: ProfileUpdateRequest)` y `getCurrentUser()` (este último debe hacer `return this.get('/auth/me')`).
   - Reutilizar `ApiClient.getInstance().request` con verbos `GET` y `PATCH`.
   - Definir tipos en `mobile/types/profile.ts` (nuevo archivo) con interfaces `ProfileDetail`, `ProfileStats`, `PostPreview`.

### 2. Contexto / Estado
1. Crear `mobile/contexts/ProfileContext.tsx`:
   - Exportar `ProfileContext` con estado `{ profile: ProfileDetail | null, refreshProfile: () => Promise<void> }`.
   - En `refreshProfile`, llamar primero `ApiService.getCurrentUser()` para obtener `user.id`, luego `ApiService.getProfile(user.id)`.
   - Manejar loading/error y exponer helpers `isOwner(profileUserId: string)` para reutilizar en UI.

### 3. Pantallas
1. Crear `mobile/screens/ProfileScreen.tsx`:
   - Usar contexto para cargar datos (`useEffect` llama `refreshProfile()`).
   - Renderizar avatar (componente `Image`), handle, bio, stats (usar `View` y `Text`), posts (por ahora lista vacía / mensaje).
   - Si `posts_notice`, mostrar `Text` con aviso.
2. Crear `mobile/screens/ProfileEditScreen.tsx`:
   - Formulario controlado con campos `handle`, `bio`, `visibility`.
   - Botón `Guardar` que llama `ApiService.updateProfile` y luego `refreshProfile`.

### 4. Navegación
1. Si el proyecto usa React Navigation (ver `mobile/src`), registrar nuevas pantallas en el stack principal:
   ```ts
   <Stack.Screen name="Profile" component={ProfileScreen} />
   <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
   ```
2. Añadir botón en la pantalla home/drawer que navegue a `Profile`.

### 5. Estilos
1. Crear/actualizar archivo de estilos (por ejemplo `mobile/styles/profileStyles.ts`) con estilos básicos para avatar, títulos y estadísticas.

### 6. Pruebas
1. Archivo `mobile/__tests__/ProfileScreen.test.tsx`:
   - Mockear `ApiService` para devolver perfil público/privado.
   - Verificar render de estadísticas y mensaje `Follow to see posts`.
   - Asegurar que `ApiService.getCurrentUser` se invoque antes de `ApiService.getProfile` (usar expectativas de jest).
2. Ejecutar `npm --prefix mobile test -- ProfileScreen`.

---

---

## TODO LIST - IMPLEMENTACIÓN EPIC A · HISTORIA A1

### Backend (FastAPI)
- [ ] 1.1 Crear migración database/init/014_create_social_tables.sql con tablas user_profiles, profile_stats e índice
- [ ] 1.2 Agregar creación de tablas en app/services/database.py método init_database
- [ ] 2.1 Crear directorio app/models/social con __init__.py
- [ ] 2.2 Crear app/models/social/profile.py con ProfileVisibility, ProfileStats, PostPreview, ProfileDetail, ProfileUpdateRequest
- [ ] 2.3 Exportar clases en app/models/social/__init__.py
- [ ] 3.1 Crear directorio app/services/social con __init__.py
- [ ] 3.2 Crear app/services/social/post_read_service.py con PostReadService y singleton
- [ ] 3.3 Crear app/services/social/gamification_gateway.py con GamificationGateway y singleton
- [ ] 3.4 Crear app/services/social/follow_gateway.py con FollowGateway y singleton
- [ ] 3.5 Crear app/services/social/profile_service.py con ProfileService completo
- [ ] 5.1 Crear app/routes/profile.py con todos los endpoints especificados
- [ ] 5.2 Agregar import y registro del router en main.py
- [ ] 6.1 Agregar feature flag social_enabled en app/config.py
- [ ] 6.2 Crear app/utils/feature_flags.py con assert_feature_enabled
- [ ] 7.1 Crear tests/social/test_profile_routes.py con todos los casos especificados

### Webapp (Express)
- [ ] 1.1 Agregar métodos getProfile, updateProfile, getCurrentUser en webapp/utils/api.js
- [ ] 2.1 Crear webapp/routes/profiles.js con todos los endpoints especificados
- [ ] 2.2 Registrar router en webapp/app.js
- [ ] 3.1 Crear directorio webapp/views/profiles
- [ ] 3.2 Crear webapp/views/profiles/show.ejs con avatar, handle, bio, stats, posts
- [ ] 3.3 Crear webapp/views/profiles/edit.ejs con formulario completo
- [ ] 4.1 Agregar estilos .profile-card, .profile-stats, .profile-posts en webapp/public/stylesheets/main.css
- [ ] 4.2 Crear webapp/public/js/profile.js opcional para UX
- [ ] 5.1 Crear webapp/tests/profiles.test.js con tests especificados

### Mobile (React Native)
- [ ] 1.1 Agregar métodos getProfile, updateProfile, getCurrentUser en mobile/services/ApiService.ts
- [ ] 1.2 Definir tipos en mobile/types/profile.ts
- [ ] 2.1 Crear mobile/contexts/ProfileContext.tsx con estado y refreshProfile
- [ ] 3.1 Crear mobile/screens/ProfileScreen.tsx con renderizado completo
- [ ] 3.2 Crear mobile/screens/ProfileEditScreen.tsx con formulario controlado
- [ ] 4.1 Registrar pantallas Profile y ProfileEditScreen en navegación
- [ ] 4.2 Agregar botón de navegación en pantalla home/drawer
- [ ] 5.1 Crear mobile/styles/profileStyles.ts con estilos básicos
- [ ] 6.1 Crear mobile/__tests__/ProfileScreen.test.tsx con tests especificados

### Validación final
- [ ] Validación Backend: `python -m pytest tests/social/test_profile_routes.py`
- [ ] Validación Webapp: `npm --prefix webapp run test -- profiles`
- [ ] Validación Mobile: `npm --prefix mobile test -- ProfileScreen`
- [ ] Documentar resultados y capturas necesarias en la historia antes de cerrarla

---

## IMPLEMENTACIÓN EN PROGRESO

*Tokens usados en desarrollo: 0 tokens*

## Validación final
- Backend: `python -m pytest tests/social/test_profile_routes.py`.
- Webapp: `npm --prefix webapp run test -- profiles`.
- Mobile: `npm --prefix mobile test -- ProfileScreen`.
- Documentar resultados y capturas necesarias en la historia antes de cerrarla.
