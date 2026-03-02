# Example: Deploy Summary Flow

It's Monday morning. Atlas posts the weekly recap.

## Scheduled Trigger

At 10:00 AM ET, the Deploy Monitor's cron fires:

```yaml
triggers:
  - type: schedule
    cron: "0 10 * * 1"    # Monday 10 AM
    task: weekly_deploy_recap
```

## Step 1: Gather Data

The Deploy Monitor queries GitHub via MCP for the past week:

- All workflow runs across monitored repos
- Deployment statuses (success/failure)
- Commit metadata (author, message, files changed)
- Time between PR merge and production deploy

## Step 2: Calculate DORA Metrics

The agent processes the raw data into DORA metrics:

- **Deploy Frequency:** How often did we deploy?
- **Lead Time for Changes:** How long from commit to production?
- **Change Failure Rate:** What percentage of deploys caused issues?
- **Mean Time to Recovery:** When things broke, how fast did we fix it?

## Step 3: Post Weekly Recap

Slack message to #deployments:

```
📈 Weekly Deploy Recap - Week of March 10

DORA Metrics:
+--------------------------+-----------+-----------+---------+
| Metric                   | This Week | Last Week | Trend   |
+--------------------------+-----------+-----------+---------+
| Deploy Frequency         | 4.2/day   | 3.8/day   | ↑       |
| Lead Time for Changes    | 2.4 hours | 3.1 hours | ↑       |
| Change Failure Rate      | 4.8%      | 7.1%      | ↑       |
| Mean Time to Recovery    | 23 min    | 45 min    | ↑       |
+--------------------------+-----------+-----------+---------+

Rating: Elite (per DORA benchmarks)

Top Contributors: @alex-dev (8), @sarah-chen (6), @mike-ops (5)
Busiest Day: Wednesday (9 deploys)
Longest Deploy: user-service (14 min - includes migration)

Good week. Deploy frequency is up while failure rate dropped to
under 5% - that puts us in Elite territory across all four DORA
metrics for the first time. The user-service migration deploy on
Wednesday was the only one over 10 minutes. Worth looking at
whether that migration can be split next time.
```

## Daily Summary (Every Weekday at 9 AM)

```
📊 Daily Deploy Summary - March 14

Deploys: 5 (4 ✅ 1 ❌)
Success Rate: 80%
Avg Duration: 4m 12s
Contributors: @alex-dev, @sarah-chen, @mike-ops

Highlights:
- api-gateway deploy failed at test stage (flaky integration test,
  succeeded on retry)
- user-service shipped the new profile API (PR #104)

One failed deploy today but it was a known flaky test - not a real
issue. The retry succeeded. Consider marking that test for investigation.
```

## Real-Time Deploy Notifications

When a deploy completes:

```
✅ Deploy: api-gateway -> production

Author:   @alex-dev
Branch:   feature/rate-limiting
Commit:   a3f2b1c - Add per-endpoint rate limiting
Duration: 3m 47s
Files:    7 changed

Risk: Medium (includes middleware changes in request pipeline)
```

When a deploy fails:

```
❌ Deploy Failed: auth-service -> production

Author:   @sarah-chen
Branch:   fix/token-refresh
Commit:   d8e4f2a - Fix token refresh race condition
Failed:   Integration tests

Likely Cause: Test `test_concurrent_refresh` timed out. The fix
addresses a race condition but the test itself may need a longer
timeout to account for the new locking mechanism.

🔗 Logs: github.com/org/auth-service/actions/runs/12345
```

## Via the Command Center

```
You:    "How are we doing on deploys this week?"

Atlas:  📡 Routing to Deploy Monitor...

        [Weekly metrics + commentary]

You:    "What failed?"

Atlas:  📡 Routing to Deploy Monitor...

        One failure this week: auth-service deploy on Tuesday.
        Integration test timeout - the fix for the token refresh
        race condition needs a longer test timeout. Sarah pushed
        a fix and the retry deployed successfully.

You:    "Any incidents related to deploys?"

Atlas:  📡 Checking with Deploy Monitor and Incident Responder...

        Deploy Monitor: 21 deploys this week, 1 failure (retried
        successfully).

        Incident Responder: No deploy-related incidents this week.
        The only alert was a brief CPU spike on user-service during
        the Wednesday migration, which auto-resolved.

        All clear - no deploy-related incidents.
```
