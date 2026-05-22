#!/usr/bin/env node

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const net = require("node:net");
const { createServer } = require("../server");

function encodeClientFrame(data) {
  const payload = Buffer.from(JSON.stringify(data), "utf8");
  const mask = crypto.randomBytes(4);
  const headerLength = payload.length < 126 ? 6 : payload.length <= 65535 ? 8 : 14;
  const frame = Buffer.alloc(headerLength + payload.length);
  frame[0] = 0x81;
  if (payload.length < 126) {
    frame[1] = 0x80 | payload.length;
    mask.copy(frame, 2);
    for (let index = 0; index < payload.length; index += 1) {
      frame[6 + index] = payload[index] ^ mask[index % 4];
    }
  } else if (payload.length <= 65535) {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(payload.length, 2);
    mask.copy(frame, 4);
    for (let index = 0; index < payload.length; index += 1) {
      frame[8 + index] = payload[index] ^ mask[index % 4];
    }
  } else {
    frame[1] = 0x80 | 127;
    frame.writeBigUInt64BE(BigInt(payload.length), 2);
    mask.copy(frame, 10);
    for (let index = 0; index < payload.length; index += 1) {
      frame[14 + index] = payload[index] ^ mask[index % 4];
    }
  }
  return frame;
}

function decodeServerFrames(client, chunk) {
  client.buffer = client.buffer.length ? Buffer.concat([client.buffer, chunk]) : chunk;
  while (client.buffer.length >= 2) {
    const opcode = client.buffer[0] & 0x0f;
    let payloadLength = client.buffer[1] & 0x7f;
    let offset = 2;
    if (payloadLength === 126) {
      if (client.buffer.length < offset + 2) return;
      payloadLength = client.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (client.buffer.length < offset + 8) return;
      payloadLength = Number(client.buffer.readBigUInt64BE(offset));
      offset += 8;
    }
    if (client.buffer.length < offset + payloadLength) return;
    const payload = client.buffer.subarray(offset, offset + payloadLength);
    client.buffer = client.buffer.subarray(offset + payloadLength);
    if (opcode === 0x8) {
      client.socket.end();
      return;
    }
    if (opcode !== 0x1) continue;
    client.messages.push(JSON.parse(payload.toString("utf8")));
    client.flushWaiters();
  }
}

function createWsClient(port, name) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const key = crypto.randomBytes(16).toString("base64");
    let handshakeBuffer = Buffer.alloc(0);
    const client = {
      name,
      socket,
      buffer: Buffer.alloc(0),
      messages: [],
      waiters: [],
      send(message) {
        socket.write(encodeClientFrame(message));
      },
      next(type, timeoutMs = 2000) {
        const existingIndex = this.messages.findIndex(message => !type || message.type === type);
        if (existingIndex >= 0) {
          const [message] = this.messages.splice(existingIndex, 1);
          return Promise.resolve(message);
        }
        return new Promise((resolveNext, rejectNext) => {
          const timer = setTimeout(() => {
            this.waiters = this.waiters.filter(waiter => waiter !== waiterRecord);
            rejectNext(new Error(`${this.name} timed out waiting for ${type || "message"}`));
          }, timeoutMs);
          const waiterRecord = { type, resolve: resolveNext, reject: rejectNext, timer };
          this.waiters.push(waiterRecord);
        });
      },
      flushWaiters() {
        for (const waiter of [...this.waiters]) {
          const index = this.messages.findIndex(message => !waiter.type || message.type === waiter.type);
          if (index < 0) continue;
          const [message] = this.messages.splice(index, 1);
          clearTimeout(waiter.timer);
          this.waiters = this.waiters.filter(item => item !== waiter);
          waiter.resolve(message);
        }
      },
      close() {
        socket.destroy();
      }
    };

    socket.once("error", reject);
    socket.on("connect", () => {
      socket.write([
        "GET /ws HTTP/1.1",
        "Host: 127.0.0.1",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "",
        ""
      ].join("\r\n"));
    });
    socket.on("data", chunk => {
      if (handshakeBuffer !== null) {
        handshakeBuffer = Buffer.concat([handshakeBuffer, chunk]);
        const marker = handshakeBuffer.indexOf("\r\n\r\n");
        if (marker < 0) return;
        const head = handshakeBuffer.subarray(0, marker).toString("utf8");
        if (!head.includes("101 Switching Protocols")) {
          reject(new Error(`${name} websocket handshake failed: ${head}`));
          return;
        }
        const remaining = handshakeBuffer.subarray(marker + 4);
        handshakeBuffer = null;
        socket.removeAllListeners("error");
        socket.on("error", error => {
          client.waiters.splice(0).forEach(waiter => {
            clearTimeout(waiter.timer);
            waiter.reject(error);
          });
        });
        if (remaining.length) decodeServerFrames(client, remaining);
        resolve(client);
        return;
      }
      decodeServerFrames(client, chunk);
    });
  });
}

