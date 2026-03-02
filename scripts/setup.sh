#!/usr/bin/env bash
set -euo pipefail

# Atlas Setup Script
# Validates environment and prepares for deployment

echo "🏔️  Atlas Setup"
echo "==============="
echo ""

# Check for .env
if [ ! -f .env ]; then
    echo "📋 Creating .env from template..."
    cp .env.example .env
    echo "   Edit .env with your credentials before deploying."
    echo ""
fi

# Source .env
set -a
source .env 2>/dev/null || true
set +a

# Check required vars
MISSING=0

check_var() {
    local var_name=$1
    local required=$2
    local value="${!var_name:-}"

    if [ -z "$value" ] || [[ "$value" == *"your-"* ]] || [[ "$value" == *"..."* ]]; then
        if [ "$required" = "required" ]; then
            echo "  ❌ $var_name (required)"
            MISSING=$((MISSING + 1))
        else
            echo "  ⚠️  $var_name (optional - some features won't work)"
        fi
    else
        echo "  ✅ $var_name"
    fi
}

echo "Checking credentials..."
echo ""

echo "Bonito:"
check_var "BONITO_API_KEY" "required"
check_var "BONITO_API_URL" "optional"
if [ -z "${BONITO_API_URL:-}" ]; then
    echo "  ℹ️  BONITO_API_URL not set, will use http://localhost:8001 (local dev)"
fi
echo ""

echo "Providers (need at least one, or use managed inference):"
check_var "ANTHROPIC_API_KEY" "optional"
check_var "OPENAI_API_KEY" "optional"
check_var "GROQ_API_KEY" "optional"
echo ""

echo "Integrations:"
check_var "GITHUB_TOKEN" "optional"
check_var "SLACK_BOT_TOKEN" "optional"
check_var "PAGERDUTY_API_KEY" "optional"
check_var "JIRA_BASE_URL" "optional"
echo ""

if [ "$MISSING" -gt 0 ]; then
    echo "⛔ $MISSING required variable(s) missing. Edit .env and re-run."
    exit 1
fi

# Check for Bonito CLI
if command -v bonito &>/dev/null; then
    echo "✅ Bonito CLI installed ($(bonito --version 2>/dev/null || echo 'unknown version'))"
else
    echo "⚠️  Bonito CLI not found. Install with: pip install bonito-cli"
fi

echo ""
echo "✅ Setup complete. Run ./scripts/deploy-agents.sh to deploy."
