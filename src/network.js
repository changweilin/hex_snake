const NetRuntime = HexSnakeRuntime;
const NetStorage = NetRuntime.storage;
const NetUI = HexSnakeUI;

const HexSnakeNet = (() => {
  const statusText = document.querySelector("#networkStatus");
  const panel = document.querySelector("#networkPanel");
  const roomCodeInput = document.querySelector("#networkRoomCodeInput");
  const createButton = document.querySelector("#networkCreateButton");
  const joinButton = document.querySelector("#networkJoinButton");
  const invitePanel = document.querySelector("#networkInvitePanel");
  const inviteQr = document.querySelector("#networkInviteQr");
  const inviteUrl = document.querySelector("#networkInviteUrl");
  const copyInviteButton = document.querySelector("#networkCopyInviteButton");
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
  let networkUrlsPromise = null;
  let inviteRenderSeq = 0;
  let currentInviteUrl = "";

  // Fixed-version QR writer for short LAN invite URLs; avoids an external runtime dependency.
  const qrInviteConfig = Object.freeze({
    version: 5,
    size: 37,
    dataCodewords: 108,
    ecCodewords: 26,
    mask: 0,
    alignment: Object.freeze([6, 30])
  });
  let qrGaloisTables = null;

  function sanitizeRoomCode(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  }

  function textBytes(text) {
    if (typeof TextEncoder !== "undefined") return [...new TextEncoder().encode(text)];
    return [...unescape(encodeURIComponent(text))].map(char => char.charCodeAt(0));
  }

  function pushQrBits(bits, value, length) {
    for (let shift = length - 1; shift >= 0; shift -= 1) {
      bits.push((value >>> shift) & 1);
    }
  }

  function qrGalois() {
    if (qrGaloisTables) return qrGaloisTables;
    const exp = new Array(512).fill(0);
    const log = new Array(256).fill(0);
    let value = 1;
    for (let index = 0; index < 255; index += 1) {
      exp[index] = value;
      log[value] = index;
      value <<= 1;
      if (value & 0x100) value ^= 0x11d;
    }
    for (let index = 255; index < exp.length; index += 1) {
      exp[index] = exp[index - 255];
    }
    qrGaloisTables = { exp, log };
    return qrGaloisTables;
  }

  function qrGaloisMultiply(left, right) {
    if (!left || !right) return 0;
    const tables = qrGalois();
    return tables.exp[tables.log[left] + tables.log[right]];
  }

  function qrPolynomialMultiply(left, right) {
    const result = new Array(left.length + right.length - 1).fill(0);
    left.forEach((leftValue, leftIndex) => {
      right.forEach((rightValue, rightIndex) => {
        result[leftIndex + rightIndex] ^= qrGaloisMultiply(leftValue, rightValue);
      });
    });
    return result;
  }

  function qrGeneratorPolynomial(degree) {
    let result = [1];
    const tables = qrGalois();
    for (let index = 0; index < degree; index += 1) {
      result = qrPolynomialMultiply(result, [1, tables.exp[index]]);
    }
    return result;
  }

  function qrErrorCorrectionCodewords(dataCodewords) {
    const generator = qrGeneratorPolynomial(qrInviteConfig.ecCodewords);
    const remainder = new Array(qrInviteConfig.ecCodewords).fill(0);
    dataCodewords.forEach(codeword => {
      const factor = codeword ^ remainder.shift();
      remainder.push(0);
      for (let index = 0; index < remainder.length; index += 1) {
        remainder[index] ^= qrGaloisMultiply(generator[index + 1], factor);
      }
    });
    return remainder;
  }

  function qrDataCodewords(text) {
    const bytes = textBytes(text);
    const capacityBits = qrInviteConfig.dataCodewords * 8;
    const bits = [];
    if (bytes.length > 255) throw new Error("Invite link is too long for this QR code.");
    pushQrBits(bits, 0b0100, 4);
    pushQrBits(bits, bytes.length, 8);
    bytes.forEach(byte => pushQrBits(bits, byte, 8));
    if (bits.length > capacityBits) throw new Error("Invite link is too long for this QR code.");
    const terminator = Math.min(4, capacityBits - bits.length);
    for (let index = 0; index < terminator; index += 1) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const codewords = [];
    for (let index = 0; index < bits.length; index += 8) {
      let codeword = 0;
      for (let offset = 0; offset < 8; offset += 1) {
        codeword = (codeword << 1) | bits[index + offset];
      }
      codewords.push(codeword);
    }
    for (let pad = 0xec; codewords.length < qrInviteConfig.dataCodewords; pad ^= 0xfd) {
      codewords.push(pad);
    }
    return codewords;
  }

  function createQrMatrix() {
    return Array.from({ length: qrInviteConfig.size }, () => new Array(qrInviteConfig.size).fill(false));
  }

  function setQrFunctionModule(matrix, reserved, x, y, dark) {
    if (x < 0 || y < 0 || x >= qrInviteConfig.size || y >= qrInviteConfig.size) return;
    matrix[y][x] = Boolean(dark);
    reserved[y][x] = true;
  }

  function drawQrFinder(matrix, reserved, left, top) {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const xx = left + x;
        const yy = top + y;
        const inPattern = x >= 0 && x <= 6 && y >= 0 && y <= 6;
        const dark = inPattern && (
          x === 0 || x === 6 || y === 0 || y === 6 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4)
        );
        setQrFunctionModule(matrix, reserved, xx, yy, dark);
      }
    }
  }

  function drawQrAlignment(matrix, reserved, centerX, centerY) {
    if (reserved[centerY]?.[centerX]) return;
    for (let y = -2; y <= 2; y += 1) {
      for (let x = -2; x <= 2; x += 1) {
        const distance = Math.max(Math.abs(x), Math.abs(y));
        setQrFunctionModule(matrix, reserved, centerX + x, centerY + y, distance === 2 || distance === 0);
      }
    }
  }

  function qrFormatBits() {
    const errorCorrectionLevel = 1;
    const data = (errorCorrectionLevel << 3) | qrInviteConfig.mask;
    let bits = data << 10;
    const generator = 0x537;
    for (let shift = 14; shift >= 10; shift -= 1) {
      if ((bits >>> shift) & 1) bits ^= generator << (shift - 10);
    }
    return ((data << 10) | bits) ^ 0x5412;
  }

  function drawQrFormatBits(matrix, reserved) {
    const bits = qrFormatBits();
    const bit = index => Boolean((bits >>> index) & 1);
    const size = qrInviteConfig.size;
    for (let index = 0; index <= 5; index += 1) setQrFunctionModule(matrix, reserved, 8, index, bit(index));
    setQrFunctionModule(matrix, reserved, 8, 7, bit(6));
    setQrFunctionModule(matrix, reserved, 8, 8, bit(7));
    setQrFunctionModule(matrix, reserved, 7, 8, bit(8));
    for (let index = 9; index < 15; index += 1) setQrFunctionModule(matrix, reserved, 14 - index, 8, bit(index));
    for (let index = 0; index < 8; index += 1) setQrFunctionModule(matrix, reserved, size - 1 - index, 8, bit(index));
    for (let index = 8; index < 15; index += 1) setQrFunctionModule(matrix, reserved, 8, size - 15 + index, bit(index));
    setQrFunctionModule(matrix, reserved, 8, size - 8, true);
  }

  function drawQrFunctionPatterns(matrix, reserved) {
    const size = qrInviteConfig.size;
    drawQrFinder(matrix, reserved, 0, 0);
    drawQrFinder(matrix, reserved, size - 7, 0);
    drawQrFinder(matrix, reserved, 0, size - 7);
    for (let index = 8; index < size - 8; index += 1) {
      const dark = index % 2 === 0;
      setQrFunctionModule(matrix, reserved, index, 6, dark);
      setQrFunctionModule(matrix, reserved, 6, index, dark);
    }
    qrInviteConfig.alignment.forEach(centerY => {
      qrInviteConfig.alignment.forEach(centerX => drawQrAlignment(matrix, reserved, centerX, centerY));
    });
    drawQrFormatBits(matrix, reserved);
  }

  function qrMaskApplies(x, y) {
    return (x + y) % 2 === 0;
  }

  function drawQrCodewords(matrix, reserved, codewords) {
    const bits = [];
    codewords.forEach(codeword => pushQrBits(bits, codeword, 8));
    const size = qrInviteConfig.size;
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical += 1) {
        const y = ((right + 1) & 2) === 0 ? size - 1 - vertical : vertical;
        for (let offset = 0; offset < 2; offset += 1) {
          const x = right - offset;
          if (reserved[y][x]) continue;
          let dark = bitIndex < bits.length ? Boolean(bits[bitIndex]) : false;
          bitIndex += 1;
          if (qrMaskApplies(x, y)) dark = !dark;
          matrix[y][x] = dark;
        }
      }
    }
  }

  function createInviteQrSvg(text) {
    const dataCodewords = qrDataCodewords(text);
    const codewords = [...dataCodewords, ...qrErrorCorrectionCodewords(dataCodewords)];
    const matrix = createQrMatrix();
    const reserved = createQrMatrix();
    drawQrFunctionPatterns(matrix, reserved);
    drawQrCodewords(matrix, reserved, codewords);
    const quiet = 4;
    const viewSize = qrInviteConfig.size + quiet * 2;
    const cells = [];
    matrix.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) cells.push(`M${x + quiet},${y + quiet}h1v1h-1z`);
      });
    });
    return `<svg viewBox="0 0 ${viewSize} ${viewSize}" role="img" aria-label="LAN join QR code" xmlns="http://www.w3.org/2000/svg"><rect width="${viewSize}" height="${viewSize}" fill="#fff"/><path d="${cells.join("")}" fill="#000"/></svg>`;
  }

  function isLocalHostname(hostname) {
    const normalized = String(hostname || "").toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
  }

  function loadNetworkUrls() {
    if (networkUrlsPromise) return networkUrlsPromise;
    networkUrlsPromise = fetch("/api/network-urls", { cache: "no-store" })
      .then(response => response.ok ? response.json() : { urls: [] })
      .then(data => Array.isArray(data.urls) ? data.urls : [])
      .catch(() => []);
    return networkUrlsPromise;
  }

  function chooseInviteOrigin(urls) {
    if (!isLocalHostname(window.location.hostname)) return window.location.origin;
    const lanUrl = urls.find(url => {
      try {
        return !isLocalHostname(new URL(url).hostname);
      } catch {
        return false;
      }
    });
    if (!lanUrl) return window.location.origin;
    return new URL(lanUrl).origin;
  }

  async function buildInviteUrl(code) {
    const urls = await loadNetworkUrls();
    const origin = chooseInviteOrigin(urls);
    const url = new URL(window.location.pathname || "/", origin);
    url.searchParams.set("join", code);
    return url.toString();
  }

  function copyInviteUrlFallback(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "1px";
    textArea.style.height = "1px";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    document.body.append(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);
    const copied = document.execCommand?.("copy") === true;
    textArea.remove();
    if (!copied) throw new Error("Copy fallback failed");
  }

  function selectVisibleInviteUrl() {
    if (!inviteUrl || !window.getSelection || !document.createRange) return false;
    const range = document.createRange();
    range.selectNodeContents(inviteUrl);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  async function copyInviteUrl() {
    if (!currentInviteUrl) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(currentInviteUrl);
      setStatus("Invite link copied.", "ok");
    } catch {
      try {
        copyInviteUrlFallback(currentInviteUrl);
        setStatus("Invite link copied.", "ok");
      } catch {
        setStatus(selectVisibleInviteUrl() ? "Invite link selected. Copy it manually." : "Copy failed. Use the visible invite link.", "warn");
      }
    }
  }

  function closeWaitingHostRoom() {
    if (role !== "host" || peerCount >= 2 || inGame) return false;
    leaveRoom();
    setStatus("Host room closed.", "warn");
    return true;
  }

  function hideInvitePanel() {
    inviteRenderSeq += 1;
    currentInviteUrl = "";
    if (invitePanel) invitePanel.hidden = true;
    if (inviteQr) inviteQr.textContent = "";
    if (inviteUrl) {
      inviteUrl.removeAttribute("href");
      inviteUrl.textContent = "";
    }
    if (copyInviteButton) copyInviteButton.disabled = true;
  }

  function updateInvitePanel() {
    if (!invitePanel || !inviteQr || !inviteUrl) return;
    if (role !== "host" || !roomCode) {
      hideInvitePanel();
      return;
    }
    const renderSeq = inviteRenderSeq + 1;
    inviteRenderSeq = renderSeq;
    invitePanel.hidden = false;
    inviteQr.textContent = "QR";
    inviteUrl.removeAttribute("href");
    inviteUrl.textContent = "";
    if (copyInviteButton) copyInviteButton.disabled = true;
    buildInviteUrl(roomCode).then(url => {
      if (renderSeq !== inviteRenderSeq) return;
      currentInviteUrl = url;
      inviteQr.innerHTML = createInviteQrSvg(url);
      inviteUrl.href = url;
      inviteUrl.textContent = url;
      if (copyInviteButton) copyInviteButton.disabled = false;
    }).catch(error => {
      if (renderSeq !== inviteRenderSeq) return;
      currentInviteUrl = "";
      inviteQr.textContent = "QR unavailable";
      inviteUrl.textContent = "";
      if (copyInviteButton) copyInviteButton.disabled = true;
      setStatus(error.message || "Unable to build invite QR.", "error");
    });
  }

  function urlJoinCode() {
    const params = new URLSearchParams(window.location.search);
    return sanitizeRoomCode(params.get("join") || params.get("room") || params.get("code"));
  }

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
    updateInvitePanel();
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
      // peer-joined arrives before the authoritative peer-state, so reflect the
      // new peer immediately. Otherwise a stale peerCount of 1 lets the host's
      // panel-close path tear down the room right after pairing.
      peerCount = Math.max(peerCount, 2);
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
    const nextCode = sanitizeRoomCode(code || roomCodeInput?.value || "");
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
  copyInviteButton?.addEventListener("click", copyInviteUrl);
  roomCodeInput?.addEventListener("input", () => {
    if (roomCodeInput.readOnly) return;
    roomCodeInput.value = sanitizeRoomCode(roomCodeInput.value);
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
  const initialJoinCode = urlJoinCode();
  if (initialJoinCode.length === 4) {
    if (roomCodeInput) roomCodeInput.value = initialJoinCode;
    setStatus(`Joining LAN room ${initialJoinCode}...`, "pending");
    window.setTimeout(() => joinRoom(initialJoinCode).catch(error => showJoinFailure(error.message)), 0);
  }

  return Object.freeze({
    onGameMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    createRoom,
    joinRoom,
    leaveRoom,
    closeWaitingHostRoom,
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
