const HexSnakeNet = (() => {
  const statusText = document.querySelector("#networkStatus");
  const panel = document.querySelector("#networkPanel");
  const roomCodeText = document.querySelector("#networkRoomCode");
  const roomCodeInput = document.querySelector("#networkRoomCodeInput");
  const createButton = document.querySelector("#networkCreateButton");
  const joinButton = document.querySelector("#networkJoinButton");
  const leaveButton = document.querySelector("#networkLeaveButton");
  const listeners = new Set();
  let socket = null;
  let connectPromise = null;
  let role = null;
  let roomCode = "";
  let peerCount = 0;
  let inGame = false;

  function setStatus(text, state = "") {
    if (!statusText) return;
    statusText.textContent = text;
    if (state) statusText.dataset.state = state;
    else delete statusText.dataset.state;
  }

  function updateUi() {
    if (roomCodeText) roomCodeText.textContent = roomCode || "----";
    if (roomCodeInput && !roomCodeInput.matches(":focus")) roomCodeInput.value = roomCodeInput.value.toUpperCase();
    if (createButton) createButton.disabled = Boolean(role);
    if (joinButton) joinButton.disabled = Boolean(role);
    if (leaveButton) {
      leaveButton.hidden = !role;
      leaveButton.disabled = !role;
    }
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

  function resetRoomState() {
    role = null;
    roomCode = "";
    peerCount = 0;
    inGame = false;
    updateUi();
  }

  function handlePeerMessage(message) {
    listeners.forEach(listener => {
      try {
        listener(message.payload, message.fromRole);
      } catch (error) {
        console.warn("Network game message failed:", error);
      }
    });
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
      role = message.role;
      roomCode = message.roomCode;
      setStatus(role === "host" ? "Hosting LAN room. Share the code." : "Joined LAN room as P2.", "ok");
      updateUi();
      return;
    }
    if (message.type === "peer-state") {
      role = message.role || role;
      roomCode = message.roomCode || roomCode;
      peerCount = Number(message.peerCount) || 0;
      const waiting = role === "host" && peerCount < 2;
      setStatus(waiting ? "Waiting for P2 on the same Wi-Fi." : `LAN room ready (${peerCount}/2).`, "ok");
      updateUi();
      return;
    }
    if (message.type === "peer-joined") {
      setStatus("P2 joined. Host can start the match.", "ok");
      return;
    }
    if (message.type === "peer-left") {
      peerCount = Math.max(1, peerCount - 1);
      inGame = false;
      setStatus("Peer left the LAN room.", "warn");
      updateUi();
      return;
    }
    if (message.type === "room-closed" || message.type === "room-left") {
      resetRoomState();
      setStatus(message.type === "room-closed" ? "Host closed the LAN room." : "Left LAN room.", "warn");
      return;
    }
    if (message.type === "peer-message") {
      handlePeerMessage(message);
      return;
    }
    if (message.type === "error") {
      setStatus(message.message || "LAN relay error.", "error");
    }
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
        resolve(socket);
      }, { once: true });
      socket.addEventListener("error", () => {
        connectPromise = null;
        reject(new Error("Unable to connect to LAN relay"));
      }, { once: true });
    });

    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", () => {
      connectPromise = null;
      socket = null;
      resetRoomState();
      setStatus("LAN relay disconnected.", "warn");
    });
    return connectPromise;
  }

  async function createRoom() {
    await ensureSocket();
    send({ type: "create-room" });
  }

  async function joinRoom(code) {
    const nextCode = String(code || roomCodeInput?.value || "").trim().toUpperCase();
    if (!nextCode) {
      setStatus("Enter a room code first.", "error");
      return;
    }
    await ensureSocket();
    send({ type: "join-room", roomCode: nextCode });
  }

  function leaveRoom() {
    if (!socket) {
      resetRoomState();
      return;
    }
    send({ type: "leave-room" });
    resetRoomState();
  }

  function sendGameMessage(payload) {
    return send({ type: "relay", payload });
  }

  function sendInput(input) {
    return sendGameMessage({ type: "input", input });
  }

  createButton?.addEventListener("click", () => {
    createRoom().catch(error => setStatus(error.message, "error"));
  });
  joinButton?.addEventListener("click", () => {
    joinRoom().catch(error => setStatus(error.message, "error"));
  });
  leaveButton?.addEventListener("click", leaveRoom);
  roomCodeInput?.addEventListener("input", () => {
    roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  });
  roomCodeInput?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    joinRoom().catch(error => setStatus(error.message, "error"));
  });

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

window.HexSnakeNet = HexSnakeNet;
