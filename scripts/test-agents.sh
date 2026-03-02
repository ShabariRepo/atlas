#!/usr/bin/env bash
set -euo pipefail

# Atlas Agent Test Suite
# Sends sample requests to each deployed agent and validates responses

echo "🏔️  Atlas Test Suite"
echo "==================="
echo ""

# Load env
set -a
source .env 2>/dev/null || true
set +a

BONITO_URL="${BONITO_API_URL:-https://api.getbonito.com}"
API_KEY="${BONITO_API_KEY:-}"

if [ -z "$API_KEY" ]; then
    echo "❌ BONITO_API_KEY not set."
    exit 1
fi

PASSED=0
FAILED=0
TOTAL=0

# Helper: test an agent
test_agent() {
    local agent_id=$1
    local test_name=$2
    local message=$3
    local expect_contains=$4

    TOTAL=$((TOTAL + 1))
    printf "  %-50s " "$test_name"

    local response
    response=$(curl -s -X POST "${BONITO_URL}/api/v1/agents/${agent_id}/chat" \
        -H "Authorization: Bearer ${API_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"message\": \"$message\"}" \
        --max-time 30 2>/dev/null || echo '{"error": "timeout"}')

    local reply
    reply=$(echo "$response" | jq -r '.reply // .message // .content // .error // "no response"' 2>/dev/null || echo "parse error")

    if echo "$reply" | grep -qi "$expect_contains"; then
        echo "✅"
        PASSED=$((PASSED + 1))
    else
        echo "❌"
        echo "    Expected to contain: $expect_contains"
        echo "    Got: $(echo "$reply" | head -1 | cut -c1-100)"
        FAILED=$((FAILED + 1))
    fi
}

# ── Incident Responder Tests ──────────────────────────────

echo "Incident Responder:"

test_agent "atlas-incident-responder" \
    "Triage a P1 alert" \
    "There's a critical alert: API gateway returning 500 errors to all users. Error rate is 15%." \
    "P1\|critical\|severity"

test_agent "atlas-incident-responder" \
    "Low severity classification" \
    "We're seeing some increased log noise from the batch processor. No user impact." \
    "P3\|P4\|low\|minor"

echo ""

# ── Code Reviewer Tests ───────────────────────────────────

echo "Code Reviewer:"

test_agent "atlas-code-reviewer" \
    "Security review request" \
    "Review this code: password = request.args.get('password'); db.execute(f'SELECT * FROM users WHERE pass={password}')" \
    "injection\|security\|critical\|sanitiz"

test_agent "atlas-code-reviewer" \
    "Performance review" \
    "Review this: for user in users: orders = db.query(f'SELECT * FROM orders WHERE user_id={user.id}')" \
    "N+1\|performance\|loop\|query"

echo ""

# ── Docs Assistant Tests ──────────────────────────────────

echo "Docs Assistant:"

test_agent "atlas-docs-assistant" \
    "Runbook question" \
    "How do I configure Redis caching?" \
    "redis\|cache\|config"

test_agent "atlas-docs-assistant" \
    "Deploy process question" \
    "What's our deploy process?" \
    "deploy\|pipeline\|merge\|release"

echo ""

# ── Deploy Monitor Tests ──────────────────────────────────

echo "Deploy Monitor:"

test_agent "atlas-deploy-monitor" \
    "Deploy status query" \
    "What's the status of the latest production deploy?" \
    "deploy\|production\|status"

test_agent "atlas-deploy-monitor" \
    "DORA metrics request" \
    "Show me our DORA metrics for this week" \
    "DORA\|frequency\|lead time\|failure rate"

echo ""

# ── Command Center Tests ──────────────────────────────────

echo "Command Center (Bonobot):"

test_agent "atlas-command-center" \
    "Routes to Incident Responder" \
    "There's a P1 alert on the auth service" \
    "incident\|alert\|triage\|responder"

test_agent "atlas-command-center" \
    "Routes to Code Reviewer" \
    "Review PR #42 please" \
    "review\|PR\|code"

test_agent "atlas-command-center" \
    "Routes to Docs Assistant" \
    "How do I configure Redis caching?" \
    "docs\|documentation\|redis"

test_agent "atlas-command-center" \
    "Routes to Deploy Monitor" \
    "What's the status of prod?" \
    "deploy\|production\|status"

echo ""

# ── Summary ───────────────────────────────────────────────

echo "==================="
echo "Results: $PASSED/$TOTAL passed"

if [ "$FAILED" -gt 0 ]; then
    echo "⚠️  $FAILED test(s) failed"
    exit 1
else
    echo "✅ All tests passed"
fi
