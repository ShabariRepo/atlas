# Command Center (Bonobot Orchestrator)

**Type:** Bonobot  
**Model:** Anthropic Claude Sonnet (primary) → OpenAI GPT-4o (fallback)  
**Role:** Orchestrator — routes requests to specialized agents

## What It Does

The Command Center is the brain of Atlas. It's a Bonobot — Bonito's orchestrator agent — that understands what you need and delegates to the right specialist agent. Think of it as your single interface to the entire DevOps stack.

### How It Works

```
User: "What's the status of production?"
             │
             ▼
    ┌──────────────────┐
    │  Command Center   │
    │  (Intent Router)  │
    └────────┬─────────┘
             │
    Classify: deployment_monitoring + incident_check
             │
     ┌───────┴───────┐
     ▼               ▼
┌──────────┐  ┌──────────────┐
│  Deploy   │  │   Incident   │
│  Monitor  │  │  Responder   │
└─────┬────┘  └──────┬───────┘
      │               │
      ▼               ▼
 "3 deploys    "No active
  today, all    incidents"
  successful"
      │               │
      └───────┬───────┘
              ▼
    ┌──────────────────┐
    │    Synthesize     │
    │  "Prod is healthy │
    │   — 3 successful  │
    │   deploys, no     │
    │   incidents"      │
    └──────────────────┘
```

## Key Capabilities

### Intent-Based Routing

The Command Center classifies your intent and routes to the best agent:

| You Say | Routed To |
|---------|-----------|
| "There's a P1 alert on the API" | 🚨 Incident Responder |
| "Review PR #42" | 🔍 Code Reviewer |
| "How do I configure Redis caching?" | 📚 Docs Assistant |
| "What deployed to production today?" | 📊 Deploy Monitor |
| "What's the status of prod?" | 📊 Deploy Monitor + 🚨 Incident Responder |

### Multi-Agent Queries

Some questions need multiple agents. The Command Center handles this automatically:

- **"Production status"** → Checks deploys AND incidents
- **"Things broke after the last deploy"** → Checks what deployed AND triages the issue
- **"How do I roll back?"** → Gets the rollback procedure AND current deploy state

### Transparent Delegation

You always know which agent is handling your request:

```
📡 Routing to Deploy Monitor and Incident Responder...

### From Deploy Monitor
3 deployments to production today, all successful.
Latest: api-gateway v2.4.1 deployed at 2:30 PM by @sarah.

### From Incident Responder
No active incidents. Last resolved: P3 Redis latency spike (resolved 6h ago).

### Summary
Production is healthy. All deploys succeeded today with no active incidents.
```

## Configuration

### Delegation Map

`delegation-map.json` defines how intents map to agents. Each entry includes:
- **Keywords**: Words that suggest this agent
- **Patterns**: Regex patterns for more precise matching
- **Examples**: Training examples for intent classification

The model uses these hints alongside its own understanding — it's not just keyword matching.

### Multi-Agent Rules

For queries that span agents, `delegation-map.json` includes `multi_agent_rules` that define:
- Which patterns trigger multi-agent queries
- Which agents to involve
- How to synthesize the combined response

### Channels

The Command Center can be accessed via:
- **Slack**: `/atlas` or `/ops` commands, or @mention the bot
- **Widget**: Embeddable on internal dashboards
- **API**: Direct API calls for programmatic access

## Customization

### Adding a New Agent

To add a new specialist agent to the Command Center:

1. Create the agent (follow any existing agent as a template)
2. Add it to `delegates` in `config.json`:
   ```json
   {
     "agent_id": "atlas-your-new-agent",
     "name": "Your Agent",
     "domains": ["keyword1", "keyword2"],
     "description": "What it does",
     "examples": ["Example query 1", "Example query 2"]
   }
   ```
3. Add routing rules to `delegation-map.json`
4. Update the Command Center's system prompt to describe the new agent

### Adjusting Routing

If the Command Center is misrouting requests:
1. Add more examples to `delegation-map.json` for the correct agent
2. Adjust the `confidence_threshold` in `config.json` (lower = more confident routing, higher = more clarification questions)
3. Add specific patterns for edge cases

### Response Style

The Command Center's personality and response format are controlled by `system-prompt.md`. Adjust the tone, format, and behavior rules to match your team's preferences.

## Why Claude Sonnet for Orchestration?

The orchestrator needs to:
- Accurately classify intent from natural language
- Decide when to involve multiple agents
- Synthesize diverse responses into a coherent answer
- Follow complex routing instructions precisely

Claude Sonnet's instruction-following and reasoning capabilities make it ideal for this coordination role. The low temperature (0.1) ensures consistent, predictable routing.
