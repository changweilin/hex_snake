async function loadLegacyModules() {
  // Keep the legacy script in one evaluated scope while the source is split into smaller files.
  const sources = ["src/state.js", "src/ui.js", "src/audio.js", "src/replay.js", "src/game.js"];
  const parts = await Promise.all(sources.map(async source => {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to load ${source}: ${response.status}`);
    return `\n/* ${source} */\n${await response.text()}`;
  }));

  eval(parts.join("\n"));
}

function showBootError(error) {
  console.error(error);
  const message = document.createElement("pre");
  message.style.cssText = "white-space:pre-wrap;color:#fca5a5;background:#111720;padding:16px;border-radius:8px;max-width:720px";
  message.textContent = `Hex Snake failed to load modules.\n${error.stack || error.message}`;
  document.body.appendChild(message);
}

loadLegacyModules().catch(showBootError);
