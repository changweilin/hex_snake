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
  const pauseCallbacks = new Set();
  const resumeCallbacks = new Set();
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

  function lowPowerMode() {
    if (HexSnakeStorage.get("hexSnakeLowPowerMode") === "1") return true;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true;
    return Number(navigator.hardwareConcurrency || 8) <= 4;
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
      }
    }),
    appInfo: Object.freeze({
      name: "Hex Snake",
      version: window.__HEX_SNAKE_BUILD_VERSION__ || "dev"
    }),
    display: Object.freeze({
      maxDpr: 2,
      devicePixelRatio(max = 2) {
        return Math.max(1, Math.min(max, window.devicePixelRatio || 1));
      },
      lowPowerMode,
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

window.HexSnakePlatform = HexSnakePlatform;
