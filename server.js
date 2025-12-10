import http from 'http';
import https from 'https';

/**
 * MT5 Receiver Service
 * Deploy on Render.com
 * Receives data from MT5 EA and forwards to Backend Server
 */

const BACKEND_SERVER_URL = process.env.BACKEND_SERVER_URL || 'http://localhost:8080';
const PORT = process.env.PORT || 3001;

// Helper function to forward data to backend
function forwardToBackend(data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BACKEND_SERVER_URL}/api/data`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = httpModule.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ Forwarded to backend: ${data.symbol} | ${data.bars?.length || 0} bars`);
          resolve(JSON.parse(responseData));
        } else {
          console.error(`❌ Backend error: ${res.statusCode} - ${responseData}`);
          reject(new Error(`Backend returned ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Error forwarding to backend:`, error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
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
      backend: BACKEND_SERVER_URL,
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
        
        // Forward to backend server
        try {
          await forwardToBackend(data);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            message: 'Data received and forwarded to backend',
            barsCount: barsCount,
          }));
        } catch (error) {
          console.error('❌ Failed to forward to backend:', error.message);
          
          // Still return success to MT5 EA, but log the error
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'warning',
            message: 'Data received but failed to forward to backend',
            error: error.message,
          }));
        }
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

// Start server
server.listen(PORT, () => {
  console.log(`🚀 MT5 Receiver Service running on port ${PORT}`);
  console.log(`📡 Backend Server: ${BACKEND_SERVER_URL}`);
  console.log(`📥 Endpoint: POST /api/mt5-data`);
  console.log(`❤️  Health Check: GET /health\n`);
});

