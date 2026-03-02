<p align="center">
  <h1 align="center">Atlas</h1>
  <p align="center"><strong>AI-Powered DevOps Command Center</strong></p>
  <p align="center">Built on <a href="https://getbonito.com">Bonito</a> - the enterprise AI platform for multi-cloud workloads</p>
</p>

---

Atlas is a team of AI agents that handle your DevOps operations - incident triage, code review, documentation, and deploy tracking - orchestrated by a single command center. It runs on [Bonito](https://getbonito.com), which handles model routing, RAG, MCP integrations, and multi-provider failover so you don't have to.

## What's Inside

```
                         +-----------------------+
                         |   Atlas Command Center |
                         |      (Bonobot)         |
                         |  Routes & orchestrates |
                         +-----------+-----------+
                                     |
                    +-------+--------+--------+--------+
                    |       |                 |        |
              +-----+---+  +------+----+  +--+-----+  +-------+------+
              | Incident |  |   Code    |  |  Docs  |  |    Deploy    |
              | Responder|  |  Reviewer |  | Assist |  |   Monitor    |
              +-----+---+  +------+----+  +--+-----+  +-------+------+
                    |              |           |                |
              PagerDuty      GitHub MCP    RAG/KB         GitHub Actions
              Jira/Linear    PR Analysis   Runbooks       Slack Summaries
              Slack Alerts                 API Docs       DORA Metrics
```

| Agent | Type | Model | What It Does |
|-------|------|-------|-------------|
| **Command Center** | Bonobot | Claude Sonnet | Routes requests to the right agent, synthesizes multi-agent responses |
| **Incident Responder** | BonBon Simple | Groq Llama 3.3 70B | Triages alerts, creates tickets, notifies on-call, suggests runbooks |
| **Code Reviewer** | BonBon Advanced | Claude Sonnet | Reviews PRs for security, performance, and quality via GitHub MCP |
| **Docs Assistant** | BonBon Simple | GPT-4o Mini | Answers questions grounded in your internal docs (RAG) |
| **Deploy Monitor** | BonBon Advanced | Groq Llama 3.3 70B | Tracks deploys, posts summaries, reports DORA metrics |

## Why Bonito

You could wire this up yourself with raw API calls, vector DBs, and a pile of glue code. Or:

- **Multi-provider routing** - Groq for speed (incident triage), Claude for depth (code review), GPT-4o Mini for cost (docs Q&A). One gateway, automatic failover.
- **MCP built-in** - Connect to GitHub, PagerDuty, Jira, Slack without building custom integrations.
- **RAG without the plumbing** - Upload your docs, Bonito handles chunking, embedding, and retrieval.
- **Bonobot orchestration** - One agent routes to many. No hand-rolled intent classification.
- **Observability included** - Every request traced, every token counted, every cost tracked.

Atlas would take weeks to build from scratch. On Bonito, it's a config file and some system prompts.

## Quick Start

### Prerequisites

- A [Bonito](https://getbonito.com) account (free tier works for testing)
- API keys for your providers (or use Bonito's managed inference)
- GitHub token (for code review and deploy monitoring)

### 1. Clone and configure

```bash
git clone https://github.com/ShabariRepo/atlas.git
cd atlas
cp .env.example .env
# Edit .env with your credentials
```

### 2. Deploy to Bonito

```bash
# Install Bonito CLI
pip install bonito-cli

# Authenticate
bonito auth login

# Deploy all agents from the declarative config
bonito deploy -f bonito.yaml
```

### 3. Test it

```bash
# Run the test suite against your deployed agents
./scripts/test-agents.sh
```

### 4. Connect your tools

- Point PagerDuty/OpsGenie webhooks to your Incident Responder endpoint
- Add the GitHub webhook for PR events and deploy notifications
- Invite the Slack bot to your channels
- Or just use the Command Center widget and ask questions directly

## How It Works

### The Command Center (Bonobot)

The Command Center is the front door. It classifies what you need and routes to the right agent:

```
You:    "What's the status of prod?"
Atlas:  Routes to Deploy Monitor + Incident Responder
        -> Combines: latest deploys + any active incidents
        -> "3 deploys today, all successful. No active incidents."

You:    "Review PR #42"
Atlas:  Routes to Code Reviewer
        -> Reads the diff via GitHub MCP
        -> Posts inline comments + summary

You:    "How do I configure Redis caching?"
Atlas:  Routes to Docs Assistant
        -> Searches your runbooks via RAG
        -> Returns steps with source citations
```

See [examples/](./examples/) for detailed walkthroughs.

### Agent Types

**BonBon Simple** - Pre-configured agents with optional RAG. Good for straightforward tasks like Q&A and alert triage. Think of it as "agent-as-a-service."

**BonBon Advanced** - Agents with MCP server connections, scheduled triggers, and webhook integrations. For agents that need to reach out and touch external systems.

**Bonobot** - The orchestrator. Routes requests to BonBon agents, handles multi-agent queries, and synthesizes responses. This is your control plane for AI operations.

## Project Structure

```
atlas/
  README.md              You're here
  bonito.yaml            Declarative config for the entire stack
  .env.example           All required environment variables
  agents/
    command-center/      Bonobot orchestrator (the brain)
    incident-responder/  Alert triage and ticket creation
    code-reviewer/       PR review via GitHub MCP
    docs-assistant/      RAG-powered documentation Q&A
    deploy-monitor/      CI/CD tracking and DORA metrics
  scripts/
    setup.sh             Environment setup and validation
    deploy-agents.sh     Deploy all agents to Bonito
    test-agents.sh       Test suite for all agents
  examples/
    incident-flow.md     Alert -> triage -> ticket -> notification
    pr-review-flow.md    PR opened -> review -> comments
    deploy-summary-flow.md  Deploy -> monitor -> summary
  docs/
    ARCHITECTURE.md      How it all fits together
    CUSTOMIZATION.md     Adapting Atlas for your stack
    BONITO-SETUP.md      Getting started with Bonito
```

## Customization

Atlas is a starting point. Swap the system prompts, add your own agents, connect different MCP servers. See [docs/CUSTOMIZATION.md](./docs/CUSTOMIZATION.md) for details.

Common modifications:
- Replace PagerDuty with OpsGenie or Datadog
- Add a Security Scanner agent
- Connect to GitLab instead of GitHub
- Add a Release Manager agent for approval workflows
- Swap models based on your provider preferences

## Docs

- [Architecture](./docs/ARCHITECTURE.md) - How Atlas works under the hood
- [Customization Guide](./docs/CUSTOMIZATION.md) - Making it yours
- [Bonito Setup](./docs/BONITO-SETUP.md) - Platform setup walkthrough
- [Example: Incident Flow](./examples/incident-flow.md)
- [Example: PR Review Flow](./examples/pr-review-flow.md)
- [Example: Deploy Summary Flow](./examples/deploy-summary-flow.md)

## License

MIT - see [LICENSE](./LICENSE)

---

Built with [Bonito](https://getbonito.com) - the enterprise AI platform.
