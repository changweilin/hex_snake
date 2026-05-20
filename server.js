const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const useDist = process.argv.includes("--dist");
const root = path.resolve(__dirname, useDist ? "dist" : ".");
const port = Number(process.env.PORT || 6287);
const host = process.env.HOST || "0.0.0.0";
const websocketGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const wsClients = new Set();
const rooms = new Map();
const roomLifecycles = new Set(["waiting", "ready", "running", "ended"]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg"
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function resolveRequest(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return { status: 400, message: "Bad request" };
  }

  const requested = decoded === "/" ? "/index.html" : decoded;
  const filePath = path.resolve(root, `.${requested}`);
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return { status: 403, message: "Forbidden" };
  }

  return { filePath };
}

function handleRequest(req, res) {
  const resolved = resolveRequest(req.url || "/");

  if (!resolved.filePath) {
    send(res, resolved.status, resolved.message);
    return;
  }

  const { filePath } = resolved;

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    const type = types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(res, 200, data, type);
  });
}

function createServer() {
  const server = http.createServer(handleRequest);
  server.on("upgrade", handleWebSocketUpgrade);
  return server;
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return rooms.has(code) ? createRoomCode() : code;
}

function acceptWebSocketKey(key) {
  return crypto
    .createHash("sha1")
    .update(`${key}${websocketGuid}`)
    .digest("base64");
}

function encodeWebSocketMessage(data) {
  const payload = Buffer.from(JSON.stringify(data), "utf8");
  const headerLength = payload.length < 126 ? 2 : payload.length <= 65535 ? 4 : 10;
  const frame = Buffer.alloc(headerLength + payload.length);
  frame[0] = 0x81;
  if (payload.length < 126) {
    frame[1] = payload.length;
  } else if (payload.length <= 65535) {
    frame[1] = 126;
    frame.writeUInt16BE(payload.length, 2);
  } else {
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  payload.copy(frame, headerLength);
  return frame;
}

function sendWebSocket(client, data) {
  if (!client || client.socket.destroyed) return false;
  try {
    client.socket.write(encodeWebSocketMessage(data));
    return true;
  } catch {
    return false;
  }
}

function setRoomLifecycle(room, lifecycle) {
  if (!room || !roomLifecycles.has(lifecycle) || room.lifecycle === lifecycle) return false;
  room.lifecycle = lifecycle;
  room.updatedAt = Date.now();
  return true;
}

function refreshRoomLifecycle(room) {
  if (!room) return false;
  if (room.clients.size < 2) return setRoomLifecycle(room, "waiting");
  if (room.lifecycle === "running" || room.lifecycle === "ended") return false;
  return setRoomLifecycle(room, "ready");
}

function sendRoomState(room) {
  if (!room) return;
  refreshRoomLifecycle(room);
  const peerCount = room.clients.size;
  const roles = [...room.clients].map(client => client.role).filter(Boolean);
  room.clients.forEach(client => sendWebSocket(client, {
    type: "peer-state",
    roomCode: room.code,
    role: client.role,
    peerCount,
    roles,
    lifecycle: room.lifecycle,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt
  }));
}

function leaveRoom(client, reason = "left") {
  if (!client?.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) {
    client.roomCode = null;
    client.role = null;
    return;
  }

  room.clients.delete(client);
  const previousRole = client.role;
  client.roomCode = null;
  client.role = null;

  if (previousRole === "host") {
    room.clients.forEach(peer => {
      peer.roomCode = null;
      peer.role = null;
      sendWebSocket(peer, { type: "room-closed", roomCode: room.code, reason });
    });
    rooms.delete(room.code);
    return;
  }

  if (room.clients.size === 0) {
    rooms.delete(room.code);
    return;
  }

  room.clients.forEach(peer => sendWebSocket(peer, {
    type: "peer-left",
    roomCode: room.code,
    role: previousRole,
    reason
  }));
  refreshRoomLifecycle(room);
  sendRoomState(room);
}

function joinRoom(client, code) {
  const roomCode = String(code || "").trim().toUpperCase();
  const room = rooms.get(roomCode);
  if (!room) {
    sendWebSocket(client, { type: "error", message: "Room not found." });
    return;
  }
  if (room.clients.size >= 2) {
    sendWebSocket(client, { type: "error", message: "Room is full." });
    return;
  }
  leaveRoom(client, "switch-room");
  room.clients.add(client);
  client.roomCode = room.code;
  client.role = "guest";
  sendWebSocket(client, { type: "room-joined", roomCode: room.code, role: client.role });
  room.clients.forEach(peer => {
    if (peer !== client) sendWebSocket(peer, { type: "peer-joined", roomCode: room.code, role: client.role });
  });
  sendRoomState(room);
}

function createRoom(client) {
  leaveRoom(client, "switch-room");
  const code = createRoomCode();
  const room = {
    code,
    clients: new Set([client]),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycle: "waiting",
    messageSeq: 0
  };
  rooms.set(code, room);
  client.roomCode = code;
  client.role = "host";
  sendWebSocket(client, { type: "room-created", roomCode: code, role: client.role });
  sendRoomState(room);
}

function relayToRoomPeer(client, payload) {
  const room = rooms.get(client.roomCode);
  if (!room || !room.clients.has(client)) {
    sendWebSocket(client, { type: "error", message: "Not in a room." });
    return;
  }
  if (!payload || typeof payload !== "object") {
    sendWebSocket(client, { type: "error", message: "Invalid relay payload." });
    return;
  }
  const receivedAt = Date.now();
  const serverSeq = room.messageSeq + 1;
  room.messageSeq = serverSeq;
  room.updatedAt = receivedAt;
  let lifecycleChanged = false;
  if (payload.type === "start" || payload.type === "snapshot") {
    lifecycleChanged = setRoomLifecycle(room, "running");
  } else if (payload.type === "end") {
    lifecycleChanged = setRoomLifecycle(room, "ended");
  }
  const clientSeq = Number.isFinite(Number(payload.seq)) ? Number(payload.seq) : null;
  const sentAt = Number.isFinite(Number(payload.sentAt)) ? Number(payload.sentAt) : null;
  room.clients.forEach(peer => {
    if (peer === client) return;
    sendWebSocket(peer, {
      type: "peer-message",
      roomCode: room.code,
      fromRole: client.role,
      serverSeq,
      clientSeq,
      sentAt,
      receivedAt,
      lifecycle: room.lifecycle,
      payload
    });
  });
  sendWebSocket(client, {
    type: "relay-ack",
    roomCode: room.code,
    serverSeq,
    clientSeq,
    receivedAt,
    lifecycle: room.lifecycle
  });
  if (lifecycleChanged) sendRoomState(room);
}

function handleWebSocketMessage(client, text) {
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    sendWebSocket(client, { type: "error", message: "Invalid JSON." });
    return;
  }

  if (message.type === "create-room") {
    createRoom(client);
    return;
  }
  if (message.type === "join-room") {
    joinRoom(client, message.roomCode);
    return;
  }
  if (message.type === "leave-room") {
    leaveRoom(client);
    sendWebSocket(client, { type: "room-left" });
    return;
  }
  if (message.type === "relay") {
    const payload = message.payload && typeof message.payload === "object"
      ? { ...message.payload }
      : message.payload;
    if (payload && typeof payload === "object") {
      if (payload.seq === undefined && message.seq !== undefined) payload.seq = message.seq;
      if (payload.sentAt === undefined && message.sentAt !== undefined) payload.sentAt = message.sentAt;
    }
    relayToRoomPeer(client, payload);
    return;
  }
  if (message.type === "ping") {
    sendWebSocket(client, { type: "pong", t: message.t || Date.now(), serverTime: Date.now() });
  }
}

