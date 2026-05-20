const HexSnakeStorage = (() => {
  const versionKey = "hexSnakeSaveDataVersion";
  const currentVersion = 1;
  const memory = new Map();

  function localStore() {
    try {
      const key = "__hexSnakeStorageProbe";
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return window.localStorage;
    } catch {
      return null;
    }
  }

  const store = localStore();

  function get(key) {
    if (store) return store.getItem(key);
    return memory.has(key) ? memory.get(key) : null;
  }

  function set(key, value) {
    const nextValue = String(value);
    if (store) {
      store.setItem(key, nextValue);
      return;
    }
    memory.set(key, nextValue);
  }

  function remove(key) {
    if (store) {
      store.removeItem(key);
      return;
    }
    memory.delete(key);
  }

  function getJson(key, fallback) {
    const raw = get(key);
    if (raw === null || raw === undefined || raw === "") return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Resetting corrupted save data for ${key}:`, error);
      remove(key);
      return fallback;
    }
  }

  function setJson(key, value) {
    set(key, JSON.stringify(value));
  }

  function migrate() {
    const savedVersion = Number(get(versionKey) || 0);
    if (savedVersion === currentVersion) return;
    set(versionKey, String(currentVersion));
  }

  migrate();

  return Object.freeze({
    version: currentVersion,
    kind: store ? "localStorage" : "memory",
    get,
    set,
    remove,
    getJson,
    setJson,
    migrate
  });
})();

const HexSnakePlatform = (() => {
  const lowPowerPreferenceKey = "hexSnakeLowPowerMode";
  const pauseCallbacks = new Set();
  const resumeCallbacks = new Set();
  const backButtonCallbacks = new Set();
  const frameStats = {
    fps: 0,
    frameMs: 0,
    lastFrameAt: 0
  };
  let paused = document.hidden;

  function emit(callbacks) {
    callbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn("Platform lifecycle callback failed:", error);
      }
    });
  }

  function setPaused(nextPaused) {
    const active = Boolean(nextPaused);
    if (paused === active) return;
    paused = active;
    emit(paused ? pauseCallbacks : resumeCallbacks);
  }

  document.addEventListener("visibilitychange", () => setPaused(document.hidden));
  window.addEventListener("pagehide", () => setPaused(true));
  window.addEventListener("pageshow", () => setPaused(document.hidden));

  function autoLowPowerMode() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true;
    return Number(navigator.hardwareConcurrency || 8) <= 4;
  }

  function lowPowerMode() {
    const preference = HexSnakeStorage.get(lowPowerPreferenceKey);
    if (preference === "1") return true;
    if (preference === "0") return false;
    return autoLowPowerMode();
  }

  function setLowPowerMode(enabled) {
    HexSnakeStorage.set(lowPowerPreferenceKey, enabled ? "1" : "0");
    return lowPowerMode();
  }

  function clearLowPowerModePreference() {
    HexSnakeStorage.remove(lowPowerPreferenceKey);
    return lowPowerMode();
  }

  async function copyText(text) {
    const value = String(text || "");
    if (!value) return false;
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.append(field);
    field.select();
    let copied = false;
    try {
      copied = Boolean(document.execCommand?.("copy"));
    } finally {
      field.remove();
    }
    if (copied) return true;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  return Object.freeze({
    kind: "web",
    storage: HexSnakeStorage,
    haptics: Object.freeze({
      vibrate(strength = 8) {
        if (!navigator.vibrate) return false;
        navigator.vibrate(strength);
        return true;
      }
    }),
    lifecycle: Object.freeze({
      isPaused() {
        return paused;
      },
      onPause(callback) {
        pauseCallbacks.add(callback);
        return () => pauseCallbacks.delete(callback);
      },
      onResume(callback) {
        resumeCallbacks.add(callback);
        return () => resumeCallbacks.delete(callback);
      },
      onBackButton(callback) {
        backButtonCallbacks.add(callback);
        return () => backButtonCallbacks.delete(callback);
      }
    }),
    share: Object.freeze({
      async canShare(data = {}) {
        return Boolean(navigator.share) && (!navigator.canShare || navigator.canShare(data));
      },
      async share(data) {
        if (!navigator.share) return false;
        await navigator.share(data);
        return true;
      },
      copyText
    }),
    appInfo: Object.freeze({
      name: "Hex Snake",
      version: window.__HEX_SNAKE_APP_VERSION__ || "dev",
      buildVersion: window.__HEX_SNAKE_BUILD_VERSION__ || "dev",
      buildTarget: window.__HEX_SNAKE_BUILD_TARGET__ || "web",
      platform: "web",
      storageKind: HexSnakeStorage.kind,
      imageFormat: window.__HEX_SNAKE_IMAGE_FORMAT__ || "png",
      audioFormat: window.__HEX_SNAKE_AUDIO_FORMAT__ || "wav"
    }),
    display: Object.freeze({
      maxDpr: 2,
      devicePixelRatio(max = 2) {
        const maxDpr = lowPowerMode() ? Math.min(max, 1.5) : max;
        return Math.max(1, Math.min(maxDpr, window.devicePixelRatio || 1));
      },
      lowPowerMode,
      setLowPowerMode,
      clearLowPowerModePreference,
      autoLowPowerMode,
      visualLoadScale() {
        return lowPowerMode() ? 0.68 : 1;
      },
      recordFrame(now = performance.now()) {
        if (frameStats.lastFrameAt) {
          const frameMs = now - frameStats.lastFrameAt;
          frameStats.frameMs = frameMs;
          frameStats.fps = frameMs > 0 ? 1000 / frameMs : 0;
        }
        frameStats.lastFrameAt = now;
        return frameStats;
      },
      frameStats
    })
  });
})();

window.HexSnakeStorage = HexSnakeStorage;
window.HexSnakePlatform = HexSnakePlatform;
