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

  function nativePreferences() {
    return window.Capacitor?.Plugins?.Preferences || null;
  }

  function storageKind() {
    const base = store ? "localStorage" : "memory";
    return nativePreferences()?.set ? `${base}+preferences` : base;
  }

  function mirrorPreferenceSet(key, value) {
    const preferences = nativePreferences();
    if (!preferences?.set) return;
    try {
      preferences.set({ key, value }).catch(error => {
        console.warn(`Unable to mirror ${key} to native preferences:`, error);
      });
    } catch (error) {
      console.warn(`Unable to mirror ${key} to native preferences:`, error);
    }
  }

  function mirrorPreferenceRemove(key) {
    const preferences = nativePreferences();
    if (!preferences?.remove) return;
    try {
      preferences.remove({ key }).catch(error => {
        console.warn(`Unable to remove ${key} from native preferences:`, error);
      });
    } catch (error) {
      console.warn(`Unable to remove ${key} from native preferences:`, error);
    }
  }

  function get(key) {
    if (store) return store.getItem(key);
    return memory.has(key) ? memory.get(key) : null;
  }

  function set(key, value) {
    const nextValue = String(value);
    if (store) {
      store.setItem(key, nextValue);
      mirrorPreferenceSet(key, nextValue);
      return;
    }
    memory.set(key, nextValue);
    mirrorPreferenceSet(key, nextValue);
  }

  function remove(key) {
    if (store) {
      store.removeItem(key);
      mirrorPreferenceRemove(key);
      return;
    }
    memory.delete(key);
    mirrorPreferenceRemove(key);
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
    kind: storageKind(),
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

  function capacitor() {
    return window.Capacitor || null;
  }

  function platformName() {
    const cap = capacitor();
    try {
      return cap?.getPlatform?.() || "web";
    } catch {
      return "web";
    }
  }

  function isNativePlatform() {
    const cap = capacitor();
    try {
      if (typeof cap?.isNativePlatform === "function") return cap.isNativePlatform();
    } catch {
      return false;
    }
    return platformName() !== "web";
  }

  function plugin(name) {
    return capacitor()?.Plugins?.[name] || null;
  }

  function addNativeListener(nativePlugin, eventName, callback) {
    if (!nativePlugin?.addListener) return;
    try {
      const handle = nativePlugin.addListener(eventName, callback);
      if (handle?.catch) handle.catch(error => {
        console.warn(`Unable to register ${eventName} listener:`, error);
      });
    } catch (error) {
      console.warn(`Unable to register ${eventName} listener:`, error);
    }
  }

  function emit(callbacks, detail) {
    callbacks.forEach(callback => {
      try {
        callback(detail);
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

  function emitBackButton(event = {}) {
    const callbacks = [...backButtonCallbacks].reverse();
    for (const callback of callbacks) {
      try {
        if (callback(event) === true) return true;
      } catch (error) {
        console.warn("Platform back button callback failed:", error);
      }
    }
    return false;
  }

  function handleUnhandledBackButton(event = {}) {
    if (event.canGoBack && window.history.length > 1) {
      window.history.back();
      return true;
    }

    const app = plugin("App");
    if (app?.exitApp && window.confirm("要離開 Hex Snake 嗎？")) {
      app.exitApp().catch(error => console.warn("Unable to exit app:", error));
      return true;
    }

    return false;
  }

  document.addEventListener("visibilitychange", () => setPaused(document.hidden));
  window.addEventListener("pagehide", () => setPaused(true));
  window.addEventListener("pageshow", () => setPaused(document.hidden));

  const app = plugin("App");
  addNativeListener(app, "pause", () => setPaused(true));
  addNativeListener(app, "resume", () => setPaused(false));
  addNativeListener(app, "appStateChange", state => setPaused(!state?.isActive));
  addNativeListener(app, "backButton", event => {
    if (!emitBackButton(event)) handleUnhandledBackButton(event);
  });

  document.documentElement.classList.add("is-mobile-app-shell");
  document.documentElement.dataset.hexSnakePlatform = platformName();

  function autoLowPowerMode() {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true;
    const memoryGb = Number(navigator.deviceMemory || 0);
    if (memoryGb && memoryGb <= 4) return true;
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

  function hapticStyle(strength) {
    if (strength >= 16) return "HEAVY";
    if (strength >= 10) return "MEDIUM";
    return "LIGHT";
  }

  function browserVibrate(strength = 8) {
    if (!navigator.vibrate) return false;
    navigator.vibrate(strength);
    return true;
  }

  function nativeVibrate(strength = 8) {
    const haptics = plugin("Haptics");
    if (!haptics) return browserVibrate(strength);
    try {
      if (haptics.impact) {
        haptics.impact({ style: hapticStyle(strength) }).catch(error => {
          console.warn("Native haptic impact failed:", error);
        });
        return true;
      }
      if (haptics.vibrate) {
        haptics.vibrate({ duration: Math.max(8, Math.min(80, Number(strength) || 8)) }).catch(error => {
          console.warn("Native haptic vibrate failed:", error);
        });
        return true;
      }
    } catch (error) {
      console.warn("Native haptic feedback failed:", error);
    }
    return browserVibrate(strength);
  }

  return Object.freeze({
    kind: "mobile",
    storage: HexSnakeStorage,
    native: Object.freeze({
      available: isNativePlatform,
      platform: platformName,
      plugin
    }),
    haptics: Object.freeze({
      vibrate: nativeVibrate
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
      buildTarget: window.__HEX_SNAKE_BUILD_TARGET__ || "mobile",
      platform: platformName(),
      native: isNativePlatform(),
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

const HexSnakeRuntime = Object.freeze({
  platform: HexSnakePlatform,
  storage: HexSnakeStorage
});

window.HexSnakeStorage = HexSnakeStorage;
window.HexSnakePlatform = HexSnakePlatform;
window.HexSnakeRuntime = HexSnakeRuntime;
window.HexSnakeMobilePlatform = HexSnakePlatform;
