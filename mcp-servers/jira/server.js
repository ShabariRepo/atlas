const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3103;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'jira-mcp', timestamp: new Date().toISOString() });
});

const TOOLS = [
  {
    name: 'create_issue',
    description: 'Create a new Jira issue',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project key (e.g. OPS)' },
        summary: { type: 'string', description: 'Issue title' },
        description: { type: 'string', description: 'Issue description' },
        issue_type: { type: 'string', enum: ['Bug', 'Task', 'Story', 'Incident'], default: 'Task' },
        priority: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
        assignee: { type: 'string', description: 'Username to assign to' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add' }
      },
      required: ['project', 'summary']
    }
  },
  {
    name: 'search_issues',
    description: 'Search Jira issues using JQL',
    inputSchema: {
      type: 'object',
      properties: {
        jql: { type: 'string', description: 'JQL query string' },
        limit: { type: 'number', default: 10 }
      },
      required: ['jql']
    }
  },
  {
    name: 'update_issue',
    description: 'Update an existing Jira issue',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string', description: 'Issue key (e.g. OPS-123)' },
        status: { type: 'string', description: 'New status' },
        assignee: { type: 'string' },
        comment: { type: 'string', description: 'Comment to add' },
        priority: { type: 'string' }
      },
      required: ['issue_key']
    }
  },
  {
    name: 'get_issue',
    description: 'Get details of a specific Jira issue',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string', description: 'Issue key (e.g. OPS-123)' }
      },
      required: ['issue_key']
    }
  }
];

let issueCounter = 200;

function handleToolCall(toolName, args) {
  switch (toolName) {
    case 'create_issue': {
      issueCounter++;
      const key = `${args.project || 'OPS'}-${issueCounter}`;
      return JSON.stringify({
        key, id: `${10000 + issueCounter}`,
        summary: args.summary, status: 'Open',
        issue_type: args.issue_type || 'Task',
        priority: args.priority || 'Medium',
        assignee: args.assignee || 'unassigned',
        url: `https://your-org.atlassian.net/browse/${key}`
      });
    }
    case 'search_issues':
      return JSON.stringify({ issues: [
        { key: 'OPS-189', summary: 'Investigate prod-api-3 CPU spike', status: 'In Progress', priority: 'High', assignee: 'dev-alice', updated: new Date(Date.now() - 3600000).toISOString() },
        { key: 'OPS-185', summary: 'Payment service timeout errors', status: 'Open', priority: 'Critical', assignee: 'dev-bob', updated: new Date(Date.now() - 7200000).toISOString() },
        { key: 'OPS-180', summary: 'Upgrade Redis to 7.2', status: 'To Do', priority: 'Medium', assignee: null, updated: new Date(Date.now() - 86400000).toISOString() }
      ], total: 3 });
    case 'update_issue':
      return JSON.stringify({
        key: args.issue_key, updated: true,
        changes: {
          ...(args.status && { status: args.status }),
          ...(args.assignee && { assignee: args.assignee }),
          ...(args.comment && { comment_added: true }),
          ...(args.priority && { priority: args.priority })
        }
      });
    case 'get_issue':
      return JSON.stringify({
        key: args.issue_key, summary: 'Investigate prod-api-3 CPU spike',
        description: 'CPU usage on prod-api-3 exceeded 90% threshold. Needs investigation.',
        status: 'In Progress', priority: 'High', issue_type: 'Incident',
        assignee: 'dev-alice', reporter: 'pagerduty-integration',
        created: new Date(Date.now() - 7200000).toISOString(),
        comments: [
          { author: 'dev-alice', body: 'Looking into this - appears related to the new cache layer', created: new Date(Date.now() - 3600000).toISOString() }
        ]
      });
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

app.get('/sse', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.write(`data: ${JSON.stringify({ type: 'connection', service: 'jira-mcp' })}\n\n`);
  const keepAlive = setInterval(() => res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`), 30000);
  req.on('close', () => clearInterval(keepAlive));
});

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
        serverInfo: { name: 'jira-mcp', version: '1.0.0' }
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
  console.log(`Jira MCP Server running on port ${PORT}`);
});
