# Atlas MCP Servers

Mock Model Context Protocol (MCP) servers for local development and testing.

## Quick Start

```bash
# Start all MCP servers
docker-compose -f docker-compose.mcp.yml up -d

# Check health
curl http://localhost:3100/health  # GitHub
curl http://localhost:3101/health  # PagerDuty  
curl http://localhost:3102/health  # Slack
curl http://localhost:3103/health  # Jira

# Stop all servers
docker-compose -f docker-compose.mcp.yml down
```

## Servers

| Service | Port | SSE Endpoint | Description |
|---------|------|--------------|-------------|
| GitHub | 3100 | `/sse` | Mock GitHub API (PRs, issues, actions) |
| PagerDuty | 3101 | `/sse` | Mock PagerDuty API (incidents, services) |
| Slack | 3102 | `/sse` | Mock Slack API (messages, channels) |
| Jira | 3103 | `/sse` | Mock Jira API (issues, projects) |

## Implementation

- **Express.js** servers with CORS enabled
- **Server-Sent Events (SSE)** endpoints for MCP protocol
- **REST API mocks** that simulate real service responses
- **Health checks** for monitoring
- **Environment variable** support for configuration

## Configuration

Configure in `.env`:
```bash
MCP_GITHUB_URL=http://localhost:3100/sse
MCP_PAGERDUTY_URL=http://localhost:3101/sse
MCP_SLACK_URL=http://localhost:3102/sse
MCP_JIRA_URL=http://localhost:3103/sse
```

## Development

Each server supports real API tokens via environment variables:
- `GITHUB_TOKEN` - for GitHub server
- `SLACK_BOT_TOKEN` - for Slack server  
- `PAGERDUTY_API_KEY` - for PagerDuty server
- `JIRA_API_TOKEN`, `JIRA_BASE_URL`, `JIRA_EMAIL` - for Jira server

When real tokens are provided, servers can be extended to make actual API calls instead of returning mock data.