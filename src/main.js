const pageLoadingProgress = (() => {
  const root = document.getElementById("pageLoadingProgress");
  const label = document.getElementById("pageLoadingLabel");
  const portrait = document.getElementById("pageLoadingPortrait");
  const portraitImage = document.getElementById("pageLoadingPortraitImage");
  const portraitName = document.getElementById("pageLoadingPortraitName");
  const portraitVariant = document.getElementById("pageLoadingPortraitVariant");
  const loadingPortraitWidths = { sm: 512, md: 1024, full: 2160 };
  const loadingPortraitDelay = 3000;
  const loadingPortraitInterval = 1500;
  let percent = 0;
  let hideTimer = 0;
  let slowLoadTimer = 0;
  let portraitTimer = 0;
  let portraitIndex = 0;
  let portraitSlides = [];
  let completed = false;

  function set(nextPercent, nextLabel) {
    if (!root) return;
    percent = Math.max(percent, Math.min(100, nextPercent));
    root.style.setProperty("--page-loading-progress", `${percent}%`);
    root.setAttribute("aria-valuenow", String(Math.round(percent)));
    if (label && nextLabel) label.textContent = nextLabel;
  }

  function finish() {
    if (!root) return;
    completed = true;
    set(100, "Ready");
    window.clearTimeout(slowLoadTimer);
    window.clearTimeout(portraitTimer);
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
    completed = true;
    window.clearTimeout(slowLoadTimer);
    window.clearTimeout(portraitTimer);
    set(100, "Load failed");
    root.classList.add("is-error");
  }

  function usesOptimizedPortraitImages() {
    return window.__HEX_SNAKE_IMAGE_FORMAT__ === "webp";
  }

  function loadingAssetUrl(src) {
    if (
      usesOptimizedPortraitImages()
      && typeof src === "string"
      && /^assets\/portraits\/.+\.png$/i.test(src)
    ) {
      return src.replace(/\.png$/i, ".webp");
    }
    return src;
  }

  function portraitSource(portraitSet) {
    if (!portraitSet) return null;
    const sizes = usesOptimizedPortraitImages() ? ["sm", "md"] : ["sm", "md", "full"];
    const src = portraitSet.md || portraitSet.sm || (!usesOptimizedPortraitImages() ? portraitSet.full : "");
    if (!src) return null;
    const srcset = sizes
      .filter(size => portraitSet[size])
      .map(size => `${loadingAssetUrl(portraitSet[size])} ${loadingPortraitWidths[size]}w`)
      .join(", ");
    return { src: loadingAssetUrl(src), srcset };
  }

  function buildPortraitSlides(characters) {
    return characters.flatMap(character => {
      const library = character.humanPortraits || {};
      return [
        { key: "small", label: "Small human", portraitSet: library.small || library.intro || library.opening },
        { key: "big", label: "Big human", portraitSet: library.big || library.opening || library.intro }
      ].map(variant => {
        const source = portraitSource(variant.portraitSet);
        if (!source) return null;
        return {
          ...source,
          key: `${character.id || character.slug || character.name}-${variant.key}`,
          name: character.name || character.id || "Character",
          variant: variant.label
        };
      }).filter(Boolean);
    });
  }

  async function loadPortraitSlides() {
    const response = await fetch("data/characters.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to load character portraits: ${response.status}`);
    const characters = await response.json();
    if (!Array.isArray(characters)) return [];
    return buildPortraitSlides(characters);
  }

  function scheduleNextPortrait(delay = loadingPortraitInterval) {
    window.clearTimeout(portraitTimer);
    portraitTimer = window.setTimeout(showNextPortrait, delay);
  }

  function showNextPortrait(attempts = 0) {
    if (completed || !portrait || !portraitImage || portraitSlides.length === 0) return;
    if (attempts >= portraitSlides.length) {
      scheduleNextPortrait(700);
      return;
    }

    const slide = portraitSlides[portraitIndex % portraitSlides.length];
    portraitIndex += 1;

    const image = new Image();
    image.decoding = "async";
    image.sizes = "(max-width: 620px) 58vw, 250px";
    if (slide.srcset) image.srcset = slide.srcset;
    image.onload = () => {
      if (completed) return;
      portraitImage.src = slide.src;
      portraitImage.sizes = image.sizes;
      if (slide.srcset) portraitImage.srcset = slide.srcset;
      portraitImage.alt = slide.name;
      if (portraitName) portraitName.textContent = slide.name;
      if (portraitVariant) portraitVariant.textContent = slide.variant;
      portrait.hidden = false;
      scheduleNextPortrait();
    };
    image.onerror = () => showNextPortrait(attempts + 1);
    image.src = slide.src;
  }

  function startPortraitCarousel() {
    if (!root || completed) return;
    root.classList.add("is-slow");
    set(Math.max(percent, 92), "Still loading");
    loadPortraitSlides()
      .then(slides => {
        if (completed || slides.length === 0) return;
        portraitSlides = slides;
        showNextPortrait();
      })
      .catch(() => {
        if (!completed) set(Math.max(percent, 92), "Still loading");
      });
  }

  if (root) {
    slowLoadTimer = window.setTimeout(startPortraitCarousel, loadingPortraitDelay);
  }

  return { set, finish, fail };
})();

async function loadLegacyModules() {
  // Keep the legacy code in one module scope while the source is split into smaller files.
  const sources = ["src/platform/web.js", "src/state.js", "src/dom.js", "src/ui.js", "src/characters.js", "src/audio.js", "src/replay.js", "src/stats.js", "src/ai.js", "src/render.js", "src/game.js"];
  let loaded = 0;

  pageLoadingProgress.set(8, "Preparing");
  if (window.__HEX_SNAKE_BUNDLED_LEGACY__) {
    pageLoadingProgress.set(96, "Starting");
    return;
  }

  const parts = await Promise.all(sources.map(async source => {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to load ${source}: ${response.status}`);
    const text = await response.text();
    loaded += 1;
    pageLoadingProgress.set(8 + (loaded / sources.length) * 84, `Loading ${loaded}/${sources.length}`);
    return `\n/* ${source} */\n${text}`;
  }));

  pageLoadingProgress.set(96, "Starting");
  const bundleUrl = URL.createObjectURL(new Blob([parts.join("\n")], { type: "text/javascript" }));
  try {
    await import(bundleUrl);
  } finally {
    URL.revokeObjectURL(bundleUrl);
  }
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
