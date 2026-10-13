import http from 'http';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import { jwtVerify } from 'jose';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

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

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();
const upgradeHandler = typeof app.getUpgradeHandler === 'function' ? app.getUpgradeHandler() : null;

const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (err) {
    console.error('Error handling request:', err);
    res.statusCode = 500;
    res.end('internal server error');
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);

    // Only intercept /ws endpoint for our realtime chat
    if (url.pathname === '/ws') {
      const cookies = parseCookie(request.headers.cookie);
      const token =
        url.searchParams.get('token') ||
        cookies['auth_session'] ||
        cookies['auth_token'];

      if (!token) {
        console.warn(`[WS 401] No token provided for /ws`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (!payload?.userId) {
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
      return;
    }

    // Pass any other upgrades (e.g. Next.js HMR) to Next.js upgradeHandler
    if (upgradeHandler) {
      upgradeHandler(request, socket, head);
    }
  } catch (err) {
    console.error('[WS Upgrade Error]', err.message);
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
        console.log(`[WS] User ${ws.userId} subscribed to room "${data.room}". Active clients in room: ${rooms.get(data.room)?.size || 0}`);
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

  ws.send(JSON.stringify({ type: 'connected', userId: ws.userId }));
});

// Setup Redis subscription
async function startRedisSubscription() {
  try {
    await redisSub.connect();
    await redisSub.psubscribe('chat:*', 'board:*');

    redisSub.on('pmessage', (pattern, channel, message) => {
      try {
        const payload = JSON.parse(message);
        const parts = channel.split(':');
        const matchedRooms = new Set();
        if (parts.length >= 3) {
          matchedRooms.add(`${parts[1]}:${parts[2]}`); // e.g. "kanban:4" or "board:4"
          matchedRooms.add(`${parts[0]}:${parts[1]}`); // e.g. "board:kanban"
          matchedRooms.add(`${parts[0]}:${parts[2]}`); // e.g. "board:4"
          matchedRooms.add(channel); // e.g. "board:kanban:4"
        } else if (parts.length === 2) {
          matchedRooms.add(channel);
          matchedRooms.add(`${parts[0]}:${parts[1]}`);
        }

        const deliveredClients = new Set();
        for (const roomKey of matchedRooms) {
          const clientSet = rooms.get(roomKey);
          if (clientSet && clientSet.size > 0) {
            console.log(`[Redis] Received ${channel} (${payload.type || payload.op || 'event'}), delivering to room "${roomKey}". Subscribers: ${clientSet.size}`);
            const outgoing = JSON.stringify(payload);
            for (const client of clientSet) {
              if (client.readyState === WebSocket.OPEN && !deliveredClients.has(client)) {
                deliveredClients.add(client);
                client.send(outgoing);
              }
            }
          }
        }

        if (channel === 'chat:global') {
          const isBoard = payload.type === 'board.members.updated';
          const globalNotice = JSON.stringify({
            type: isBoard ? 'board.members.updated' : 'chat.list.refresh',
            scopeType: payload.scopeType,
            scopeId: payload.scopeId,
            boardId: payload.boardId,
            action: payload.action,
            affectedUserIds: payload.affectedUserIds,
            occurredAt: payload.occurredAt || new Date().toISOString(),
          });
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(globalNotice);
            }
          }
        }

        if (channel === 'board:members' || payload.type === 'board.members.updated') {
          const memberNotice = JSON.stringify({
            type: 'board.members.updated',
            boardId: payload.boardId,
            action: payload.action,
            affectedUserIds: payload.affectedUserIds || [],
            occurredAt: payload.occurredAt || new Date().toISOString(),
          });
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(memberNotice);
            }
          }
        }
      } catch (err) {
        console.error('Error handling Redis message:', err);
      }
    });

    console.log(`[Realtime] Redis subscriber listening on chat:* and board:*`);
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

server.listen(port, (err) => {
  if (err) throw err;
  console.log(`> Unified Next.js + WebSocket server listening on http://${hostname}:${port}`);
  startRedisSubscription();
});

