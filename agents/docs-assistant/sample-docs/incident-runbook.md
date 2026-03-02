# Incident Response Runbook

> **Last updated:** 2025-01-28  
> **Owner:** SRE Team  
> **Status:** Active  
> **Review cadence:** Quarterly

## Severity Definitions

| Level | Definition | Response Time | Examples |
|-------|-----------|---------------|----------|
| **P1** | Full outage or data loss affecting all users | < 5 minutes | Database down, auth system failure, data corruption |
| **P2** | Partial outage or significant degradation | < 15 minutes | Single region down, > 5% error rate, payment failures |
| **P3** | Minor service degradation, workaround available | < 1 hour | Slow queries, non-critical feature broken, intermittent errors |
| **P4** | Cosmetic or minor issue, no user impact | Next business day | UI glitch, log noise, non-critical alert |

## Incident Lifecycle

```
Alert Triggered
      │
      ▼
┌──────────┐
│  TRIAGE   │ ◀── Classify severity, identify service
└────┬─────┘
     │
     ▼
┌──────────┐
│ MOBILIZE  │ ◀── Page on-call, open war room (P1/P2)
└────┬─────┘
     │
     ▼
┌──────────┐
│ MITIGATE  │ ◀── Stop the bleeding (rollback, failover, scale)
└────┬─────┘
     │
     ▼
┌──────────┐
│  RESOLVE  │ ◀── Fix root cause, verify recovery
└────┬─────┘
     │
     ▼
┌──────────┐
│  REVIEW   │ ◀── Post-mortem within 48h (P1/P2)
└──────────┘
```

## Step 1: Triage

**Time limit: 5 minutes**

1. Read the alert — what service, what symptom?
2. Check the dashboard: `https://grafana.internal/d/service-overview`
3. Classify severity using the table above
4. If P1/P2: proceed immediately to Mobilize
5. If P3/P4: create a ticket and address during business hours

### Quick Diagnostic Commands

```bash
# Check service health
curl -s https://api.your-app.com/health | jq .

# Check recent deployments
gh run list --workflow=deploy.yml --limit=5

# Check error rates (last 15 min)
# Via Datadog/Grafana — link: https://grafana.internal/d/error-rates

# Check database connectivity
pg_isready -h $DB_HOST -p 5432

# Check Redis connectivity
redis-cli -h $REDIS_HOST ping
```

## Step 2: Mobilize

**For P1 and P2 incidents only.**

1. **Acknowledge the alert** in PagerDuty
2. **Open a Slack thread** in #incidents:
   ```
   🚨 [P{severity}] {Service} — {Brief description}
   Investigating. Updates to follow in this thread.
   ```
3. **Start a war room** (for P1):
   - Slack huddle in #incidents, or
   - Zoom link: `https://your-org.zoom.us/j/incident-room`
4. **Assign roles**:
   - **Incident Commander (IC)**: Coordinates response (usually on-call lead)
   - **Technical Lead**: Drives investigation and fix
   - **Communicator**: Posts updates to stakeholders

## Step 3: Mitigate

**Goal: Stop user impact as fast as possible. Understanding why can wait.**

### Decision Tree

```
Is there a recent deploy?
├── Yes → Roll back immediately
│         gh run rerun <last-good-run-id>
│
└── No → Is it a traffic spike?
         ├── Yes → Scale up
         │         kubectl scale deployment/<service> --replicas=<N>
         │
         └── No → Is it a dependency failure?
                  ├── Yes → Failover or disable dependency
                  │         (feature flag, circuit breaker)
                  │
                  └── No → Is it a data issue?
                           ├── Yes → Stop writes, assess scope
                           └── No → Escalate to service owner
```

### Common Mitigations

| Symptom | First Action |
|---------|-------------|
| Error rate spike after deploy | Rollback |
| Database CPU > 90% | Kill long-running queries, add read replica |
| Memory OOM | Restart pods, increase limits |
| SSL/TLS errors | Check cert expiry, renew if needed |
| DNS resolution failures | Check Route53/CloudFlare status |
| Third-party API failures | Enable circuit breaker, use cached responses |

## Step 4: Resolve

Once user impact is mitigated:

1. **Confirm recovery**: Check error rates, latency, user reports
2. **Identify root cause**: Investigate logs, traces, recent changes
3. **Apply permanent fix**: If rollback was temporary, fix forward
4. **Update the incident thread**: Post resolution summary
5. **Close the alert**: Resolve in PagerDuty
6. **Update the ticket**: Add resolution details, close

### Resolution Confirmation Checklist

- [ ] Error rates back to baseline
- [ ] Latency back to baseline
- [ ] No customer reports in last 15 minutes
- [ ] Health checks passing
- [ ] Monitoring dashboards green

## Step 5: Post-Mortem

**Required for P1 and P2. Optional but encouraged for P3.**

**Timeline: Within 48 hours of resolution.**

### Post-Mortem Template

```markdown
## Incident Post-Mortem: {Title}

**Date:** {YYYY-MM-DD}
**Severity:** P{N}
**Duration:** {X hours Y minutes}
**Impact:** {What users experienced}

### Timeline
- HH:MM — Alert triggered
- HH:MM — On-call acknowledged
- HH:MM — Root cause identified
- HH:MM — Mitigation applied
- HH:MM — Full recovery confirmed

### Root Cause
{Clear, technical explanation}

### What Went Well
- {Thing that helped}

### What Went Wrong
- {Thing that didn't work or was slow}

### Action Items
| Action | Owner | Deadline |
|--------|-------|----------|
| {action} | {person} | {date} |
```

### Post-Mortem Rules

- **Blameless.** Focus on systems and processes, not individuals.
- **Honest.** Don't downplay impact or gloss over mistakes.
- **Actionable.** Every finding should have an action item with an owner and deadline.
- **Shared.** Post to #engineering and link in the incident ticket.

## Escalation Paths

| Service | Primary | Secondary | VP |
|---------|---------|-----------|-----|
| API Gateway | @api-oncall | @platform-lead | @vp-eng |
| Database | @db-oncall | @sre-lead | @vp-eng |
| Auth/SSO | @auth-oncall | @security-lead | @cto |
| Payments | @payments-oncall | @payments-lead | @cfo |
| Infrastructure | @infra-oncall | @sre-lead | @vp-eng |

## Communication Templates

### Status Page Update (P1)
```
[Investigating] We are aware of issues affecting {service}.
Our team is actively investigating. We will provide an update within 30 minutes.
```

### Customer Email (if needed)
```
Subject: Service Disruption — {Date}

We experienced a {duration} disruption to {service} on {date}.
{Brief impact description}. The issue has been resolved and
service is fully operational.

We've identified the root cause and are implementing measures
to prevent recurrence. We apologize for the inconvenience.
```
