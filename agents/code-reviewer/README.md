# Code Reviewer

**Type:** BonBon Advanced (MCP)  
**Model:** Anthropic Claude Sonnet (primary) → OpenAI GPT-4o (fallback)  
**Trigger:** PR opened/updated or `/review` command

## What It Does

The Code Reviewer automatically analyzes pull requests for security vulnerabilities, performance issues, bugs, and maintainability concerns. It posts inline comments with actionable suggestions and a summary review.

### Flow

```
PR Opened / Updated
        │
        ▼
  Fetch Diff via GitHub MCP
        │
        ▼
  Analyze: Security → Correctness → Performance → Style
        │
        ▼
  Post Inline Comments (with suggestions)
        │
        ▼
  Post Summary Review
```

## Why Claude Sonnet?

Code review requires understanding context, intent, and nuance. Claude excels at:
- Reading large diffs and maintaining context across files
- Understanding the "why" behind code changes
- Generating constructive, specific feedback
- Producing valid GitHub suggestion blocks

The higher token limit (8K output) lets it handle large PRs without truncation.

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub token with `repo` and `pull_request` scopes |
| `GITHUB_ORG` | Your GitHub organization |
| `GITHUB_WEBHOOK_SECRET` | Webhook signature validation secret |

### Webhook Setup

1. In your GitHub repo/org settings, add a webhook pointing to:
   ```
   https://your-domain.com/webhooks/github/pr
   ```
2. Set content type to `application/json`
3. Subscribe to **Pull requests** events
4. Add your webhook secret

### Slash Command

If using Slack integration, the `/review` command triggers on-demand reviews:

```
/review 42              # Review PR #42 (all checks)
/review 42 security     # Focus on security only
```

## Customization

### Adjusting Review Checks

Edit the `checks` array in `config.json` to enable/disable specific review categories. Set `severity` to control how findings are reported.

### Ignore Patterns

Add file patterns to `ignore_patterns` in `config.json` to skip generated files, vendor code, or other paths that shouldn't be reviewed.

### Auto-Approve

Set `auto_approve: true` in `config.json` to automatically approve PRs with zero critical or warning findings. **Use with caution** — recommended only for low-risk repos.

### Review Depth

Adjust `max_files` and `max_diff_lines` to control when the reviewer suggests splitting a PR. The defaults (50 files, 5000 lines) are reasonable for most teams.

### Language-Specific Rules

The system prompt includes language-specific guidance. Add or modify sections in `system-prompt.md` for your stack's conventions (e.g., internal style guides, banned patterns).

## Example Review Output

### Inline Comment
> **🔴 Critical** — Potential SQL injection
>
> This query interpolates user input directly. Use parameterized queries instead.
>
> ```suggestion
> const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
> ```

### Summary
> ## Code Review Summary
> **Overall:** REQUEST_CHANGES
>
> ### Findings
> - 🔴 1 critical issue
> - 🟡 2 warnings
> - 🔵 3 suggestions
>
> ### Key Concerns
> SQL injection vulnerability in the user lookup query. Must fix before merge.
>
> ### What Looks Good
> Clean separation of concerns in the service layer. Good test coverage for the happy path.
