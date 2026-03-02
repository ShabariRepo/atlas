# Deploy Monitor

**Type:** BonBon Advanced (Scheduled + Triggered)  
**Model:** Groq Llama 3.3 70B (primary) → OpenAI GPT-4o-mini (fallback)  
**Schedule:** Real-time notifications + daily/weekly summaries

## What It Does

The Deploy Monitor tracks every deployment across your repos and gives your team visibility into delivery health. It posts real-time deploy notifications, daily digests, and weekly DORA metrics recaps.

### Capabilities

- **Real-time notifications**: Posts to Slack when deploys succeed or fail
- **Failure analysis**: Reads logs and identifies likely cause of failures
- **Risk assessment**: Flags high-risk deploys (Fridays, large changesets, migrations)
- **Daily summary**: Morning digest of yesterday's deployments
- **Weekly DORA metrics**: Deployment frequency, lead time, change failure rate, MTTR
- **Trend tracking**: Week-over-week comparisons with directional indicators

### Flow

```
GitHub Actions Webhook          Schedule (cron)
        │                            │
        ▼                            ▼
  Parse deploy event          Aggregate metrics
        │                            │
        ▼                            ▼
  Assess risk level           Compute DORA metrics
        │                            │
        ▼                            ▼
  Post to #deploys            Post summary to #deploys
        │
  (if failed) Analyze logs
```

## Why Groq?

Deploy notifications should appear within seconds of a deploy completing. Groq's inference speed ensures the Slack message lands while the deploy is still top-of-mind. The task — summarizing structured data — doesn't require a frontier model.

## DORA Metrics

The Deploy Monitor automatically tracks the four DORA metrics:

| Metric | What It Measures | How It's Calculated |
|--------|-----------------|-------------------|
| **Deployment Frequency** | How often you deploy | Deploys per day (to production) |
| **Lead Time for Changes** | Time from commit to production | Median time from first commit in PR to production deploy |
| **Change Failure Rate** | % of deploys causing incidents | Failed deploys ÷ total deploys |
| **Mean Time to Recovery** | How fast you fix failures | Median time from failure to next successful deploy |

These are reported weekly with trend indicators (↑ improving, ↓ regressing, → stable).

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub token for reading workflow runs |
| `GITHUB_WEBHOOK_SECRET` | Webhook signature validation |
| `SLACK_BOT_TOKEN` | Slack bot for posting summaries |
| `SLACK_CHANNEL_DEPLOYS` | Channel for deploy notifications |

### Schedule Configuration

Edit `schedule.json` to customize:
- **Cron expressions**: Adjust timing for daily/weekly reports
- **Timezone**: Set to your team's timezone
- **Filters**: Control which workflows trigger notifications
- **Monthly reports**: Disabled by default — enable for leadership dashboards

### Webhook Setup

1. In GitHub (repo or org level), add a webhook:
   ```
   https://your-domain.com/webhooks/github/deploy
   ```
2. Subscribe to: **Deployment statuses** and **Workflow runs**
3. Set content type to `application/json`

## Customization

### Slack Channel Routing

By default, everything goes to `#deploys`. To route differently:

- Failed production deploys → `#incidents` (set in behavior config)
- Weekly recaps → `#engineering` (set in schedule config)
- Per-repo channels → customize in `config.json`

### Risk Thresholds

Adjust risk assessment factors in `system-prompt.md`:
- File count thresholds
- Day-of-week rules (some teams deploy on Fridays, and that's fine)
- Failure frequency windows

### Filtering Workflows

Not all GitHub Actions workflows are deploys. Filter in `schedule.json` → `triggers`:

```json
{
  "filter": {
    "workflow_name": ["deploy", "release", "cd-*"],
    "conclusion": ["success", "failure"]
  }
}
```

This ignores CI-only workflows (tests, linting) and only tracks actual deployment workflows.
