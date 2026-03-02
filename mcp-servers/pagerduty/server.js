const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3101;
const PAGERDUTY_API_KEY = process.env.PAGERDUTY_API_KEY || 'mock-key';

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'pagerduty-mcp', timestamp: new Date().toISOString() });
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
    service: 'pagerduty-mcp',
    capabilities: ['incidents', 'services', 'escalation_policies'],
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

// Mock PagerDuty API endpoints
app.get('/incidents', (req, res) => {
  res.json({
    incidents: [
      {
        id: 'PT4KHLK',
        type: 'incident',
        summary: 'Mock High CPU Usage Alert',
        status: 'triggered',
        urgency: 'high',
        created_at: new Date().toISOString(),
        html_url: 'https://mock.pagerduty.com/incidents/PT4KHLK',
        service: {
          id: 'PWIXJZS',
          summary: 'Production API'
        }
      },
      {
        id: 'PT4KHLM',
        type: 'incident',
        summary: 'Mock Database Connection Issues',
        status: 'acknowledged',
        urgency: 'low',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        html_url: 'https://mock.pagerduty.com/incidents/PT4KHLM',
        service: {
          id: 'PWIXJZT',
          summary: 'Database Service'
        }
      }
    ],
    limit: 25,
    offset: 0,
    more: false,
    total: 2
  });
});

app.get('/services', (req, res) => {
  res.json({
    services: [
      {
        id: 'PWIXJZS',
        name: 'Production API',
        status: 'active',
        created_at: new Date().toISOString(),
        html_url: 'https://mock.pagerduty.com/services/PWIXJZS'
      },
      {
        id: 'PWIXJZT',
        name: 'Database Service',
        status: 'active',
        created_at: new Date().toISOString(),
        html_url: 'https://mock.pagerduty.com/services/PWIXJZT'
      }
    ],
    limit: 25,
    offset: 0,
    more: false,
    total: 2
  });
});

app.put('/incidents/:id', (req, res) => {
  const { id } = req.params;
  const { incident } = req.body;
  
  res.json({
    incident: {
      id,
      type: 'incident',
      status: incident.status || 'acknowledged',
      summary: 'Updated incident (mock)',
      html_url: `https://mock.pagerduty.com/incidents/${id}`
    }
  });
});

app.post('/incidents', (req, res) => {
  const newIncident = {
    id: 'PT' + Math.random().toString(36).substr(2, 5).toUpperCase(),
    type: 'incident',
    status: 'triggered',
    summary: req.body.incident?.title || 'New Mock Incident',
    created_at: new Date().toISOString(),
    html_url: 'https://mock.pagerduty.com/incidents/PTNEWID'
  };
  
  res.json({ incident: newIncident });
});

// Generic catch-all for other PagerDuty API calls
app.all('/*', (req, res) => {
  res.json({ 
    message: 'Mock PagerDuty MCP Server Response', 
    method: req.method,
    path: req.path,
    authenticated: PAGERDUTY_API_KEY !== 'mock-key'
  });
});

app.listen(PORT, () => {
  console.log(`PagerDuty MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});