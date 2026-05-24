const NetRuntime = HexSnakeRuntime;
const NetStorage = NetRuntime.storage;
const NetUI = HexSnakeUI;

const HexSnakeNet = (() => {
  const statusText = document.querySelector("#networkStatus");
  const panel = document.querySelector("#networkPanel");
  const roomCodeInput = document.querySelector("#networkRoomCodeInput");
  const createButton = document.querySelector("#networkCreateButton");
  const joinButton = document.querySelector("#networkJoinButton");
  const listeners = new Set();
  let socket = null;
  let connectPromise = null;
  let role = null;
  let roomCode = "";
  let peerCount = 0;
  let inGame = false;
  let lifecycle = "idle";
  let clientSeq = 0;
  let lastServerSeq = 0;
  let latencyMs = null;
  let latencyTimer = null;
  let reconnectTimer = null;
  let manualDisconnect = false;
  let desiredRole = null;
  let desiredRoomCode = "";
  let pendingJoinCode = "";
  let lastSnapshotSentAt = -Infinity;
  let snapshotIntervalMs = clampSnapshotInterval(NetStorage?.get?.("hexSnakeLanSnapshotIntervalMs") || 100);
  let baseStatusText = "";
  let baseStatusState = "";

  function clearRoomCodeInput() {
    if (!roomCodeInput) return;
    roomCodeInput.value = "";
    roomCodeInput.readOnly = false;
    roomCodeInput.setAttribute("aria-label", "Room code");
  }

  function syncRoomCodeInput() {
    if (!roomCodeInput) return;
    if (role === "host" && roomCode) {
      roomCodeInput.value = roomCode;
      roomCodeInput.readOnly = true;
      roomCodeInput.setAttribute("aria-label", "Host room code");
      return;
    }
    if (role) clearRoomCodeInput();
    else roomCodeInput.readOnly = false;
  }

  function clampSnapshotInterval(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 100;
    return Math.max(50, Math.min(1000, Math.round(parsed)));
  }

  function setStatus(text, state = "") {
    if (!statusText) return;
    baseStatusText = text;
    baseStatusState = state;
    renderStatus();
  }

  function renderStatus() {
    if (!statusText) return;
    const details = [];
    if (lifecycle && lifecycle !== "idle") details.push(lifecycle);
    if (latencyMs !== null) details.push(`${latencyMs} ms`);
    statusText.textContent = details.length ? `${baseStatusText} · ${details.join(" · ")}` : baseStatusText;
    if (baseStatusState) statusText.dataset.state = baseStatusState;
    else delete statusText.dataset.state;
  }

  function updateUi() {
    syncRoomCodeInput();
    if (createButton) {
      createButton.disabled = Boolean(pendingJoinCode);
      createButton.textContent = role ? "Leave" : "Host";
      createButton.classList.toggle("secondary", Boolean(role));
      createButton.setAttribute("aria-label", role ? "Leave LAN room" : "Host LAN room");
    }
    if (joinButton) joinButton.disabled = Boolean(role) || Boolean(pendingJoinCode);
    panel?.classList.toggle("has-room", Boolean(role));
  }

  function websocketUrl() {
    if (!window.location.host) return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }

  function isOpen() {
    return socket?.readyState === WebSocket.OPEN;
  }

  function send(message) {
    if (!isOpen()) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function emitGameMessage(payload, fromRole = null, envelope = {}) {
    listeners.forEach(listener => {
      try {
        listener(payload, fromRole, envelope);
      } catch (error) {
        console.warn("Network game message failed:", error);
      }
    });
  }

  function resetRoomState(options = {}) {
    role = null;
    roomCode = "";
    peerCount = 0;
    inGame = false;
    lifecycle = "idle";
    lastServerSeq = 0;
    pendingJoinCode = "";
    clearRoomCodeInput();
    if (!options.preserveDesired) {
      desiredRole = null;
      desiredRoomCode = "";
    }
    updateUi();
    renderStatus();
  }

  function showJoinFailure(message) {
    const attemptedCode = pendingJoinCode;
    pendingJoinCode = "";
    updateUi();
    const text = message || "Room pairing failed.";
    setStatus(text, "error");
    clearRoomCodeInput();
    if (roomCodeInput && attemptedCode) roomCodeInput.focus();
    window.alert?.(`配對失敗：${text}`);
  }

  function handlePeerMessage(message) {
    const serverSeq = Number(message.serverSeq);
    if (Number.isFinite(serverSeq)) {
      if (serverSeq <= lastServerSeq) return;
      lastServerSeq = serverSeq;
    }
    emitGameMessage(message.payload, message.fromRole, message);
  }

  function handleMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === "hello") {
      setStatus("Connected to LAN relay.", "ok");
      return;
    }
    if (message.type === "room-created" || message.type === "room-joined") {
      pendingJoinCode = "";
      clearRoomCodeInput();
      role = message.role;
      roomCode = message.roomCode;
      desiredRole = role;
      desiredRoomCode = roomCode;
      lifecycle = message.lifecycle || lifecycle;
      setStatus(role === "host" ? "Hosting LAN room. Share the code." : "Joined LAN room as P2.", "ok");
      updateUi();
      emitGameMessage({ type: "network-state", event: message.type, role, roomCode, lifecycle }, role, message);
      return;
    }
    if (message.type === "peer-state") {
      role = message.role || role;
      roomCode = message.roomCode || roomCode;
      peerCount = Number(message.peerCount) || 0;
      lifecycle = message.lifecycle || lifecycle;
      const waiting = role === "host" && peerCount < 2;
      setStatus(waiting ? "Waiting for P2 on the same Wi-Fi." : `LAN room ready (${peerCount}/2).`, "ok");
      updateUi();
      emitGameMessage({ type: "network-state", event: "peer-state", role, roomCode, peerCount, lifecycle }, role, message);
      return;
    }
    if (message.type === "peer-joined") {
      setStatus("P2 joined. Host can start the match.", "ok");
      emitGameMessage({ type: "network-state", event: "peer-joined", role, roomCode, peerCount, lifecycle }, message.role, message);
      return;
    }
    if (message.type === "peer-left") {
      const wasInGame = inGame;
      const previousRole = role;
      peerCount = Math.max(1, peerCount - 1);
      resetRoomState();
      setStatus("Peer left the LAN room.", "warn");
      emitGameMessage({ type: "disconnect", reason: message.reason || "left", role: message.role, localRole: previousRole, wasInGame }, message.role, message);
      return;
    }
    if (message.type === "room-closed" || message.type === "room-left") {
      const wasInGame = inGame;
      const previousRole = role;
      const closedByRole = message.role === "guest" ? "guest" : "host";
      resetRoomState();
      setStatus(message.type === "room-closed" && closedByRole === "host" ? "Host closed the LAN room." : message.type === "room-closed" ? "Peer left the LAN room." : "Left LAN room.", "warn");
      if (message.type === "room-closed") {
        emitGameMessage({ type: "disconnect", reason: message.reason || "closed", role: closedByRole, localRole: previousRole, wasInGame }, closedByRole, message);
      } else {
        emitGameMessage({ type: "network-state", event: "room-left", role: previousRole, wasInGame }, previousRole, message);
      }
      return;
    }
    if (message.type === "peer-message") {
      lifecycle = message.lifecycle || lifecycle;
      renderStatus();
      handlePeerMessage(message);
      return;
    }
    if (message.type === "relay-ack") {
      lifecycle = message.lifecycle || lifecycle;
      renderStatus();
      return;
    }
    if (message.type === "pong") {
      const startedAt = Number(message.t);
      if (Number.isFinite(startedAt)) {
        latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
        renderStatus();
      }
      return;
    }
    if (message.type === "error") {
      if (pendingJoinCode) showJoinFailure(message.message || "LAN relay error.");
      else setStatus(message.message || "LAN relay error.", "error");
    }
  }

  function startLatencyProbe() {
    stopLatencyProbe();
    latencyTimer = window.setInterval(() => {
      if (!isOpen()) return;
      send({ type: "ping", t: performance.now() });
    }, 3000);
    send({ type: "ping", t: performance.now() });
  }

  function stopLatencyProbe() {
    if (latencyTimer) window.clearInterval(latencyTimer);
    latencyTimer = null;
    latencyMs = null;
  }

  function scheduleReconnect(previousRole, previousRoomCode) {
    if (manualDisconnect || reconnectTimer || !previousRole) return;
    setStatus("LAN relay disconnected. Reconnecting...", "warn");
    reconnectTimer = window.setTimeout(async () => {
      reconnectTimer = null;
      try {
        await ensureSocket();
        if (previousRole === "guest" && previousRoomCode) {
          send({ type: "join-room", roomCode: previousRoomCode });
        } else if (previousRole === "host") {
          send({ type: "create-room" });
        }
      } catch {
        scheduleReconnect(previousRole, previousRoomCode);
      }
    }, 1200);
  }

  function ensureSocket() {
    if (isOpen()) return Promise.resolve(socket);
    if (connectPromise) return connectPromise;
    const url = websocketUrl();
    if (!url || !window.WebSocket) {
      setStatus("LAN relay unavailable from this page.", "error");
      return Promise.reject(new Error("WebSocket unavailable"));
    }

    setStatus("Connecting to LAN relay...", "pending");
    socket = new WebSocket(url);
    connectPromise = new Promise((resolve, reject) => {
      socket.addEventListener("open", () => {
        connectPromise = null;
        manualDisconnect = false;
        startLatencyProbe();
        resolve(socket);
      }, { once: true });
      socket.addEventListener("error", () => {
        connectPromise = null;
        reject(new Error("Unable to connect to LAN relay"));
      }, { once: true });
    });

    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", () => {
      const previousRole = desiredRole || role;
      const previousRoomCode = desiredRoomCode || roomCode;
      const wasInGame = inGame;
      connectPromise = null;
      socket = null;
      stopLatencyProbe();
      resetRoomState({ preserveDesired: !manualDisconnect });
      if (wasInGame) {
        manualDisconnect = true;
        setStatus("LAN relay disconnected during match.", "warn");
        emitGameMessage({ type: "disconnect", local: true, reason: "connection-lost", role: previousRole, wasInGame }, previousRole, { type: "socket-close" });
      } else if (manualDisconnect) {
        setStatus("LAN relay disconnected.", "warn");
      } else {
        scheduleReconnect(previousRole, previousRoomCode);
      }
    });
    return connectPromise;
  }

  async function createRoom() {
    await ensureSocket();
    manualDisconnect = false;
    send({ type: "create-room" });
  }

  async function joinRoom(code) {
    const nextCode = String(code || roomCodeInput?.value || "").trim().toUpperCase();
    if (nextCode.length !== 4) {
      setStatus("Enter a 4-character room code first.", "error");
      return;
    }
    if (role || pendingJoinCode) return;
    pendingJoinCode = nextCode;
    updateUi();
    await ensureSocket();
    manualDisconnect = false;
    send({ type: "join-room", roomCode: nextCode });
  }

  function leaveRoom() {
    manualDisconnect = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (!socket) {
      resetRoomState();
      return;
    }
    send({ type: "leave-room" });
    clearRoomCodeInput();
    resetRoomState();
  }

  function notifyPageExit() {
    if (!socket || !role) return;
    manualDisconnect = true;
    send({ type: "leave-room" });
    try {
      socket.close(1000, "page-exit");
    } catch {
      // Best effort during page teardown.
    }
  }

  function sendGameMessage(payload) {
    if (!payload || typeof payload !== "object") return false;
    const now = performance.now();
    const throttleSnapshot = payload.type === "snapshot" && payload.force !== true;
    if (throttleSnapshot && now - lastSnapshotSentAt < snapshotIntervalMs) return false;
    if (payload.type === "snapshot") lastSnapshotSentAt = now;
    const seq = clientSeq + 1;
    clientSeq = seq;
    const outgoingPayload = { ...payload };
    delete outgoingPayload.force;
    return send({
      type: "relay",
      seq,
      sentAt: now,
      payload: {
        ...outgoingPayload,
        seq,
        sentAt: now
      }
    });
  }

  function sendInput(input) {
    return sendGameMessage({ type: "input", input });
  }

  createButton?.addEventListener("click", () => {
    if (role) {
      leaveRoom();
      return;
    }
    createRoom().catch(error => setStatus(error.message, "error"));
  });
  joinButton?.addEventListener("click", () => {
    joinRoom().catch(error => showJoinFailure(error.message));
  });
  roomCodeInput?.addEventListener("input", () => {
    if (roomCodeInput.readOnly) return;
    roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (roomCodeInput.value.length === 4) {
      joinRoom(roomCodeInput.value).catch(error => showJoinFailure(error.message));
    }
  });
  roomCodeInput?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    joinRoom().catch(error => showJoinFailure(error.message));
  });
  window.addEventListener("pagehide", notifyPageExit);
  window.addEventListener("beforeunload", notifyPageExit);

  updateUi();
  setStatus(window.WebSocket ? "LAN mode ready. Host or join on the same Wi-Fi." : "WebSocket is not supported.", window.WebSocket ? "" : "error");

  return Object.freeze({
    onGameMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    createRoom,
    joinRoom,
    leaveRoom,
    sendGameMessage,
    sendInput,
    isConnected: isOpen,
    isHost() {
      return role === "host";
    },
    isGuest() {
      return role === "guest";
    },
    hasPeer() {
      return peerCount >= 2;
    },
    isRoomActive() {
      return Boolean(role);
    },
    lifecycle() {
      return lifecycle;
    },
    latencyMs() {
      return latencyMs;
    },
    snapshotIntervalMs() {
      return snapshotIntervalMs;
    },
    setSnapshotIntervalMs(value) {
      snapshotIntervalMs = clampSnapshotInterval(value);
      NetStorage?.set?.("hexSnakeLanSnapshotIntervalMs", String(snapshotIntervalMs));
      return snapshotIntervalMs;
    },
    role() {
      return role;
    },
    roomCode() {
      return roomCode;
    },
    setInGame(value) {
      inGame = Boolean(value);
    },
    isInGame() {
      return inGame;
    },
    setStatus
  });
})();

Object.defineProperties(NetUI.network, Object.getOwnPropertyDescriptors(HexSnakeNet));
window.HexSnakeNet = HexSnakeNet;

export {
  HexSnakeNet,
  HexSnakeNet as network
};
