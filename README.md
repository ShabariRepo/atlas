<p align="center">
  <h1 align="center">Atlas</h1>
  <p align="center"><strong>AI-Powered DevOps Command Center</strong></p>
  <p align="center">Built on <a href="https://getbonito.com">Bonito</a> - the enterprise AI platform for multi-cloud workloads</p>
</p>

<p align="center">
  <a href="https://getbonito.com">Website</a> &bull;
  <a href="https://getbonito.com/docs">Docs</a> &bull;
  <a href="https://getbonito.com/pricing">Pricing</a> &bull;
  <a href="https://getbonito.com/signup">Get Started Free</a>
</p>

---

Atlas is a team of AI agents that handle your DevOps operations - incident triage, code review, documentation, and deploy tracking - orchestrated by a single command center.

It runs on [Bonito](https://getbonito.com), which handles the hard parts: multi-provider model routing, MCP tool integrations, RAG, agent orchestration, and observability. You write system prompts and config. Bonito runs the infrastructure.

**This repo is a reference implementation.** Fork it, swap the prompts, connect your tools, deploy to Bonito. You can have a production multi-agent system running in an afternoon.

> **New to Bonito?** [Sign up free](https://getbonito.com/signup) (1,000 API calls/month) and follow the [setup guide](./docs/BONITO-SETUP.md).

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
| **Command Center** | [Bonobot](https://getbonito.com/docs/bonobot) | Claude Sonnet | Routes requests to the right agent, synthesizes multi-agent responses |
| **Incident Responder** | [BonBon Simple](https://getbonito.com/docs/bonbon) | Groq Llama 3.3 70B | Triages alerts, creates tickets, notifies on-call, suggests runbooks |
| **Code Reviewer** | [BonBon Advanced](https://getbonito.com/docs/bonbon) | Claude Sonnet | Reviews PRs for security, performance, and quality via GitHub MCP |
| **Docs Assistant** | [BonBon Simple](https://getbonito.com/docs/bonbon) | GPT-4o Mini | Answers questions grounded in your internal docs (RAG) |
| **Deploy Monitor** | [BonBon Advanced](https://getbonito.com/docs/bonbon) | Groq Llama 3.3 70B | Tracks deploys, posts summaries, reports DORA metrics |

## Why Bonito

Building a multi-agent system from scratch means wiring up provider SDKs, building a routing layer, setting up vector databases, writing orchestration logic, and instrumenting everything for observability. That's months of infrastructure work before you write a single agent.

**Bonito handles all of that.** You focus on what your agents do, not how they run.

| What you'd build yourself | What Bonito gives you |
|--------------------------|----------------------|
| Provider SDK integration per cloud | [Unified gateway](https://getbonito.com/docs/gateway) - one API, 6 providers, automatic failover |
| Vector DB setup + embedding pipeline | [Built-in RAG](https://getbonito.com/docs/knowledge-bases) - upload docs, get retrieval |
| Custom MCP client implementation | [MCP registry](https://getbonito.com/docs/mcp) - connect servers, agents get tools |
| Intent classification + routing logic | [Bonobot orchestration](https://getbonito.com/docs/bonobot) - declarative delegation |
| Logging, tracing, cost tracking | [Observability dashboard](https://getbonito.com/docs/observability) - every request, every token |
| Webhook handlers + cron schedulers | [Triggers](https://getbonito.com/docs/triggers) - webhooks, schedules, slash commands |

Atlas is 35 files and ~4,800 lines of config and prompts. The equivalent DIY system is easily 15,000+ lines of application code, plus ongoing maintenance.

## Quick Start

### Prerequisites

- A [Bonito account](https://getbonito.com/signup) (free tier works for testing)
- API keys for your providers (or use [Bonito Managed Inference](https://getbonito.com/docs/managed-inference) - no keys needed)
- GitHub token (for code review and deploy monitoring)

### 1. Clone and configure

```bash
git clone https://github.com/ShabariRepo/atlas.git
cd atlas
cp .env.example .env
# Edit .env with your Bonito API key and provider credentials
```

### 2. Deploy to Bonito

```bash
# Install Bonito CLI (https://getbonito.com/docs/cli)
pip install bonito-cli

# Authenticate with your Bonito account
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

- Point PagerDuty/OpsGenie webhooks to your Bonito agent endpoint
- Add the GitHub webhook for PR events and deploy notifications
- Invite the Slack bot to your channels
- Or just use the Command Center widget and ask questions directly

> **Want it even simpler?** [Bonito Managed Inference](https://getbonito.com/docs/managed-inference) handles provider credentials for you. Skip the API keys entirely - Bonito routes to the best available model automatically.

## How It Works

### The Command Center (Bonobot)

The [Command Center](./agents/command-center/) is the front door. Built as a [Bonobot](https://getbonito.com/docs/bonobot) - Bonito's orchestrator agent type - it classifies what you need and routes to the right specialist:

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

The routing is declarative - define which agent handles which domains in [`delegation-map.json`](./agents/command-center/delegation-map.json). Bonito handles the intent classification and multi-agent coordination.

See [examples/](./examples/) for detailed walkthroughs.

### Bonito Agent Types

Atlas uses all three of Bonito's agent types to show what's possible:

**[BonBon Simple](https://getbonito.com/docs/bonbon)** - Pre-configured agents with optional RAG. Good for straightforward tasks like Q&A and alert triage. Think of it as "agent-as-a-service." Deploy a production agent in minutes, not weeks.

**[BonBon Advanced](https://getbonito.com/docs/bonbon)** - Agents with [MCP](https://getbonito.com/docs/mcp) server connections, scheduled triggers, and webhook integrations. For agents that need to reach out and interact with external systems.

**[Bonobot](https://getbonito.com/docs/bonobot)** - The orchestrator. Routes requests to BonBon agents, handles multi-agent queries, and synthesizes responses. This is your AI operations control plane.

### The Gateway

Every LLM call flows through the [Bonito Gateway](https://getbonito.com/docs/gateway). The gateway handles:

- **Provider routing** - Send each agent to the best provider for its job (Groq for speed, Claude for reasoning, GPT-4o Mini for cost)
- **Automatic failover** - If a provider is down, requests route to the fallback automatically
- **Cost tracking** - See exactly what each agent costs per request, per day, per month
- **Rate limiting** - Protect your budget with configurable limits

All configured in one place: [`bonito.yaml`](./bonito.yaml).

### Declarative Config

The entire Atlas stack is defined in a single [`bonito.yaml`](./bonito.yaml):

```yaml
# One file defines everything:
gateway:
  providers: [anthropic, openai, groq, aws-bedrock]
  routing:
    strategy: cost-optimized

mcp_servers:
  github: { transport: sse, url: https://mcp.getbonito.com/github }
  slack:  { transport: sse, url: https://mcp.getbonito.com/slack }

agents:
  incident-responder:
    type: bonbon
    model: groq/llama-3.3-70b-versatile
    mcp_servers: [pagerduty, slack, jira]

  command-center:
    type: bonobot
    delegates: [incident-responder, code-reviewer, docs-assistant, deploy-monitor]
```

No infrastructure code. No SDK wiring. Define what you want, `bonito deploy`, done.

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
- Use [Bonito Managed Inference](https://getbonito.com/docs/managed-inference) instead of bringing your own keys

## Cost

Running Atlas on [Bonito Pro](https://getbonito.com/pricing) ($499/mo):

| Agent | Monthly Usage | Inference Cost |
|-------|--------------|----------------|
| Incident Responder | ~500 alerts | ~$2 (Groq) |
| Code Reviewer | ~200 PRs | ~$15 (Claude) |
| Docs Assistant | ~2,000 queries | ~$3 (GPT-4o Mini) |
| Deploy Monitor | ~1,000 deploys | ~$2 (Groq) |
| Command Center | ~3,000 routes | ~$8 (Claude) |
| **Total inference** | | **~$30/mo** |

That's a full DevOps AI team for under $550/month. [Compare plans](https://getbonito.com/pricing).

The [free tier](https://getbonito.com/signup) (1,000 calls/month) is enough to test all five agents and validate the architecture.

## Docs

- [Architecture](./docs/ARCHITECTURE.md) - How Atlas works under the hood
- [Customization Guide](./docs/CUSTOMIZATION.md) - Making it yours
- [Bonito Setup](./docs/BONITO-SETUP.md) - Platform setup walkthrough
- [Example: Incident Flow](./examples/incident-flow.md)
- [Example: PR Review Flow](./examples/pr-review-flow.md)
- [Example: Deploy Summary Flow](./examples/deploy-summary-flow.md)

## Bonito Resources

- [Bonito Platform](https://getbonito.com) - Sign up and explore
- [Documentation](https://getbonito.com/docs) - Full platform docs
- [Gateway Guide](https://getbonito.com/docs/gateway) - Multi-provider routing
- [BonBon Agents](https://getbonito.com/docs/bonbon) - Managed agent services
- [Bonobot Orchestration](https://getbonito.com/docs/bonobot) - Multi-agent coordination
- [MCP Integration](https://getbonito.com/docs/mcp) - Tool server connections
- [Pricing](https://getbonito.com/pricing) - Free tier available

## License

MIT - see [LICENSE](./LICENSE)

---

<p align="center">
  Built with <a href="https://getbonito.com">Bonito</a> - the enterprise AI platform for multi-cloud workloads.
  <br>
  <a href="https://getbonito.com/signup">Get started free</a> &bull; <a href="https://getbonito.com/docs">Read the docs</a> &bull; <a href="https://getbonito.com/pricing">See pricing</a>
</p>
