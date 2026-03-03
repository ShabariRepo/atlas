const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3102;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'slack-mcp', timestamp: new Date().toISOString() });
});

const TOOLS = [
  {
    name: 'send_message',
    description: 'Send a message to a Slack channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel name or ID (e.g. #incidents)' },
        text: { type: 'string', description: 'Message text (supports Slack markdown)' },
        thread_ts: { type: 'string', description: 'Thread timestamp to reply in a thread' }
      },
      required: ['channel', 'text']
    }
  },
  {
    name: 'list_channels',
    description: 'List available Slack channels',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 20 }
      }
    }
  },
  {
    name: 'get_channel_history',
    description: 'Get recent messages from a Slack channel',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel name or ID' },
        limit: { type: 'number', default: 10 }
      },
      required: ['channel']
    }
  },
  {
    name: 'add_reaction',
    description: 'Add an emoji reaction to a message',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        timestamp: { type: 'string', description: 'Message timestamp' },
        emoji: { type: 'string', description: 'Emoji name without colons' }
      },
      required: ['channel', 'timestamp', 'emoji']
    }
  }
];

function handleToolCall(toolName, args) {
  switch (toolName) {
    case 'send_message':
      return JSON.stringify({
        ok: true, channel: args.channel,
        ts: (Date.now() / 1000).toFixed(6),
        message: { text: args.text, user: 'atlas-bot', channel: args.channel }
      });
    case 'list_channels':
      return JSON.stringify({ channels: [
        { id: 'C001', name: 'general', topic: 'Company-wide announcements', member_count: 150 },
        { id: 'C002', name: 'incidents', topic: 'Active incident tracking', member_count: 45 },
        { id: 'C003', name: 'deploys', topic: 'Deployment notifications', member_count: 30 },
        { id: 'C004', name: 'engineering', topic: 'Engineering discussion', member_count: 60 },
        { id: 'C005', name: 'on-call', topic: 'On-call coordination', member_count: 20 }
      ]});
    case 'get_channel_history':
      return JSON.stringify({ messages: [
        { user: 'U001', text: 'Deploying v2.4.1 to production', ts: (Date.now() / 1000 - 300).toFixed(6) },
        { user: 'U002', text: 'All health checks passing post-deploy', ts: (Date.now() / 1000 - 120).toFixed(6) },
        { user: 'atlas-bot', text: 'Deploy summary: 3 services updated, 0 rollbacks', ts: (Date.now() / 1000 - 60).toFixed(6) }
      ]});
    case 'add_reaction':
      return JSON.stringify({ ok: true, emoji: args.emoji, channel: args.channel });
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

app.get('/sse', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  res.write(`data: ${JSON.stringify({ type: 'connection', service: 'slack-mcp' })}\n\n`);
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
        serverInfo: { name: 'slack-mcp', version: '1.0.0' }
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
  console.log(`Slack MCP Server running on port ${PORT}`);
});
