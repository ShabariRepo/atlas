const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3100;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'github-mcp', timestamp: new Date().toISOString() });
});

const TOOLS = [
  {
    name: 'list_pull_requests',
    description: 'List open pull requests for a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
        limit: { type: 'number', default: 10 }
      },
      required: ['repo']
    }
  },
  {
    name: 'get_pull_request',
    description: 'Get details of a specific pull request including diff stats',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format' },
        pr_number: { type: 'number', description: 'Pull request number' }
      },
      required: ['repo', 'pr_number']
    }
  },
  {
    name: 'list_workflow_runs',
    description: 'List recent GitHub Actions workflow runs',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format' },
        status: { type: 'string', enum: ['completed', 'in_progress', 'queued', 'all'], default: 'all' },
        limit: { type: 'number', default: 10 }
      },
      required: ['repo']
    }
  },
  {
    name: 'search_code',
    description: 'Search for code across repositories',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        repo: { type: 'string', description: 'Limit to specific repo (owner/repo)' }
      },
      required: ['query']
    }
  },
  {
    name: 'list_issues',
    description: 'List issues for a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format' },
        state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' },
        labels: { type: 'string', description: 'Comma-separated label names' }
      },
      required: ['repo']
    }
  }
];

function handleToolCall(toolName, args) {
  switch (toolName) {
    case 'list_pull_requests':
      return JSON.stringify({ pull_requests: [
        { number: 42, title: 'feat: add Redis caching layer', author: 'dev-alice', state: 'open', additions: 340, deletions: 12, changed_files: 8, created_at: new Date(Date.now() - 86400000).toISOString(), labels: ['enhancement', 'needs-review'] },
        { number: 41, title: 'fix: resolve race condition in auth middleware', author: 'dev-bob', state: 'open', additions: 25, deletions: 8, changed_files: 2, created_at: new Date(Date.now() - 172800000).toISOString(), labels: ['bug', 'security'] },
        { number: 40, title: 'chore: upgrade dependencies', author: 'dependabot', state: 'open', additions: 150, deletions: 140, changed_files: 3, created_at: new Date(Date.now() - 259200000).toISOString(), labels: ['dependencies'] }
      ], total: 3 });

    case 'get_pull_request': {
      const pr = args.pr_number || 42;
      return JSON.stringify({
        number: pr, title: 'feat: add Redis caching layer', author: 'dev-alice', state: 'open',
        body: 'Adds Redis caching for API responses. Reduces p99 latency by ~40%.',
        additions: 340, deletions: 12, changed_files: 8,
        files: [
          { filename: 'src/cache/redis.ts', status: 'added', additions: 180, deletions: 0 },
          { filename: 'src/middleware/cache.ts', status: 'added', additions: 95, deletions: 0 },
          { filename: 'src/config/redis.ts', status: 'added', additions: 45, deletions: 0 },
          { filename: 'tests/cache.test.ts', status: 'added', additions: 20, deletions: 0 },
          { filename: 'package.json', status: 'modified', additions: 0, deletions: 12 }
        ],
        reviews: [{ user: 'lead-dev', state: 'CHANGES_REQUESTED', body: 'Need TTL config for cache keys' }],
        checks: { total: 5, passing: 4, failing: 1, pending: 0 }
      });
    }

    case 'list_workflow_runs':
      return JSON.stringify({ workflow_runs: [
        { id: 9001, name: 'CI', status: 'completed', conclusion: 'success', branch: 'main', event: 'push', duration_seconds: 245, created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 9000, name: 'Deploy Production', status: 'completed', conclusion: 'success', branch: 'main', event: 'push', duration_seconds: 180, created_at: new Date(Date.now() - 7200000).toISOString() },
        { id: 8999, name: 'CI', status: 'completed', conclusion: 'failure', branch: 'feature/auth-fix', event: 'pull_request', duration_seconds: 120, created_at: new Date(Date.now() - 14400000).toISOString() }
      ]});

    case 'search_code':
      return JSON.stringify({ results: [
        { path: 'src/config/redis.ts', repo: args.repo || 'org/api', snippet: `const REDIS_HOST = process.env.REDIS_HOST || 'localhost';`, line: 12 },
        { path: 'src/cache/redis.ts', repo: args.repo || 'org/api', snippet: `export class RedisCache { constructor(private client: Redis) {} }`, line: 5 }
      ], total: 2 });

    case 'list_issues':
      return JSON.stringify({ issues: [
        { number: 128, title: 'Memory leak in WebSocket handler', state: 'open', labels: ['bug', 'P1'], assignee: 'dev-bob', created_at: new Date(Date.now() - 432000000).toISOString() },
        { number: 125, title: 'Add rate limiting to public API', state: 'open', labels: ['enhancement'], assignee: null, created_at: new Date(Date.now() - 864000000).toISOString() }
      ], total: 2 });

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// SSE endpoint (legacy)
app.get('/sse', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.write(`data: ${JSON.stringify({ type: 'connection', service: 'github-mcp' })}\n\n`);
  const keepAlive = setInterval(() => res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`), 30000);
  req.on('close', () => clearInterval(keepAlive));
});

// JSON-RPC 2.0 (MCP Streamable HTTP)
app.post('/sse', handleJsonRpc);
app.post('/', handleJsonRpc);

function handleJsonRpc(req, res) {
  const { jsonrpc, id, method, params } = req.body;
  if (jsonrpc !== '2.0') return res.json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } });
  if (id === undefined) return res.status(204).send();

  switch (method) {
    case 'initialize':
      return res.json({ jsonrpc: '2.0', id, result: {
        protocolVersion: '2024-11-05', capabilities: { tools: {} },
        serverInfo: { name: 'github-mcp', version: '1.0.0' }
      }});
    case 'tools/list':
      return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    case 'tools/call': {
      const resultText = handleToolCall(params?.name, params?.arguments || {});
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: resultText }] } });
    }
    default:
      return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

app.listen(PORT, () => {
  console.log(`GitHub MCP Server running on port ${PORT}`);
});
