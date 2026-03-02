#!/usr/bin/env bash
set -euo pipefail

# Atlas Agent Deployment Script
# Deploys all agents to Bonito using the API

echo "🏔️  Atlas Deploy"
echo "================"
echo ""

# Load env
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

BONITO_URL="${BONITO_API_URL:-https://api.getbonito.com}"
AUTH_TOKEN="${BONITO_AUTH_TOKEN:-}"

# ── Authentication ──────────────────────────────────────────
# If no token provided, login with email/password
if [ -z "$AUTH_TOKEN" ]; then
    BONITO_EMAIL="${BONITO_EMAIL:-}"
    BONITO_PASSWORD="${BONITO_PASSWORD:-}"

    if [ -z "$BONITO_EMAIL" ] || [ -z "$BONITO_PASSWORD" ]; then
        echo "🔐 No auth token found. Please provide credentials."
        read -rp "  Email: " BONITO_EMAIL
        read -rsp "  Password: " BONITO_PASSWORD
        echo ""
    fi

    echo "🔐 Logging in..."
    LOGIN_RESPONSE=$(curl -s -X POST "${BONITO_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\": \"${BONITO_EMAIL}\", \"password\": \"${BONITO_PASSWORD}\"}")

    AUTH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')

    if [ -z "$AUTH_TOKEN" ]; then
        echo "❌ Login failed: $(echo "$LOGIN_RESPONSE" | jq -r '.error.message // "Unknown error"')"
        exit 1
    fi
    echo "✅ Logged in."
    echo ""
fi

AUTH_HEADER="Authorization: Bearer ${AUTH_TOKEN}"
PROJECT_ID="${BONITO_PROJECT_ID:-}"

# ── Find or Create Project ──────────────────────────────────
find_or_create_project() {
    if [ -n "$PROJECT_ID" ]; then
        return
    fi

    echo "📁 Finding or creating project..."
    local projects
    projects=$(curl -s -H "$AUTH_HEADER" "${BONITO_URL}/api/projects")

    # Response is an array
    PROJECT_ID=$(echo "$projects" | jq -r '.[0].id // empty' 2>/dev/null)

    if [ -z "$PROJECT_ID" ]; then
        local create_response
        create_response=$(curl -s -X POST "${BONITO_URL}/api/projects" \
            -H "$AUTH_HEADER" \
            -H "Content-Type: application/json" \
            -d '{"name": "Atlas DevOps", "description": "AI-Powered DevOps Command Center"}')

        PROJECT_ID=$(echo "$create_response" | jq -r '.id // empty')

        if [ -z "$PROJECT_ID" ]; then
            echo "❌ Failed to create project: $(echo "$create_response" | jq -r '.error.message // .')"
            exit 1
        fi
        echo "  ✅ Created project: Atlas DevOps ($PROJECT_ID)"
    else
        local project_name
        project_name=$(echo "$projects" | jq -r '.[0].name')
        echo "  ✅ Using project: $project_name ($PROJECT_ID)"
    fi
    echo ""
}

