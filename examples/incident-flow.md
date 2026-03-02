# Example: Incident Response Flow

A PagerDuty alert fires at 2:47 AM. Here's what happens.

## The Alert

PagerDuty sends a webhook to Bonito:

```json
{
  "event": "incident.triggered",
  "incident": {
    "id": "P7X2K9M",
    "title": "High error rate on api-gateway (>10% 5xx)",
    "service": { "name": "api-gateway", "id": "PSVC001" },
    "urgency": "high",
    "created_at": "2026-03-15T07:47:23Z"
  }
}
```

## Step 1: Triage (Incident Responder)

The Incident Responder receives the alert and classifies it:

- **Service:** api-gateway
- **Signal:** >10% 5xx error rate
- **Blast radius:** All API consumers
- **Classification:** **P1 - Critical** (customer-facing, production, rising trend)

Time: ~800ms (Groq Llama 3.3 70B)

## Step 2: Create Ticket

The agent creates a Jira ticket via MCP:

```
Title: [P1] api-gateway - High error rate (>10% 5xx)

Alert Source: PagerDuty (P7X2K9M)
Triggered At: 2026-03-15T07:47:23Z
Service: api-gateway
Environment: production

Summary:
The API gateway is returning 5xx errors at >10% rate, affecting all
downstream consumers. This started approximately 5 minutes ago and
the rate is climbing.

Evidence:
- Error rate: 12.3% (baseline: 0.2%)
- Affected endpoints: /api/v2/* (all routes)
- No recent deploys in the last 2 hours

Suggested Actions:
1. Check api-gateway pod health: kubectl get pods -n api-gateway
2. Review recent config changes in the last 4 hours
3. Check upstream dependencies (auth-service, user-service)
4. If not resolved in 15 min, escalate to platform team lead

Related:
- Runbook: API Gateway Troubleshooting Guide
- Dashboard: https://grafana.internal/d/api-gateway
- Recent Deploys: None in last 2 hours
```

## Step 3: Notify Team

Slack message to #incidents:

```
🚨 P1 - api-gateway

High error rate (>10% 5xx) affecting all API consumers. Rate is climbing.
On-call: @sarah-chen

📋 Ticket: ENG-4521
📖 Runbook: API Gateway Troubleshooting
📊 Dashboard: grafana.internal/d/api-gateway
```

## Step 4: Suggest Runbook

The agent searches the knowledge base and finds the relevant runbook. It includes the top 3 steps directly in the Slack thread:

```
📖 From "API Gateway Troubleshooting Guide":

1. Check pod status:
   kubectl get pods -n api-gateway -o wide

2. Check recent OOM kills:
   kubectl describe pods -n api-gateway | grep -A5 "Last State"

3. Check upstream health:
   curl -s https://auth-service.internal/health
   curl -s https://user-service.internal/health

Full runbook: [link]
```

## Total Time: ~3 seconds

From PagerDuty alert to Slack notification with ticket, runbook, and on-call mention.

## What Happens Next

If someone asks the Command Center "What's going on with prod?", it routes to both the Incident Responder (active incidents) and Deploy Monitor (recent deploys), synthesizing a complete picture.

If someone asks "How do I troubleshoot the API gateway?", it routes to the Docs Assistant for the full runbook.

The agents work independently but the Command Center ties them together.
