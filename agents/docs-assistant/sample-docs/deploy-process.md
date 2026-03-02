# Deployment Process

> **Last updated:** 2025-02-01  
> **Owner:** Platform Team  
> **Status:** Active

## Overview

All production deployments go through GitHub Actions. We deploy continuously from `main` with manual approval gates for production.

## Environments

| Environment | Branch | Auto-deploy | Approval Required |
|-------------|--------|-------------|-------------------|
| Development | any branch | Yes (on push) | No |
| Staging | `main` | Yes (on merge) | No |
| Production | `main` | No | Yes (1 approver) |

## Deployment Flow

```
PR Merged to main
       │
       ▼
  Run Tests & Build
       │
       ▼
  Deploy to Staging ──────▶ Smoke Tests (automated)
       │                         │
       │                    Pass? │
       │                         ▼
       │                    ┌─────────┐
       │                    │  Slack   │
       │                    │ Notify   │
       │                    └────┬────┘
       │                         │
       ▼                         ▼
  Approval Gate ◀──── Engineer Reviews Staging
       │
       ▼
  Deploy to Production ──▶ Health Checks (automated)
       │                         │
       │                    Pass? │
       │                         ▼
       │                    ┌─────────┐
       │                    │  Slack   │
       │                    │ Summary  │
       │                    └─────────┘
       │
  Auto-rollback if health checks fail
```

## Step-by-Step

### 1. Merge Your PR

Once approved, merge to `main`. The CI pipeline triggers automatically.

### 2. Monitor Staging

After merge, staging deploys within ~3 minutes. Watch the #deploys channel for confirmation.

```bash
# Check staging deployment status
gh run list --workflow=deploy.yml --branch=main --limit=5
```

### 3. Verify on Staging

- Check the staging URL: `https://staging.your-app.com`
- Run smoke tests: automated, but you can trigger manually:
  ```bash
  gh workflow run smoke-tests.yml -f environment=staging
  ```

### 4. Approve Production Deploy

Once staging looks good:
1. Go to the GitHub Actions run
2. Click "Review deployments"
3. Select "production" environment
4. Click "Approve and deploy"

Or via CLI:
```bash
gh run review --approve <run-id>
```

### 5. Monitor Production

After approval, production deploys in ~5 minutes:
- Watch #deploys for the deploy summary
- Check production health: `https://status.your-app.com`
- Monitor error rates in Datadog/Grafana for 15 minutes

## Rollback Procedure

### Automatic Rollback

If health checks fail after production deploy, the system automatically rolls back to the previous version. You'll see a notification in #deploys.

### Manual Rollback

If you need to roll back manually:

```bash
# Find the last successful deployment
gh run list --workflow=deploy.yml --branch=main --status=success --limit=5

# Re-run that specific workflow
gh run rerun <run-id>
```

Or deploy a specific commit:
```bash
gh workflow run deploy.yml -f ref=<commit-sha> -f environment=production
```

### When to Roll Back

- Error rate increases > 2x baseline
- P99 latency increases > 50%
- Any 5xx errors on critical endpoints
- Customer-reported issues directly after deploy

**Roll back first, investigate later.** Speed matters more than understanding the cause upfront.

## Deploy Windows

| Day | Window | Notes |
|-----|--------|-------|
| Monday–Thursday | 9:00 AM – 4:00 PM ET | Standard deploy window |
| Friday | 9:00 AM – 12:00 PM ET | No afternoon deploys |
| Saturday–Sunday | Emergency only | Requires on-call approval |

### Exceptions

- **Hotfixes** (P1/P2): Any time, with on-call approval
- **Feature flags**: Can be toggled any time (no deploy needed)
- **Config changes**: Follow the deploy window unless urgent

## Pre-Deploy Checklist

Before approving a production deploy:

- [ ] All CI checks pass (tests, lint, build)
- [ ] Staging verification complete
- [ ] No ongoing incidents (check #incidents)
- [ ] Within deploy window (or approved exception)
- [ ] Database migrations are backward-compatible
- [ ] Feature flags in place for risky changes
- [ ] Monitoring dashboards open

## Contacts

- **Deploy issues**: #platform-support on Slack
- **Pipeline failures**: Check CI logs first, then ask in #platform-support
- **Rollback help**: Ping on-call in #incidents if urgent
