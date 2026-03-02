# Redis Caching Strategy

> **Last updated:** 2025-01-15  
> **Owner:** Platform Team  
> **Status:** Active

## Overview

We use Redis as our primary caching layer across all services. Redis runs as a managed cluster (AWS ElastiCache) with read replicas in each availability zone.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌──────────────┐
│  Service  │────▶│  Redis   │────▶│  PostgreSQL  │
│           │◀────│  Cluster │     │  (fallback)  │
└──────────┘     └──────────┘     └──────────────┘
                   │       │
              ┌────┘       └────┐
              ▼                 ▼
         ┌─────────┐     ┌─────────┐
         │ Replica  │     │ Replica  │
         │ (us-e-1a)│     │ (us-e-1b)│
         └─────────┘     └─────────┘
```

## Configuration

### Connection

```yaml
redis:
  host: ${REDIS_HOST}           # ElastiCache primary endpoint
  port: 6379
  password: ${REDIS_PASSWORD}
  tls: true
  db: 0
  pool_size: 20
  connect_timeout: 5s
  read_timeout: 3s
  write_timeout: 3s
```

### Key Naming Convention

All Redis keys must follow this pattern:

```
{service}:{entity}:{identifier}:{suffix}
```

Examples:
- `api:user:12345:profile` — User profile cache
- `api:user:12345:sessions` — Active sessions
- `catalog:product:sku-abc:details` — Product details
- `auth:ratelimit:ip:10.0.0.1` — Rate limit counter

### TTL Guidelines

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| User sessions | 24 hours | Balance between UX and security |
| API responses | 5 minutes | Keep data fresh for API consumers |
| Product catalog | 1 hour | Changes infrequently, high read volume |
| Rate limit counters | 1 minute | Sliding window rate limiting |
| Feature flags | 30 seconds | Quick propagation of flag changes |
| Computed aggregations | 15 minutes | Expensive to recompute, tolerant of staleness |

## Caching Patterns

### Cache-Aside (Default)

Use this for most cases:

```python
def get_user(user_id: str) -> User:
    # 1. Check cache
    cached = redis.get(f"api:user:{user_id}:profile")
    if cached:
        return User.from_json(cached)

    # 2. Cache miss — fetch from DB
    user = db.users.find_one(user_id)
    if user is None:
        return None

    # 3. Populate cache
    redis.setex(
        f"api:user:{user_id}:profile",
        ttl=86400,  # 24 hours
        value=user.to_json()
    )
    return user
```

### Write-Through

Use for data where consistency matters:

```python
def update_user(user_id: str, updates: dict) -> User:
    # 1. Update DB
    user = db.users.update_one(user_id, updates)

    # 2. Update cache immediately
    redis.setex(
        f"api:user:{user_id}:profile",
        ttl=86400,
        value=user.to_json()
    )
    return user
```

### Cache Stampede Prevention

For expensive computations, use distributed locks:

```python
def get_expensive_data(key: str) -> dict:
    cached = redis.get(key)
    if cached:
        return json.loads(cached)

    # Acquire lock to prevent stampede
    lock = redis.lock(f"lock:{key}", timeout=10)
    if lock.acquire(blocking_timeout=5):
        try:
            # Double-check after acquiring lock
            cached = redis.get(key)
            if cached:
                return json.loads(cached)

            # Compute and cache
            data = expensive_computation()
            redis.setex(key, ttl=900, value=json.dumps(data))
            return data
        finally:
            lock.release()
```

## Monitoring

### Key Metrics to Watch

- **Cache hit rate**: Target > 95%. Alert if < 90%.
- **Memory usage**: Alert at 80% capacity. Scale at 85%.
- **Connection count**: Alert if approaching `maxclients`.
- **Eviction rate**: Non-zero evictions mean you need more memory or shorter TTLs.
- **Latency (p99)**: Should be < 5ms. Investigate if > 10ms.

### Dashboard

Redis metrics are available on Grafana: `https://grafana.internal/d/redis-overview`

## Troubleshooting

### High Memory Usage

1. Check for missing TTLs: `redis-cli --bigkeys`
2. Look for key namespaces consuming disproportionate memory
3. Review TTL guidelines above — something might be cached too long
4. Consider enabling `maxmemory-policy: allkeys-lru` if not already set

### High Latency

1. Check for slow commands: `redis-cli SLOWLOG GET 10`
2. Look for `KEYS *` patterns (use `SCAN` instead)
3. Check network latency between service and Redis
4. Verify you're reading from replicas for read-heavy workloads

### Connection Exhaustion

1. Check pool size across all service instances: `total_instances × pool_size`
2. Verify connections are being returned to the pool (no leaks)
3. Increase `maxclients` if needed (default: 10000)
