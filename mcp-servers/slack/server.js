const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3102;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || 'mock-token';

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'slack-mcp', timestamp: new Date().toISOString() });
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
    service: 'slack-mcp',
    capabilities: ['send_message', 'channels', 'threads', 'reactions'],
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

// Mock Slack API endpoints
app.post('/chat.postMessage', (req, res) => {
  const { channel, text, thread_ts } = req.body;
  res.json({
    ok: true,
    channel,
    ts: Date.now().toString() + '.000100',
    message: {
      type: 'message',
      subtype: null,
      text: text,
      ts: Date.now().toString() + '.000100',
      user: 'U0123456789',
      team: 'T0123456789'
    }
  });
});

app.get('/conversations.list', (req, res) => {
  res.json({
    ok: true,
    channels: [
      {
        id: 'C0123456789',
        name: 'general',
        is_channel: true,
        is_private: false
      },
      {
        id: 'C0123456790',
        name: 'incidents',
        is_channel: true,
        is_private: false
      },
      {
        id: 'C0123456791',
        name: 'deploys',
        is_channel: true,
        is_private: false
      }
    ]
  });
});

app.post('/reactions.add', (req, res) => {
  const { name, channel, timestamp } = req.body;
  res.json({
    ok: true,
    reaction: name
  });
});

app.get('/conversations.history', (req, res) => {
  const { channel } = req.query;
  res.json({
    ok: true,
    messages: [
      {
        type: 'message',
        text: 'Mock message in channel',
        user: 'U0123456789',
        ts: (Date.now() / 1000).toString(),
        thread_ts: null
      }
    ]
  });
});

// Generic catch-all for other Slack API calls
app.all('/*', (req, res) => {
  res.json({ 
    ok: true,
    message: 'Mock Slack MCP Server Response', 
    method: req.method,
    path: req.path,
    authenticated: SLACK_BOT_TOKEN !== 'mock-token'
  });
});

app.listen(PORT, () => {
  console.log(`Slack MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});