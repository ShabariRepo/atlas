# Architecture

How Atlas works under the hood.

## System Overview

```
                    User Request
                         |
                         v
              +--------------------+
              |   Bonito Gateway   |  <-- Routes to cheapest/fastest/best provider
              |  (Multi-Provider)  |      Handles auth, rate limits, failover
              +---------+----------+
                        |
                        v
              +--------------------+
              |  Command Center    |  <-- Bonobot: classifies intent, delegates
              |   (Orchestrator)   |
              +---------+----------+
                        |
           +------+-----+-----+------+
           |      |           |      |
           v      v           v      v
       Incident  Code       Docs   Deploy
       Responder Reviewer   Asst   Monitor
           |      |           |      |
           v      v           v      v
       PagerDuty GitHub     RAG    GitHub
       Jira      MCP       (KB)   Actions
       Slack                       Slack
```

## Request Flow

### 1. Gateway Layer

Every request enters through the Bonito Gateway. The gateway:

- **Authenticates** the request (API key or session token)
- **Routes** to the configured provider based on the agent's model selection
- **Falls back** automatically if a provider is down or rate-limited
- **Logs** the request for observability (tokens, latency, cost)
- **Enforces** rate limits and quota

The gateway is provider-agnostic. Agents don't know or care which cloud they're hitting.

### 2. Orchestration Layer (Command Center)

The Command Center is a Bonobot - Bonito's orchestrator agent type. When a request arrives:

1. **Intent Classification** - Analyzes the user's message to determine which domain(s) it belongs to
2. **Agent Selection** - Maps domains to agents using the delegation map
3. **Context Passing** - Forwards relevant context to the selected agent(s)
4. **Response Synthesis** - Combines multi-agent responses into a coherent answer

The orchestrator uses Claude Sonnet for routing because intent classification requires strong instruction following. Speed isn't critical here (routing adds ~200ms).

### 3. Agent Layer

Each agent is a BonBon - Bonito's managed agent type. Agents are specialized:

| Agent | Provider Choice | Why |
|-------|----------------|-----|
| Incident Responder | Groq (Llama 3.3 70B) | Speed. Sub-second triage matters during outages |
| Code Reviewer | Anthropic (Claude Sonnet) | Depth. Code review needs strong reasoning |
| Docs Assistant | OpenAI (GPT-4o Mini) | Cost. High-volume Q&A should be cheap |
| Deploy Monitor | Groq (Llama 3.3 70B) | Speed. Deploy notifications should be near-instant |

### 4. Integration Layer

Agents connect to external systems through two mechanisms:

**MCP (Model Context Protocol)** - Standardized tool servers that expose capabilities:
- GitHub MCP: Read PRs, post comments, check workflows
- PagerDuty MCP: Read incidents, acknowledge alerts
- Slack MCP: Post messages, manage threads
- Jira MCP: Create/update tickets, search issues

**RAG (Retrieval-Augmented Generation)** - For the Docs Assistant:
- Documents are chunked and embedded via Bonito's KB system
- Queries hit a vector search to find relevant chunks
- Chunks are injected into the agent's context
- Agent responds grounded in actual documentation

## Data Flow Examples

### Incident Alert

```
PagerDuty Alert
    -> Webhook hits Bonito
    -> Incident Responder receives alert payload
    -> Classifies severity (P1/P2/P3/P4)
    -> Creates Jira ticket (via Jira MCP)
    -> Posts to #incidents (via Slack MCP)
    -> Suggests runbook (via RAG search)
    -> Total time: ~2-3 seconds
```

### PR Review

```
GitHub PR Opened
    -> Webhook hits Bonito
    -> Code Reviewer receives PR metadata
    -> Reads full diff (via GitHub MCP)
    -> Reads relevant files for context (via GitHub MCP)
    -> Analyzes: security, performance, correctness
    -> Posts inline comments (via GitHub MCP)
    -> Posts summary review (via GitHub MCP)
    -> Total time: ~10-30 seconds (depends on PR size)
```

### Multi-Agent Query

```
User: "We just deployed and things are broken"
    -> Command Center classifies: Deploy Monitor + Incident Responder
    -> Parallel dispatch:
        -> Deploy Monitor: Checks recent deploys, identifies what changed
        -> Incident Responder: Checks for active alerts, current status
    -> Command Center synthesizes:
        "Deploy #847 went out 12 minutes ago (auth-service, 43 files changed).
         There's an active P2 alert: elevated 500s on /api/auth/*.
         Likely related. Suggested: roll back deploy #847."
    -> Total time: ~3-5 seconds
```

## Bonito Platform Components

| Component | Role in Atlas |
|-----------|--------------|
| **Gateway** | Routes all LLM calls, handles provider auth and failover |
| **BonBon Engine** | Manages agent lifecycle, system prompts, triggers |
| **Bonobot Engine** | Handles delegation logic, multi-agent coordination |
| **MCP Registry** | Manages connections to GitHub, PagerDuty, Slack, Jira |
| **Knowledge Base** | Stores and searches documentation for RAG |
| **Observability** | Traces every request, tracks tokens and costs |
| **Billing** | Metered usage across all agents and providers |

## Why This Architecture

**Separation of concerns.** Each agent does one thing well. The orchestrator handles routing. The gateway handles infrastructure. No agent needs to know about provider APIs or failover logic.

**Provider flexibility.** Swap Groq for AWS Bedrock by changing one line in `bonito.yaml`. The agents don't change.

**Cost optimization.** Use expensive models only where they matter (code review). Use fast/cheap models everywhere else. The gateway tracks spend per agent.

**Resilience.** If Groq goes down, the Incident Responder falls back to GPT-4o Mini automatically. No code change, no downtime.
