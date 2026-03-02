const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3103;
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://mock.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL || 'mock@example.com';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || 'mock-token';

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'jira-mcp', timestamp: new Date().toISOString() });
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
    service: 'jira-mcp',
    capabilities: ['create_issue', 'update_issue', 'search', 'transitions'],
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

// Mock Jira API endpoints
app.post('/rest/api/3/issue', (req, res) => {
  const { fields } = req.body;
  const newIssue = {
    id: '10' + Math.floor(Math.random() * 1000),
    key: 'MOCK-' + Math.floor(Math.random() * 1000),
    self: `${JIRA_BASE_URL}/rest/api/3/issue/MOCK-123`,
    fields: {
      summary: fields?.summary || 'Mock Issue',
      status: { name: 'To Do', id: '1' },
      issuetype: { name: 'Task', id: '10001' },
      project: { key: 'MOCK', id: '10000' },
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  };
  
  res.json(newIssue);
});

app.get('/rest/api/3/search', (req, res) => {
  const { jql } = req.query;
  res.json({
    expand: 'names,schema',
    startAt: 0,
    maxResults: 50,
    total: 2,
    issues: [
      {
        id: '10001',
        key: 'MOCK-1',
        self: `${JIRA_BASE_URL}/rest/api/3/issue/MOCK-1`,
        fields: {
          summary: 'Mock Issue: Production Deployment',
          status: { name: 'In Progress', id: '3' },
          issuetype: { name: 'Task', id: '10001' },
          project: { key: 'MOCK', id: '10000' },
          assignee: { displayName: 'Mock User' }
        }
      },
      {
        id: '10002',
        key: 'MOCK-2',
        self: `${JIRA_BASE_URL}/rest/api/3/issue/MOCK-2`,
        fields: {
          summary: 'Mock Bug: API Timeout',
          status: { name: 'To Do', id: '1' },
          issuetype: { name: 'Bug', id: '10004' },
          project: { key: 'MOCK', id: '10000' },
          assignee: { displayName: 'Mock Developer' }
        }
      }
    ]
  });
});

app.put('/rest/api/3/issue/:issueKey', (req, res) => {
  const { issueKey } = req.params;
  const { fields } = req.body;
  
  res.status(204).json();
});

app.get('/rest/api/3/issue/:issueKey/transitions', (req, res) => {
  const { issueKey } = req.params;
  res.json({
    transitions: [
      {
        id: '2',
        name: 'Close Issue',
        to: { name: 'Done', id: '6' }
      },
      {
        id: '4',
        name: 'Start Progress',
        to: { name: 'In Progress', id: '3' }
      }
    ]
  });
});

app.post('/rest/api/3/issue/:issueKey/transitions', (req, res) => {
  const { issueKey } = req.params;
  const { transition } = req.body;
  
  res.status(204).json();
});

app.get('/rest/api/3/project', (req, res) => {
  res.json([
    {
      id: '10000',
      key: 'MOCK',
      name: 'Mock Project',
      projectTypeKey: 'software',
      self: `${JIRA_BASE_URL}/rest/api/3/project/10000`
    }
  ]);
});

// Generic catch-all for other Jira API calls
app.all('/*', (req, res) => {
  res.json({ 
    message: 'Mock Jira MCP Server Response', 
    method: req.method,
    path: req.path,
    authenticated: JIRA_API_TOKEN !== 'mock-token'
  });
});

app.listen(PORT, () => {
  console.log(`Jira MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});