const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3100;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'mock-token';

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'github-mcp', timestamp: new Date().toISOString() });
});

// SSE endpoint for MCP protocol
app.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    service: 'github-mcp',
    capabilities: ['pull_requests', 'issues', 'code_search', 'actions'],
    status: 'connected'
  })}\\n\\n`);

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    })}\\n\\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Mock GitHub API endpoints
app.get('/repos/:owner/:repo/pulls', (req, res) => {
  res.json([
    {
      id: 1,
      number: 42,
      title: 'Mock PR: Add new feature',
      state: 'open',
      user: { login: 'mockuser' },
      created_at: new Date().toISOString(),
      html_url: 'https://github.com/mockorg/mockrepo/pull/42'
    }
  ]);
});

app.get('/repos/:owner/:repo/issues', (req, res) => {
  res.json([
    {
      id: 1,
      number: 123,
      title: 'Mock Issue: Fix bug',
      state: 'open',
      user: { login: 'mockuser' },
      created_at: new Date().toISOString(),
      html_url: 'https://github.com/mockorg/mockrepo/issues/123'
    }
  ]);
});

app.post('/repos/:owner/:repo/actions/runs/:run_id/rerun', (req, res) => {
  res.json({ message: 'Workflow run restarted successfully (mock)' });
});

// Generic catch-all for other GitHub API calls
app.all('/repos/*', (req, res) => {
  res.json({ 
    message: 'Mock GitHub MCP Server Response', 
    method: req.method,
    path: req.path,
    authenticated: GITHUB_TOKEN !== 'mock-token'
  });
});

app.listen(PORT, () => {
  console.log(`GitHub MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});