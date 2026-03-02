# Customization Guide

Atlas is a reference implementation. Here's how to make it yours.

## Swap Integrations

### Use GitLab Instead of GitHub

Update the MCP server in `bonito.yaml`:

```yaml
mcp_servers:
  gitlab:
    transport: sse
    url: https://mcp.getbonito.com/gitlab
    auth:
      token: ${GITLAB_TOKEN}
      base_url: ${GITLAB_BASE_URL}
    capabilities:
      - merge_requests
      - issues
      - pipelines
```

Then update `agents/code-reviewer/mcp-servers.json` to reference `gitlab` instead of `github`.

### Use OpsGenie Instead of PagerDuty

```yaml
mcp_servers:
  opsgenie:
    transport: sse
    url: https://mcp.getbonito.com/opsgenie
    auth:
      token: ${OPSGENIE_API_KEY}
    capabilities:
      - alerts
      - incidents
      - schedules
```

Update the Incident Responder's triggers in `bonito.yaml` to listen for OpsGenie webhook events.

### Use Linear Instead of Jira

```yaml
mcp_servers:
  linear:
    transport: sse
    url: https://mcp.getbonito.com/linear
    auth:
      token: ${LINEAR_API_KEY}
    capabilities:
      - create_issue
      - update_issue
      - search
      - cycles
```

## Add New Agents

### Example: Security Scanner

Create `agents/security-scanner/`:

**config.json:**
```json
{
  "agent": {
    "id": "atlas-security-scanner",
    "name": "Security Scanner",
    "type": "bonbon",
    "version": "1.0.0"
  },
  "model": {
    "primary": {
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514"
    },
    "parameters": {
      "temperature": 0.1,
      "max_tokens": 8192
    }
  }
}
```

**system-prompt.md:** Write a prompt focused on dependency scanning, secret detection, and OWASP top 10.

Then add it to `bonito.yaml` under `agents:` and register it as a delegate in the Command Center's config.

### Example: Release Manager

An agent that handles approval workflows:

- Listens for release branch creation
- Checks all PR reviews are approved
- Verifies CI is green
- Posts a release checklist to Slack
- Tracks sign-offs from required approvers

This would be a BonBon Advanced agent with MCP connections to GitHub and Slack, plus scheduled triggers for release windows.

## Swap Models

### Use Only One Provider

If you only have OpenAI keys:

```yaml
agents:
  incident-responder:
    model:
      primary: openai/gpt-4o-mini    # was groq/llama-3.3
      fallback: openai/gpt-4o

  code-reviewer:
    model:
      primary: openai/gpt-4o          # was anthropic/claude-sonnet
      fallback: openai/gpt-4o-mini

  # ... same pattern for others
```

### Use Bonito Managed Inference

Skip bringing your own keys entirely:

```yaml
gateway:
  providers:
    - name: bonito-managed
      type: managed
      # No API keys needed - Bonito handles it
```

Set `provider: bonito-managed` on each agent's model config. Bonito routes to the best available provider.

## Customize System Prompts

Each agent's behavior is defined by its system prompt in `agents/{name}/system-prompt.md`. These are the main things you'd want to change:

### Incident Responder
- **Severity thresholds** - Adjust what constitutes P1 vs P2 for your org
- **Notification rules** - Change who gets paged and where
- **Ticket template** - Match your Jira/Linear field structure

### Code Reviewer
- **Review checklist** - Add or remove checks based on your stack
- **Language-specific rules** - Focus on your primary languages
- **Style preferences** - If you have specific coding standards

### Docs Assistant
- **Response format** - Match your team's preferred documentation style
- **Source priority** - Weight certain doc sources over others
- **Scope boundaries** - Define what's in/out of scope

### Deploy Monitor
- **Risk thresholds** - Adjust what counts as high-risk for your release cadence
- **Summary schedule** - Change when daily/weekly reports post
- **DORA benchmarks** - Set targets appropriate for your maturity level

## Modify the Command Center

### Add a New Domain

In `agents/command-center/delegation-map.json`, add your new agent:

```json
{
  "agent_id": "atlas-security-scanner",
  "name": "Security Scanner",
  "domains": ["security", "vulnerabilities", "CVE", "dependencies", "OWASP"],
  "description": "Scans for security vulnerabilities and dependency issues",
  "examples": [
    "Are there any critical CVEs in our dependencies?",
    "Run a security scan on the auth service"
  ]
}
```

Then update `agents/command-center/system-prompt.md` to include the new agent in the routing logic.

### Change Routing Strategy

In `bonito.yaml`, the Command Center's delegation config:

```yaml
delegation:
  strategy: intent-classification    # Default: AI-based routing
  # Alternatives:
  # strategy: keyword-match          # Faster, less accurate
  # strategy: hybrid                 # Keywords first, AI fallback
  allow_multi_agent: true            # Set false to force single-agent routing
  synthesize_responses: true         # Set false to return raw agent responses
```

## Scale Considerations

### High Volume

For teams processing hundreds of PRs or alerts daily:

- Use Groq for all agents (speed) with Claude as fallback (quality)
- Increase `rate_limits.requests_per_minute` in the gateway config
- Consider separate Bonito projects per agent for independent scaling
- Enable Redis caching in the gateway for repeated queries

### Multiple Teams

Run separate Atlas instances per team with shared infrastructure:

```yaml
# team-platform.bonito.yaml
name: atlas-platform
agents:
  # Platform team agents with platform-specific runbooks

# team-product.bonito.yaml
name: atlas-product
agents:
  # Product team agents with product-specific docs
```

Both share the same Bonito gateway and provider credentials.
