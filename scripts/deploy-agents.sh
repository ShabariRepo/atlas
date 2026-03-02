#!/usr/bin/env bash
set -euo pipefail

# Atlas Agent Deployment Script
# Deploys all agents to Bonito using the API

echo "🏔️  Atlas Deploy"
echo "================"
echo ""

# Load env
set -a
source .env 2>/dev/null || true
set +a

BONITO_URL="${BONITO_API_URL:-https://api.getbonito.com}"
API_KEY="${BONITO_API_KEY:-}"

if [ -z "$API_KEY" ]; then
    echo "❌ BONITO_API_KEY not set. Run ./scripts/setup.sh first."
    exit 1
fi

# Helper: deploy a single agent
deploy_agent() {
    local name=$1
    local config_path="agents/$name/config.json"
    local prompt_path="agents/$name/system-prompt.md"

    echo "  Deploying $name..."

    if [ ! -f "$config_path" ]; then
        echo "    ❌ Config not found: $config_path"
        return 1
    fi

    # Read system prompt
    local system_prompt=""
    if [ -f "$prompt_path" ]; then
        system_prompt=$(cat "$prompt_path")
    fi

    # Deploy via Bonito API
    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "${BONITO_URL}/api/v1/agents" \
        -H "Authorization: Bearer ${API_KEY}" \
        -H "Content-Type: application/json" \
        -d @<(jq --arg prompt "$system_prompt" \
            '.agent.system_prompt = $prompt' "$config_path"))

    local http_code
    http_code=$(echo "$response" | tail -1)
    local body
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" =~ ^2 ]]; then
        local agent_id
        agent_id=$(echo "$body" | jq -r '.id // .agent.id // "unknown"')
        echo "    ✅ Deployed (ID: $agent_id)"
    else
        echo "    ❌ Failed (HTTP $http_code)"
        echo "    $body" | head -3
        return 1
    fi
}

# Deploy knowledge base for Docs Assistant
deploy_kb() {
    echo "  Setting up knowledge base..."

    local kb_response
    kb_response=$(curl -s -w "\n%{http_code}" \
        -X POST "${BONITO_URL}/api/v1/knowledge-bases" \
        -H "Authorization: Bearer ${API_KEY}" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "atlas-internal-docs",
            "description": "Internal engineering documentation for Atlas",
            "embedding_model": "text-embedding-3-small"
        }')

    local http_code
    http_code=$(echo "$kb_response" | tail -1)

    if [[ "$http_code" =~ ^2 ]]; then
        echo "    ✅ Knowledge base created"

        # Upload sample docs
        for doc in agents/docs-assistant/sample-docs/*.md; do
            local doc_name
            doc_name=$(basename "$doc")
            echo "    📄 Uploading $doc_name..."
            curl -s -X POST "${BONITO_URL}/api/v1/knowledge-bases/atlas-internal-docs/documents" \
                -H "Authorization: Bearer ${API_KEY}" \
                -H "Content-Type: multipart/form-data" \
                -F "file=@$doc" > /dev/null
        done
        echo "    ✅ Documents uploaded"
    else
        echo "    ⚠️  KB creation returned HTTP $http_code (may already exist)"
    fi
}

echo "Deploying Atlas agents to Bonito..."
echo ""

# Deploy in order: simple agents first, then orchestrator
AGENTS=(
    "incident-responder"
    "code-reviewer"
    "docs-assistant"
    "deploy-monitor"
    "command-center"
)

FAILED=0

# Deploy KB first
deploy_kb
echo ""

for agent in "${AGENTS[@]}"; do
    if ! deploy_agent "$agent"; then
        FAILED=$((FAILED + 1))
    fi
done

echo ""
if [ "$FAILED" -eq 0 ]; then
    echo "✅ All ${#AGENTS[@]} agents deployed successfully."
    echo ""
    echo "Next steps:"
    echo "  1. Configure webhooks (see docs/BONITO-SETUP.md)"
    echo "  2. Test agents: ./scripts/test-agents.sh"
else
    echo "⚠️  $FAILED agent(s) failed to deploy. Check the output above."
fi