function listen(server) {
  return new Promise(resolve => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

async function nextRoomState(client, expectedLifecycle, timeoutMs = 2000) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await client.next("peer-state", timeoutMs);
    if (!expectedLifecycle || state.lifecycle === expectedLifecycle) return state;
  }
  throw new Error(`${client.name} did not receive peer-state ${expectedLifecycle}`);
}

async function expectRelayAck(client, expected) {
  const ack = await client.next("relay-ack");
  assert.equal(ack.serverSeq, expected.serverSeq);
  assert.equal(ack.clientSeq, expected.clientSeq);
  if (expected.lifecycle) assert.equal(ack.lifecycle, expected.lifecycle);
  return ack;
}

async function expectPeerMessage(client, expected) {
  const message = await client.next("peer-message");
  assert.equal(message.fromRole, expected.fromRole);
  assert.equal(message.serverSeq, expected.serverSeq);
  assert.equal(message.clientSeq, expected.clientSeq);
  if (expected.lifecycle) assert.equal(message.lifecycle, expected.lifecycle);
  if (expected.payloadType) assert.equal(message.payload.type, expected.payloadType);
  return message;
}

async function main() {
  const server = createServer();
  const port = await listen(server);
  const clients = [];
  try {
    const host = await createWsClient(port, "host");
    const guest = await createWsClient(port, "guest");
    const extra = await createWsClient(port, "extra");
    clients.push(host, guest, extra);
    assert.equal((await host.next("hello")).type, "hello");
    assert.equal((await guest.next("hello")).type, "hello");
    assert.equal((await extra.next("hello")).type, "hello");

    host.send({ type: "create-room" });
    const created = await host.next("room-created");
    assert.equal(created.role, "host");
    assert.match(created.roomCode, /^[A-Z0-9]{4}$/);
    const waiting = await host.next("peer-state");
    assert.equal(waiting.lifecycle, "waiting");

    guest.send({ type: "join-room", roomCode: created.roomCode });
    const joined = await guest.next("room-joined");
    assert.equal(joined.role, "guest");
    assert.equal(joined.roomCode, created.roomCode);
    assert.equal((await host.next("peer-joined")).role, "guest");
    const hostReady = await nextRoomState(host, "ready");
    const guestReady = await nextRoomState(guest, "ready");
    assert.equal(hostReady.lifecycle, "ready");
    assert.equal(guestReady.lifecycle, "ready");
    assert.equal(hostReady.peerCount, 2);

    extra.send({ type: "join-room", roomCode: created.roomCode });
    assert.equal((await extra.next("error")).message, "Room is full.");

    guest.send({
      type: "relay",
      seq: 1,
      sentAt: 10,
      payload: { type: "input", input: { kind: "direction", direction: 2 } }
    });
    let serverSeq = 1;
    const input = await expectPeerMessage(host, {
      fromRole: "guest",
      serverSeq,
      clientSeq: 1,
      payloadType: "input"
    });
    assert.equal(input.payload.input.direction, 2);
    await expectRelayAck(guest, { serverSeq, clientSeq: 1 });

    host.send({ type: "relay", seq: 1, sentAt: 20, payload: { type: "start", snapshot: { t: 20 } } });
    serverSeq += 1;
    await expectPeerMessage(guest, {
      fromRole: "host",
      serverSeq,
      clientSeq: 1,
      lifecycle: "running",
      payloadType: "start"
    });
    await expectRelayAck(host, { serverSeq, clientSeq: 1, lifecycle: "running" });

    for (let frame = 0; frame < 36; frame += 1) {
      const clientSeq = frame + 2;
      host.send({
        type: "relay",
        seq: clientSeq,
        sentAt: 30 + frame,
        payload: {
          type: "snapshot",
          frame,
          snapshot: {
            t: 30 + frame,
            playerHp: 100 - (frame % 7),
            computerHp: 100 - (frame % 5),
            snake: [{ q: frame % 3, r: 0 }],
            computerSnake: [{ q: 0, r: frame % 3 }]
          }
        }
      });
      serverSeq += 1;
      const snapshot = await expectPeerMessage(guest, {
        fromRole: "host",
        serverSeq,
        clientSeq,
        lifecycle: "running",
        payloadType: "snapshot"
      });
      assert.equal(snapshot.payload.frame, frame);
      assert.equal(snapshot.payload.seq, clientSeq);
      await expectRelayAck(host, { serverSeq, clientSeq, lifecycle: "running" });
    }

    host.send({ type: "ping", t: 123 });
    const pong = await host.next("pong");
    assert.equal(pong.t, 123);
    assert.equal(typeof pong.serverTime, "number");

    guest.close();
    const closedAfterGuestDisconnect = await host.next("room-closed");
    assert.equal(closedAfterGuestDisconnect.role, "guest");
    assert.equal(closedAfterGuestDisconnect.reason, "disconnect");

    host.send({
      type: "relay",
      seq: 100,
      sentAt: 1000,
      payload: { type: "snapshot", reconnectProbe: "host-stopped-after-guest-disconnect", snapshot: { t: 1000 } }
    });
    assert.equal((await host.next("error")).message, "Not in a room.");

    console.log("Network room routing test passed.");
  } finally {
    clients.forEach(client => client.close());
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
