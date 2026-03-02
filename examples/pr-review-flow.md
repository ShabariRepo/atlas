# Example: PR Review Flow

A developer opens a pull request. Here's what Atlas does.

## The Trigger

GitHub sends a webhook when PR #108 is opened:

```json
{
  "action": "opened",
  "pull_request": {
    "number": 108,
    "title": "Add Redis caching layer for user sessions",
    "user": { "login": "alex-dev" },
    "base": { "ref": "main" },
    "head": { "ref": "feature/redis-sessions" },
    "changed_files": 12,
    "additions": 347,
    "deletions": 42
  }
}
```

## Step 1: Read the Diff

The Code Reviewer connects to GitHub via MCP and reads:

- The full diff (12 files, 347 additions, 42 deletions)
- The full content of modified files (for context beyond the diff)
- The PR description and linked issues

Time: ~1-2 seconds (MCP calls)

## Step 2: Analyze

Using Claude Sonnet for deep reasoning, the agent reviews against its checklist:

### Security Findings

```
🔴 Critical — agents/auth/session_store.py:47

The Redis connection string is constructed from user input without sanitization.
This could allow Redis command injection if `session_prefix` is user-controlled.

suggestion:
session_prefix = sanitize_key(session_prefix)
redis_key = f"session:{session_prefix}:{session_id}"
```

### Performance Findings

```
🟡 Warning — agents/auth/session_store.py:89

`get_all_sessions()` calls `KEYS *` which is O(N) and blocks Redis.
Use `SCAN` for production workloads.

suggestion:
cursor = 0
sessions = []
while True:
    cursor, keys = redis.scan(cursor, match="session:*", count=100)
    sessions.extend(keys)
    if cursor == 0:
        break
```

### Suggestions

```
🔵 Suggestion — config/redis.py:12

Consider adding connection pooling. The current implementation creates
a new connection per request.

suggestion:
pool = redis.ConnectionPool(
    host=REDIS_HOST,
    port=REDIS_PORT,
    max_connections=20,
    decode_responses=True
)
client = redis.Redis(connection_pool=pool)
```

Time: ~8-12 seconds (Claude Sonnet analysis)

## Step 3: Post Review

The agent posts to GitHub via MCP:

**Inline comments** on the specific lines (shown above)

**Summary review:**

```markdown
## Code Review Summary

**Overall:** REQUEST_CHANGES

### Findings
- 🔴 1 critical issue (Redis command injection risk)
- 🟡 1 warning (KEYS * in production)
- 🔵 1 suggestion (connection pooling)

### Key Concerns
The session prefix passed to Redis key construction needs sanitization
to prevent command injection. This must be fixed before merge.

### What Looks Good
Clean separation between session storage and authentication logic.
Good use of TTL for automatic session expiry. Test coverage for the
happy path is solid.
```

## Total Time: ~15 seconds

From PR opened to full review with inline comments.

## Via the Command Center

You can also trigger reviews conversationally:

```
You:    "Review PR #108"

Atlas:  📡 Routing to Code Reviewer...

        [Full review as above]
```

Or ask follow-ups:

```
You:    "Is PR #108 safe to merge?"

Atlas:  📡 Routing to Code Reviewer...

        No. There's an open critical finding (Redis command injection
        in session_store.py:47). The author needs to address the
        REQUEST_CHANGES review before merge.
```
