const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3101;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'pagerduty-mcp', timestamp: new Date().toISOString() });
});

// MCP tools this server exposes
const TOOLS = [
  {
    name: 'list_incidents',
    description: 'List active PagerDuty incidents with status, urgency, and assigned responders',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['triggered', 'acknowledged', 'resolved', 'all'], description: 'Filter by incident status', default: 'all' },
        urgency: { type: 'string', enum: ['high', 'low', 'all'], description: 'Filter by urgency', default: 'all' },
        limit: { type: 'number', description: 'Max incidents to return', default: 10 }
      }
    }
  },
  {
    name: 'get_incident',
    description: 'Get detailed information about a specific PagerDuty incident',
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: { type: 'string', description: 'The PagerDuty incident ID' }
      },
      required: ['incident_id']
    }
  },
  {
    name: 'acknowledge_incident',
    description: 'Acknowledge a PagerDuty incident',
    inputSchema: {
      type: 'object',
      properties: {
        incident_id: { type: 'string', description: 'The PagerDuty incident ID' }
      },
      required: ['incident_id']
    }
  },
  {
    name: 'list_services',
    description: 'List PagerDuty services and their current status',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Mock data
const MOCK_INCIDENTS = [
  { id: 'INC-001', title: 'High CPU usage on prod-api-3', status: 'triggered', urgency: 'high', service: 'prod-api', created_at: new Date(Date.now() - 300000).toISOString(), assigned_to: 'oncall-team' },
  { id: 'INC-002', title: 'Elevated error rate on payment-service', status: 'acknowledged', urgency: 'high', service: 'payment-service', created_at: new Date(Date.now() - 1800000).toISOString(), assigned_to: 'payments-team' },
  { id: 'INC-003', title: 'Disk usage above 85% on db-replica-2', status: 'triggered', urgency: 'low', service: 'database', created_at: new Date(Date.now() - 7200000).toISOString(), assigned_to: 'infra-team' }
];

const MOCK_SERVICES = [
  { id: 'SVC-001', name: 'prod-api', status: 'critical', incident_count: 1 },
  { id: 'SVC-002', name: 'payment-service', status: 'warning', incident_count: 1 },
  { id: 'SVC-003', name: 'database', status: 'warning', incident_count: 1 },
  { id: 'SVC-004', name: 'frontend-cdn', status: 'active', incident_count: 0 },
  { id: 'SVC-005', name: 'auth-service', status: 'active', incident_count: 0 }
];

// Tool execution handlers
function handleToolCall(toolName, args) {
  switch (toolName) {
    case 'list_incidents': {
      let incidents = [...MOCK_INCIDENTS];
      if (args.status && args.status !== 'all') incidents = incidents.filter(i => i.status === args.status);
      if (args.urgency && args.urgency !== 'all') incidents = incidents.filter(i => i.urgency === args.urgency);
      const limit = args.limit || 10;
      return JSON.stringify({ incidents: incidents.slice(0, limit), total: incidents.length });
    }
    case 'get_incident': {
      const incident = MOCK_INCIDENTS.find(i => i.id === args.incident_id);
      if (!incident) return JSON.stringify({ error: `Incident ${args.incident_id} not found` });
      return JSON.stringify({ incident, timeline: [
        { timestamp: incident.created_at, event: 'Incident triggered' },
        { timestamp: new Date().toISOString(), event: 'Current status: ' + incident.status }
      ]});
    }
    case 'acknowledge_incident': {
      const inc = MOCK_INCIDENTS.find(i => i.id === args.incident_id);
      if (!inc) return JSON.stringify({ error: `Incident ${args.incident_id} not found` });
      return JSON.stringify({ success: true, incident_id: args.incident_id, previous_status: inc.status, new_status: 'acknowledged' });
    }
    case 'list_services':
      return JSON.stringify({ services: MOCK_SERVICES });
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// SSE endpoint (legacy MCP transport)
app.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ type: 'connection', service: 'pagerduty-mcp', status: 'connected' })}\n\n`);
  const keepAlive = setInterval(() => res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`), 30000);
  req.on('close', () => clearInterval(keepAlive));
});

// JSON-RPC 2.0 handler (MCP Streamable HTTP transport)
app.post('/sse', handleJsonRpc);
app.post('/', handleJsonRpc);

function handleJsonRpc(req, res) {
  const { jsonrpc, id, method, params } = req.body;

  if (jsonrpc !== '2.0') {
    return res.json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } });
  }

  // Notifications (no id) - just acknowledge
  if (id === undefined) {
    return res.status(204).send();
  }

  switch (method) {
    case 'initialize':
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'pagerduty-mcp', version: '1.0.0' }
        }
      });

    case 'tools/list':
      return res.json({
        jsonrpc: '2.0', id,
        result: { tools: TOOLS }
      });

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const resultText = handleToolCall(toolName, args);
      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: resultText }] }
      });
    }

    default:
      return res.json({
        jsonrpc: '2.0', id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
  }
}

app.listen(PORT, () => {
  console.log(`PagerDuty MCP Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/sse`);
});
