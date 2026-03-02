# Incident Responder

**Type:** BonBon Simple  
**Model:** Groq Llama 3.3 70B (primary) → OpenAI GPT-4o-mini (fallback)  
**Latency:** ~500ms triage time

## What It Does

The Incident Responder automatically processes incoming alerts from PagerDuty and OpsGenie, triages them by severity, creates tracking tickets in Jira or Linear, and notifies your team via Slack — all in under a second.

### Flow

```
PagerDuty/OpsGenie Alert
        │
        ▼
  Parse & Deduplicate
        │
        ▼
  Classify Severity (P1-P4)
        │
        ▼
  Create Jira/Linear Ticket
        │
        ▼
  Notify Slack (#incidents)
        │
        ▼
  Suggest Relevant Runbook
```

## Why Groq?

Incident triage is time-critical. Groq's inference speed (< 200ms for classification) means your team gets notified within seconds of an alert firing, not minutes. The model is more than capable of severity classification and structured ticket creation.

For complex incidents that need deeper analysis, the fallback to GPT-4o-mini ensures quality.

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `PAGERDUTY_API_KEY` | PagerDuty API key for reading incidents |
| `PAGERDUTY_WEBHOOK_SECRET` | Webhook signature validation |
| `SLACK_BOT_TOKEN` | Slack bot token for posting notifications |
| `SLACK_CHANNEL_INCIDENTS` | Channel for incident notifications |
| `JIRA_BASE_URL` | Jira instance URL |
| `JIRA_EMAIL` | Jira automation user email |
| `JIRA_API_TOKEN` | Jira API token |
| `JIRA_PROJECT_KEY` | Project key for incident tickets |

### Webhook Setup

1. In PagerDuty, add a Generic Webhook (v3) pointing to:
   ```
   https://your-domain.com/webhooks/pagerduty
   ```
2. Subscribe to: `incident.triggered`, `incident.acknowledged`, `incident.resolved`
3. Copy the signing secret to `PAGERDUTY_WEBHOOK_SECRET`

## Customization

### Adjusting Severity Rules

Edit `system-prompt.md` to change the severity classification matrix. The default rules optimize for "err on the side of caution" — adjust thresholds based on your SLAs.

### Adding Alert Sources

Add new webhook triggers in `config.json`. The system prompt handles any structured alert payload — just add the webhook path and event types.

### Ticket Provider

The default config creates Jira tickets. To switch to Linear:

1. Replace the `jira` MCP server with `linear` in `config.json`
2. Update the ticket creation template in the system prompt
3. Set `LINEAR_API_KEY` and `LINEAR_TEAM_ID` in your `.env`

### Notification Channels

Update `SLACK_CHANNEL_INCIDENTS` to route to a different channel. For multi-channel routing (e.g., P1 → #incidents + #engineering-leads), customize the notification rules in the system prompt.

## Testing

```bash
# Simulate a P1 alert
./scripts/test-agents.sh incident-responder

# Or send a test webhook
curl -X POST http://localhost:3000/webhooks/pagerduty \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "event_type": "incident.triggered",
      "data": {
        "id": "TEST001",
        "title": "Production API Error Rate > 10%",
        "urgency": "high",
        "service": {
          "name": "api-gateway",
          "id": "PSERVICE01"
        }
      }
    }
  }'
```
