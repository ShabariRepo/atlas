# Docs Assistant

**Type:** BonBon Simple (RAG)  
**Model:** OpenAI GPT-4o-mini (primary) → Groq Llama 3.3 70B (fallback)  
**Interface:** Widget, Slack, API

## What It Does

The Docs Assistant answers engineering questions by searching your internal documentation — runbooks, API docs, architecture guides, and more. It cites sources, gives precise answers, and knows when to say "I don't know."

### Flow

```
Question ("How do I deploy to prod?")
        │
        ▼
  Embed query → Vector search
        │
        ▼
  Retrieve top-k relevant chunks
        │
        ▼
  Rerank for relevance
        │
        ▼
  Generate grounded answer with citations
```

## Why GPT-4o-mini?

Documentation Q&A is high-volume and RAG-grounded — the model doesn't need to "know" the answers, just synthesize retrieved context well. GPT-4o-mini is cost-efficient ($0.15/1M input tokens) and fast enough for interactive use. For a team of 50 engineers asking 20 questions/day, that's pennies.

## Widget Deployment

The Docs Assistant can be embedded as a widget on internal tools:

```html
<!-- Add to any internal page -->
<script
  src="https://widget.getbonito.com/v1/embed.js"
  data-agent-id="atlas-docs-assistant"
  data-bonito-key="${BONITO_API_KEY}"
  data-theme="light"
  data-position="bottom-right">
</script>
```

## Knowledge Base Setup

### Local Documents

Drop Markdown files into `sample-docs/`. They'll be chunked, embedded, and indexed automatically.

The included samples demonstrate the format:
- `redis-caching.md` — How-to guide format
- `deploy-process.md` — Step-by-step runbook format
- `incident-runbook.md` — Decision tree format

### Confluence / Notion Sync

Configure external sources in `config.json` under `rag.sources`. Documents sync on the configured interval (default: 6 hours).

### Embedding & Chunking

Default configuration uses:
- **Embedding model**: `text-embedding-3-small` (OpenAI) — good balance of quality and cost
- **Chunking strategy**: Semantic — splits on headers and paragraph boundaries
- **Chunk size**: 1024 tokens with 128 token overlap

Adjust in `config.json` → `rag.chunking` based on your document structure.

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | For embeddings and generation |
| `BONITO_API_KEY` | For widget authentication |

### Optional (for external doc sources)

| Variable | Description |
|----------|-------------|
| `CONFLUENCE_BASE_URL` | Confluence instance URL |
| `JIRA_EMAIL` | Confluence auth email |
| `JIRA_API_TOKEN` | Confluence auth token |
| `NOTION_TOKEN` | Notion integration token |
| `NOTION_DOCS_DB` | Notion database ID for docs |

## Customization

### Adding Documents

1. Add Markdown files to `sample-docs/` (or your configured directory)
2. Run `bonito knowledge sync --agent atlas-docs-assistant`
3. Documents are chunked, embedded, and available for queries within minutes

### Tuning Retrieval

- **`top_k`**: Number of chunks retrieved (default: 5). Increase for broader answers, decrease for precision.
- **`similarity_threshold`**: Minimum relevance score (default: 0.72). Lower it if the assistant says "I don't know" too often.
- **`reranking`**: Enabled by default. Uses a cross-encoder to reorder results by relevance. Adds ~100ms latency but significantly improves answer quality.

### Widget Theming

Customize the widget appearance in `config.json` → `widget`:
- `theme`: `"light"` or `"dark"`
- `primary_color`: Any hex color
- `position`: `"bottom-right"`, `"bottom-left"`, `"top-right"`, `"top-left"`
