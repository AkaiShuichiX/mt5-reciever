import http from 'http';
import { WebSocketServer } from 'ws';

/**
 * MT5 Receiver Service
 * Deploy on Render.com
 * Receives data from MT5 EA and stores it
 * Backend Server connects via WebSocket to receive data
 */

const PORT = process.env.PORT || 3001;

// Store connected backend clients
const backendClients = new Set();

// Store latest data (for new connections)
let latestData = null;

// Broadcast data to all connected backend clients
function broadcastToBackends(data) {
  const dataStr = JSON.stringify(data);
  let sentCount = 0;
  
  backendClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(dataStr);
        sentCount++;
      } catch (error) {
        console.error('❌ Error sending to backend client:', error.message);
      }
    }
  });
  
  if (sentCount > 0) {
    console.log(`✅ Broadcasted to ${sentCount} backend client(s): ${data.symbol} | ${data.bars?.length || 0} bars`);
  }
  
  return sentCount;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'MT5 Receiver',
      connectedBackends: backendClients.size,
      hasLatestData: !!latestData,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Handle MT5 EA data
  if (req.method === 'POST' && req.url === '/api/mt5-data') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const barsCount = data.bars?.length || 0;
        
        console.log(`📥 Received from MT5: ${data.symbol || 'Unknown'} | Bars: ${barsCount}`);
        
        // Store latest data
        latestData = data;
        
        // Broadcast to all connected backend clients via WebSocket
        const sentCount = broadcastToBackends(data);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          message: 'Data received',
          barsCount: barsCount,
          backendClients: sentCount,
        }));
      } catch (error) {
        console.error('❌ Error parsing data:', error.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'error',
          message: 'Invalid JSON',
        }));
      }
    });
    
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'error', message: 'Not found' }));
});

// Create WebSocket server for backend connections
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`✅ Backend client connected from ${clientIp}`);
  
  backendClients.add(ws);
  
  // Send latest data if available (for reconnection)
  if (latestData) {
    try {
      ws.send(JSON.stringify(latestData));
      console.log(`📤 Sent latest data to new backend client`);
    } catch (error) {
      console.error('❌ Error sending latest data:', error.message);
    }
  }
  
  ws.on('close', () => {
    backendClients.delete(ws);
    console.log(`❌ Backend client disconnected. Remaining: ${backendClients.size}`);
  });
  
  ws.on('error', (error) => {
    console.error('⚠️ Backend WebSocket error:', error.message);
    backendClients.delete(ws);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Connected to MT5 Receiver',
    service: 'MT5 Receiver',
    timestamp: new Date().toISOString(),
  }));
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 MT5 Receiver Service running on port ${PORT}`);
  console.log(`📥 MT5 Endpoint: POST /api/mt5-data`);
  console.log(`🔌 Backend WebSocket: ws://localhost:${PORT}`);
  console.log(`❤️  Health Check: GET /health`);
  console.log(`⏳ Waiting for MT5 EA data and backend connections...\n`);
});

