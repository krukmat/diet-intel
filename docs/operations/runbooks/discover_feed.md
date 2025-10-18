# Discover Feed Runbook

_Last updated: 18 Oct 2025_

## 1. Emergencies

### 1.1 Limpiar caché de Discover Feed
1. Abrí consola Python en el entorno del backend:
   ```python
   from app.services.social import discover_feed_service
   discover_feed_service._discover_cache.clear()
   ```
2. Confirmá en logs que los próximos requests ya no son `cache_hit`.

### 1.2 Resetear rate limiter local
1. En la misma consola Python:
   ```python
   from app.routes import feed as feed_routes
   feed_routes.discover_rate_limiter.reset()
   ```
2. Verificá que nuevas solicitudes no devuelvan `429`.

## 2. Métricas y observabilidad

| Métrica | Fuente | Acción |
|---------|--------|--------|
| `discover_feed_requests` | `performance_monitor` (api_call) | Validar volumen por superficie (`metadata.surface`). |
| `duration_ms` (p95/p99) | `performance_monitor` export | Alertar si > 800 ms. |
| `cache_hit` ratio | `metadata.cache_hit` | Objetivo ≥ 60 %. Analizar si baja drásticamente. |
| `FeedEvent.DiscoverFeedServed` | `event_outbox` | Auditar payload (`rank_score`, `reason`). |
| `discover_feed_mobile_requests` | React Native logging / analytics | Observar consumo por superficie móvil.

### 2.1 Exportar métricas
```python
from app.services.performance_monitor import performance_monitor
metrics_json = performance_monitor.export_metrics(hours=1)
```

## 3. Diagnóstico rápido

1. **Errores 429** → revisar `feed_routes.discover_rate_limiter`.
2. **Items vacíos inesperados** → revisar `_fetch_candidate_posts` y `_apply_filters` (bloqueos/reportes).
3. **Latencia alta** → verificar `cache_hit` en logs y en métricas.
4. **Eventos faltantes** → revisar `event_outbox` y logs `discover_feed_event_failed`.

## 4. Configuración operativa

| Configuración | Ubicación | Notas |
|---------------|-----------|-------|
| `discover_feed_rate_per_min` | `app/config.py` | Cambiá el valor y reiniciá el servicio. |
| `discover_feed.cache_ttl_seconds` | `app/config.py` | Ajustá TTL de caché. |
| Pesos de ranking (`weights`) | `app/config.py` | Ajuste fino de señales (fresh vs engagement). |

## 5. Escalado y rendimiento

- **Caché**: aumentar `cache_ttl_seconds` si la base de usuarios es alta y el ranking no cambia rápido.
- **DB**: asegurate de tener índices en `posts.created_at`, `post_reactions.post_id`, `post_comments.post_id`.
- **Rate limit**: Reducí `discover_feed_rate_per_min` temporalmente ante “storms” de tráfico.
- **Precomputación**: Si las métricas muestran latencia sostenida > 800 ms, considerar tareas batch que alimenten una tabla materializada.

## 6. Checklist de troubleshooting

1. ¿La API responde 200 con items?  
2. ¿`cache_hit` se mueve dentro de los límites esperados?  
3. ¿Existen eventos `FeedEvent.DiscoverFeedServed` recientes?  
4. ¿El rate limiter está configurado correctamente para el rollout?
5. ¿Docs y pesos en `config` coinciden con el plan de experimentos?
6. ¿La app móvil muestra Discover (tabs responden, scroll infinito, selector de surface)?
