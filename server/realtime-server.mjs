import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import { jwtVerify } from 'jose';

const PORT = parseInt(process.env.CHAT_WS_PORT || '3001', 10);
const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || process.env.JWT_SECRET || 'project-management-super-secret-default-key-32chars'
);

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

// Create Redis subscriber
const redisSub = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  lazyConnect: true,
});

// Map roomName -> Set of WebSockets
const rooms = new Map();

function addToRoom(roomName, ws) {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(ws);
  if (!ws.subscribedRooms) {
    ws.subscribedRooms = new Set();
  }
  ws.subscribedRooms.add(roomName);
}

function removeFromRoom(roomName, ws) {
  if (rooms.has(roomName)) {
    rooms.get(roomName).delete(ws);
    if (rooms.get(roomName).size === 0) {
      rooms.delete(roomName);
    }
  }
  if (ws.subscribedRooms) {
    ws.subscribedRooms.delete(roomName);
  }
}

function removeClientFromAllRooms(ws) {
  if (ws.subscribedRooms) {
    for (const room of ws.subscribedRooms) {
      if (rooms.has(room)) {
        rooms.get(room).delete(ws);
        if (rooms.get(room).size === 0) {
          rooms.delete(room);
        }
      }
    }
    ws.subscribedRooms.clear();
  }
}

// HTTP Server for WebSocket upgrade
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'tta-realtime-chat', port: PORT }));
});

const wss = new WebSocketServer({ noServer: true });

// Parse cookies from headers
function parseCookie(cookieString) {
  if (!cookieString) return {};
  return cookieString.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

server.on('upgrade', async (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const cookies = parseCookie(request.headers.cookie);
    const token =
      url.searchParams.get('token') ||
      cookies['auth_session'] ||
      cookies['auth_token'];

    if (!token) {
      console.warn(`[Upgrade 401] No token found. Cookies present: ${Object.keys(cookies).join(', ') || 'none'}`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload?.userId) {
      console.warn('[Upgrade 401] Payload has no userId:', payload);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.userId = Number(payload.userId);
      ws.user = payload;
      ws.isAlive = true;
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    console.error('[Upgrade Error]', err.message);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw.toString());
      if (data.type === 'subscribe' && data.room) {
        addToRoom(data.room, ws);
        console.log(`[WS] User ${ws.userId} subscribed to room "${data.room}". Total clients in room: ${rooms.get(data.room)?.size || 0}`);
      } else if (data.type === 'unsubscribe' && data.room) {
        removeFromRoom(data.room, ws);
        console.log(`[WS] User ${ws.userId} unsubscribed from room "${data.room}"`);
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // Ignore malformed payloads
    }
  });

  ws.on('close', () => {
    removeClientFromAllRooms(ws);
  });

  // Welcome message with user info
  ws.send(JSON.stringify({ type: 'connected', userId: ws.userId }));
});

// Setup Redis subscription
async function startRedisSubscription() {
  try {
    await redisSub.connect();
    await redisSub.psubscribe('chat:*');

    redisSub.on('pmessage', (pattern, channel, message) => {
      try {
        const payload = JSON.parse(message);
        // channel format: "chat:board:1" or "chat:global"
        const parts = channel.split(':');
        if (parts.length >= 3) {
          const roomKey = `${parts[1]}:${parts[2]}`; // e.g. "board:1"
          const clientSet = rooms.get(roomKey);
          console.log(`[Redis] Received ${channel} (${payload.type}), delivering to room "${roomKey}". Active subscribers: ${clientSet ? clientSet.size : 0}`);
          if (clientSet) {
            const outgoing = JSON.stringify(payload);
            for (const client of clientSet) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(outgoing);
              }
            }
          }
        }

        // Global broadcast for chat list unread counts
        if (channel === 'chat:global') {
          const globalNotice = JSON.stringify({
            type: 'chat.list.refresh',
            scopeType: payload.scopeType,
            scopeId: payload.scopeId,
            occurredAt: payload.occurredAt,
          });
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(globalNotice);
            }
          }
        }
      } catch (err) {
        console.error('Error handling Redis message:', err);
      }
    });

    console.log(`[Realtime] Redis subscriber listening on chat:*`);
  } catch (error) {
    console.warn('[Realtime] Notice: Redis not reachable. Realtime server will fallback to local routing.', error.message);
  }
}

// Heartbeat ping every 30s
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      removeClientFromAllRooms(ws);
      ws.terminate();
    } else {
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

server.listen(PORT, () => {
  console.log(`[Realtime] WebSocket Gateway listening on port ${PORT}`);
  startRedisSubscription();
});