function decodeWebSocketFrames(client, chunk) {
  client.buffer = client.buffer.length ? Buffer.concat([client.buffer, chunk]) : chunk;

  while (client.buffer.length >= 2) {
    const firstByte = client.buffer[0];
    const secondByte = client.buffer[1];
    const fin = Boolean(firstByte & 0x80);
    const opcode = firstByte & 0x0f;
    const masked = Boolean(secondByte & 0x80);
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      if (client.buffer.length < offset + 2) return;
      payloadLength = client.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (client.buffer.length < offset + 8) return;
      const bigLength = client.buffer.readBigUInt64BE(offset);
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        client.socket.destroy();
        return;
      }
      payloadLength = Number(bigLength);
      offset += 8;
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = offset + maskLength + payloadLength;
    if (client.buffer.length < frameLength) return;

    let payload = client.buffer.subarray(offset + maskLength, frameLength);
    if (masked) {
      const mask = client.buffer.subarray(offset, offset + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }
    client.buffer = client.buffer.subarray(frameLength);

    if (opcode === 0x8) {
      client.socket.end();
      return;
    }
    if (opcode === 0x9) {
      client.socket.write(Buffer.from([0x8a, 0x00]));
      continue;
    }
    if (opcode !== 0x1 || !fin) {
      client.socket.destroy();
      return;
    }

    handleWebSocketMessage(client, payload.toString("utf8"));
  }
}

function handleWebSocketUpgrade(req, socket) {
  if ((req.url || "").split("?")[0] !== "/ws") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptWebSocketKey(key)}`,
    "",
    ""
  ].join("\r\n"));

  const client = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    socket,
    buffer: Buffer.alloc(0),
    roomCode: null,
    role: null
  };
  wsClients.add(client);
  sendWebSocket(client, { type: "hello", id: client.id });

  socket.on("data", chunk => decodeWebSocketFrames(client, chunk));
  socket.on("close", () => {
    leaveRoom(client, "disconnect");
    wsClients.delete(client);
  });
  socket.on("error", () => {
    leaveRoom(client, "error");
    wsClients.delete(client);
  });
}

function getNetworkUrls() {
  const urls = [`http://localhost:${port}`];
  const interfaces = os.networkInterfaces();

  Object.values(interfaces).forEach(entries => {
    (entries || []).forEach(entry => {
      if (entry.family !== "IPv4" || entry.internal) return;
      urls.push(`http://${entry.address}:${port}`);
    });
  });

  return [...new Set(urls)];
}

function startServer() {
  const server = createServer();
  server.listen(port, host, () => {
    console.log("Hex Snake dev server running:");
    getNetworkUrls().forEach(url => console.log(`  ${url}`));
    console.log(`Serving ${root}`);
    console.log(`Listening on ${host}:${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  resolveRequest,
  startServer
};