# ── Deploy Knowledge Base ───────────────────────────────────
deploy_kb() {
    echo "📚 Setting up knowledge base..."

    local kb_response
    kb_response=$(curl -s -w "\n%{http_code}" \
        -X POST "${BONITO_URL}/api/knowledge-bases" \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "atlas-internal-docs",
            "description": "Internal engineering documentation for Atlas",
            "source_type": "upload",
            "embedding_model": "auto",
            "chunk_size": 512,
            "chunk_overlap": 50
        }')

    local http_code
    http_code=$(echo "$kb_response" | tail -1)
    local kb_body
    kb_body=$(echo "$kb_response" | sed '$d')

    if [[ "$http_code" =~ ^2 ]]; then
        KB_ID=$(echo "$kb_body" | jq -r '.id')
        echo "  ✅ Knowledge base created ($KB_ID)"

        # Upload sample docs
        if [ -d "agents/docs-assistant/sample-docs" ]; then
            for doc in agents/docs-assistant/sample-docs/*.md; do
                [ -f "$doc" ] || continue
                local doc_name
                doc_name=$(basename "$doc")
                echo "  📄 Uploading $doc_name..."
                curl -s -X POST "${BONITO_URL}/api/knowledge-bases/${KB_ID}/documents" \
                    -H "$AUTH_HEADER" \
                    -F "file=@$doc" > /dev/null
            done
            echo "  ✅ Documents uploaded"
        fi
    else
        echo "  ⚠️  KB creation returned HTTP $http_code"
        echo "     $(echo "$kb_body" | jq -r '.error.message // .' 2>/dev/null | head -1)"
        KB_ID=""
    fi
}

# ── Deploy Agent ────────────────────────────────────────────
deploy_agent() {
    local name=$1
    local prompt_path="agents/$name/system-prompt.md"
    local config_path="agents/$name/config.json"

    echo "  🤖 $name..."

    if [ ! -f "$config_path" ]; then
        echo "     ❌ Config not found: $config_path"
        return 1
    fi

    # Read system prompt
    local system_prompt=""
    if [ -f "$prompt_path" ]; then
        system_prompt=$(cat "$prompt_path")
    fi

    # Build the API payload from config.json
    # The config has agent metadata, model info, etc. We map to Bonito's AgentCreate schema.
    local agent_name agent_desc model_id
    agent_name=$(jq -r '.agent.name // .name // "Unknown"' "$config_path")
    agent_desc=$(jq -r '.agent.description // .description // ""' "$config_path")
    model_id=$(jq -r '.model.primary.provider + "/" + .model.primary.model // "auto"' "$config_path")

    local payload
    payload=$(jq -n \
        --arg name "$agent_name" \
        --arg desc "$agent_desc" \
        --arg prompt "$system_prompt" \
        --arg model "$model_id" \
        '{
            name: $name,
            description: $desc,
            system_prompt: $prompt,
            model_id: $model
        }')

    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "${BONITO_URL}/api/projects/${PROJECT_ID}/agents" \
        -H "$AUTH_HEADER" \
        -H "Content-Type: application/json" \
        -d "$payload")

    local http_code
    http_code=$(echo "$response" | tail -1)
    local body
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" =~ ^2 ]]; then
        local agent_id
        agent_id=$(echo "$body" | jq -r '.id')
        echo "     ✅ Deployed ($agent_id) - model: $model_id"

        # Register MCP servers if defined in config
        local mcp_servers
        mcp_servers=$(jq -r '.mcp_servers[]? // empty' "$config_path" 2>/dev/null)
        for server_name in $mcp_servers; do
            local upper_name
            upper_name=$(echo "$server_name" | tr '[:lower:]' '[:upper:]')
            local url_var="MCP_${upper_name}_URL"
            local url="${!url_var:-}"
            if [ -n "$url" ]; then
                curl -s -X POST "${BONITO_URL}/api/agents/${agent_id}/mcp-servers" \
                    -H "$AUTH_HEADER" \
                    -H "Content-Type: application/json" \
                    -d "{
                        \"name\": \"$server_name\",
                        \"transport_type\": \"http\",
                        \"endpoint_config\": {\"url\": \"$url\"},
                        \"auth_config\": {\"type\": \"none\"}
                    }" > /dev/null 2>&1 && echo "     📡 MCP: $server_name connected" || echo "     ⚠️  MCP: $server_name failed"
            fi
        done

        # Attach knowledge base if this is the docs-assistant
        if [ "$name" = "docs-assistant" ] && [ -n "${KB_ID:-}" ]; then
            curl -s -X PUT "${BONITO_URL}/api/agents/${agent_id}" \
                -H "$AUTH_HEADER" \
                -H "Content-Type: application/json" \
                -d "{\"knowledge_base_ids\": [\"$KB_ID\"]}" > /dev/null 2>&1 \
                && echo "     📚 Knowledge base attached" || echo "     ⚠️  KB attach failed"
        fi
    else
        echo "     ❌ Failed (HTTP $http_code)"
        echo "     $(echo "$body" | jq -r '.error.message // .' 2>/dev/null | head -1)"
        return 1
    fi
}

# ── Main ────────────────────────────────────────────────────

find_or_create_project

KB_ID=""
deploy_kb
echo ""

echo "🤖 Deploying agents..."
AGENTS=(
    "incident-responder"
    "code-reviewer"
    "docs-assistant"
    "deploy-monitor"
    "command-center"
)

FAILED=0
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
    echo "  1. Visit your Bonito dashboard to chat with agents"
    echo "  2. Test agents: ./scripts/test-agents.sh"
    echo "  3. Connect MCP servers for live integrations (GitHub, Slack, etc.)"
else
    echo "⚠️  $FAILED agent(s) failed to deploy. Check the output above."
fi
