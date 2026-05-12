const pageLoadingProgress = (() => {
  const root = document.getElementById("pageLoadingProgress");
  const label = document.getElementById("pageLoadingLabel");
  let percent = 0;
  let hideTimer = 0;

  function set(nextPercent, nextLabel) {
    if (!root) return;
    percent = Math.max(percent, Math.min(100, nextPercent));
    root.style.setProperty("--page-loading-progress", `${percent}%`);
    root.setAttribute("aria-valuenow", String(Math.round(percent)));
    if (label && nextLabel) label.textContent = nextLabel;
  }

  function finish() {
    if (!root) return;
    set(100, "Ready");
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      root.classList.add("is-complete");
      window.setTimeout(() => {
        root.hidden = true;
      }, 240);
    }, 260);
  }

  function fail() {
    if (!root) return;
    set(100, "Load failed");
    root.classList.add("is-error");
  }

  return { set, finish, fail };
})();

async function loadLegacyModules() {
  // Keep the legacy script in one evaluated scope while the source is split into smaller files.
  const sources = ["src/state.js", "src/dom.js", "src/ui.js", "src/characters.js", "src/audio.js", "src/replay.js", "src/ai.js", "src/render.js", "src/game.js"];
  let loaded = 0;

  pageLoadingProgress.set(8, "Preparing");
  const parts = await Promise.all(sources.map(async source => {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to load ${source}: ${response.status}`);
    const text = await response.text();
    loaded += 1;
    pageLoadingProgress.set(8 + (loaded / sources.length) * 84, `Loading ${loaded}/${sources.length}`);
    return `\n/* ${source} */\n${text}`;
  }));

  pageLoadingProgress.set(96, "Starting");
  eval(parts.join("\n"));
}

function showBootError(error) {
  console.error(error);
  const message = document.createElement("pre");
  message.style.cssText = "white-space:pre-wrap;color:#fca5a5;background:#111720;padding:16px;border-radius:8px;max-width:720px";
  message.textContent = `Hex Snake failed to load modules.\n${error.stack || error.message}`;
  document.body.appendChild(message);
}

loadLegacyModules()
  .then(() => {
    if (document.readyState === "complete") {
      pageLoadingProgress.finish();
      return;
    }
    window.addEventListener("load", () => pageLoadingProgress.finish(), { once: true });
  })
  .catch(error => {
    pageLoadingProgress.fail();
    showBootError(error);
  });
