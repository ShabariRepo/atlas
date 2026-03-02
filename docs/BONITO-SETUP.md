# Bonito Setup Guide

Getting Atlas running on Bonito from scratch.

## 1. Create a Bonito Account

Sign up at [getbonito.com](https://getbonito.com). The free tier (1,000 API calls/month) is enough to test all five Atlas agents.

## 2. Connect Providers

Atlas uses multiple providers for different agents. You have two options:

### Option A: Bring Your Own Keys

In the Bonito dashboard, go to **Providers** and connect:

| Provider | Used By | Required |
|----------|---------|----------|
| Anthropic | Command Center, Code Reviewer | Recommended |
| OpenAI | Docs Assistant (GPT-4o Mini) | Recommended |
| Groq | Incident Responder, Deploy Monitor | Recommended |
| AWS Bedrock | Fallback provider | Optional |
| Azure OpenAI | Fallback provider | Optional |
| GCP Vertex AI | Fallback provider | Optional |

You only strictly need one provider to get started. Atlas will use whatever's available.

### Option B: Managed Inference

Bonito can handle provider credentials for you. Enable managed inference in your project settings. No API keys needed - Bonito routes to the best available provider automatically.

This is the fastest path to running Atlas.

## 3. Set Up Environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```bash
# Bonito (required)
BONITO_API_KEY=bn-your-api-key-here
BONITO_API_URL=https://api.getbonito.com

# Provider keys (if not using managed inference)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# Integrations (connect what you use)
GITHUB_TOKEN=ghp_...
SLACK_BOT_TOKEN=xoxb-...
PAGERDUTY_API_KEY=...
JIRA_BASE_URL=https://your-org.atlassian.net
JIRA_EMAIL=you@your-org.com
JIRA_API_TOKEN=...
```

## 4. Deploy Agents

### Using the CLI

```bash
# Install
pip install bonito-cli

# Login
bonito auth login

# Deploy everything
bonito deploy -f bonito.yaml
```

### Using the API

If you prefer API calls, see each agent's `config.json` for the request body. The deploy script (`scripts/deploy-agents.sh`) shows the full API flow.

## 5. Upload Documentation (for Docs Assistant)

The Docs Assistant needs a knowledge base. Upload your internal docs:

```bash
# Via CLI
bonito kb create --name "internal-docs" --description "Engineering documentation"
bonito kb upload --kb internal-docs --path ./agents/docs-assistant/sample-docs/

# The sample docs are included for testing.
# Replace with your actual runbooks and API docs.
```

## 6. Connect Webhooks

### GitHub (for Code Reviewer + Deploy Monitor)

In your GitHub repo settings -> Webhooks:

- **Payload URL:** Your Bonito webhook endpoint (shown after deploy)
- **Content type:** `application/json`
- **Events:** Pull requests, Deployments, Workflow runs

### PagerDuty (for Incident Responder)

In PagerDuty -> Integrations -> Generic Webhooks:

- **Endpoint URL:** Your Bonito webhook endpoint
- **Events:** Incident triggered, acknowledged, resolved

### Slack (for all agents)

Install the Bonito Slack app (link shown after deploy) to your workspace. Invite it to:
- `#incidents` - for the Incident Responder
- `#deployments` - for the Deploy Monitor
- Any channel where you want the Command Center available

## 7. Test

```bash
./scripts/test-agents.sh
```

This sends sample requests to each agent and validates responses. See [scripts/test-agents.sh](../scripts/test-agents.sh) for details.

## 8. Go Live

Once tests pass:

1. Point real webhooks to Bonito (replace test endpoints)
2. Invite the Slack bot to production channels
3. Embed the Command Center widget on your internal dashboard
4. Monitor usage in the Bonito dashboard

## Troubleshooting

**"Provider not configured"** - Make sure you've connected at least one provider in the Bonito dashboard, or enable managed inference.

**"Knowledge base empty"** - Upload docs with `bonito kb upload`. The Docs Assistant won't work without a populated KB.

**"Webhook not received"** - Check the webhook URL matches your Bonito endpoint. Verify the webhook secret if configured.

**"Agent not responding"** - Check the Bonito dashboard for error logs. Common causes: expired API keys, rate limits, model not available on your plan.

## Cost Estimates

With Atlas on Bonito Pro ($499/mo):

| Agent | Estimated Monthly Usage | Estimated Cost |
|-------|------------------------|----------------|
| Incident Responder | ~500 alerts | ~$2 (Groq) |
| Code Reviewer | ~200 PRs | ~$15 (Claude) |
| Docs Assistant | ~2,000 queries | ~$3 (GPT-4o Mini) |
| Deploy Monitor | ~1,000 deploys + summaries | ~$2 (Groq) |
| Command Center | ~3,000 routing decisions | ~$8 (Claude) |
| **Total inference** | | **~$30/mo** |

The inference cost is separate from the Bonito platform fee. With managed inference, it's bundled.
