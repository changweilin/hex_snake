const CharacterState = HexSnakeState;
const CharacterGameState = CharacterState.game;
const CharacterUiState = CharacterState.ui;
const CharacterConfig = CharacterState.config;
const CharacterUI = HexSnakeUI;
const CharacterDom = HexSnakeDOM;

    const portraitSizeWidths = {
      sm: 512,
      md: 1024,
      full: 2160
    };

    const avatarSizeWidths = {
      sm: 384,
      md: 768,
      full: 1024
    };

    const poseAliases = {
      opening: "opening",
      intro: "opening",
      idle: "intro",
      attack: "small",
      small: "small",
      big: "big",
      victory: "victory",
      defeat: "defeat",
    };
    const portraitPoses = new Set(Object.keys(poseAliases));

    function usesOptimizedPortraitImages() {
      return window.__HEX_SNAKE_IMAGE_FORMAT__ === "webp";
    }

    function deployPortraitSize(size) {
      return usesOptimizedPortraitImages() && size === "full" ? "md" : size;
    }

    function deployPortraitSizes(sizes) {
      return usesOptimizedPortraitImages() ? sizes.filter(size => size !== "full") : sizes;
    }

    function deployPortraitImageUrl(url) {
      if (
        usesOptimizedPortraitImages()
        && typeof url === "string"
        && /^assets\/portraits\/.+\.png$/i.test(url)
      ) {
        return url.replace(/\.png$/i, ".webp");
      }
      return url;
    }

    CharacterDom.bestEl.textContent = CharacterGameState.best;

    function normalizeCharacter(entry) {
      const labels = CharacterConfig.foodLabels;
      const configuredFoodTypes = CharacterConfig.foodTypes;
      const foodPreference = labels[entry.foodPreference] ? entry.foodPreference : "balanced";
      const food = configuredFoodTypes.some(type => type.id === foodPreference) ? foodPreference : "balanced";
      const colors = entry.colors || {};
      const representColor = entry.representColor || colors.body || "#f8fafc";
      return {
        ...entry,
        food,
        foodLabel: labels[foodPreference] || labels.balanced,
        specialFood: entry.specialFood || (foodPreference === "black" ? "black" : null),
        detail: entry.foodEffect || "",
        color: representColor,
        body: colors.body || representColor,
        line: colors.line || "#f8fafc",
        accent: colors.accent || representColor,
        story: Array.isArray(entry.story) ? entry.story : [],
        portraits: entry.portraits || {},
        slug: entry.slug || entry.id,
        move: entry.bigMove || entry.smallMove || entry.name
      };
    }

    async function loadCharacterDatabase() {
      const response = await fetch("data/characters.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("data/characters.json must contain at least one character.");
      }
      CharacterUI.setCharacterCatalog(data.map(normalizeCharacter));
      const characterList = CharacterUI.characterList();
      CharacterGameState.playerCharacterId = CharacterUI.hasCharacterId(CharacterGameState.playerCharacterId)
        ? CharacterGameState.playerCharacterId
        : characterList[0].id;
      CharacterGameState.computerCharacterId = CharacterUI.hasCharacterId(CharacterGameState.computerCharacterId)
        ? CharacterGameState.computerCharacterId
        : characterList[Math.min(1, characterList.length - 1)].id;
      CharacterGameState.playerCharacterChoice = CharacterGameState.playerCharacterId;
      CharacterGameState.computerCharacterChoice = CharacterGameState.computerCharacterId;
      CharacterUI.loadSavedCharacterChoices();
    }

    function showCharacterDatabaseError(error) {
      console.error(error);
      CharacterDom.overlayTitle.textContent = "角色資料載入失敗";
      CharacterDom.overlayText.textContent = `找不到或無法解析 data/characters.json：${error.message}`;
      CharacterDom.startButton.textContent = "重新載入";
      CharacterDom.startButton.onclick = () => window.location.reload();
      CharacterUI.setOverlayChromeVisible(true);
      CharacterDom.overlay.classList.add("show");
    }

    function characterFor(owner) {
      const characterId =
        owner === "player"
          ? CharacterGameState.playerCharacterId
          : CharacterGameState.computerCharacterId;
      return CharacterUI.characterForId(characterId) || CharacterUI.characterList()[0];
    }

    function characterChoiceFor(owner) {
      return owner === "player"
        ? CharacterGameState.playerCharacterChoice
        : CharacterGameState.computerCharacterChoice;
    }

    function isRandomCharacterChoice(owner) {
      return CharacterUI.isRandomCharacterChoiceId(characterChoiceFor(owner));
    }

    function selectedCharacterFor(owner) {
      return isRandomCharacterChoice(owner) ? null : characterFor(owner);
    }

    const startLogoRandomCharacterIds = {
      player: null,
      computer: null
    };

    function startLogoOwner(owner) {
      return owner === "computer" ? "computer" : "player";
    }

    function ensureStartLogoRandomCharacterId(owner) {
      const safeOwner = startLogoOwner(owner);
      const existing = startLogoRandomCharacterIds[safeOwner];
      if (existing && CharacterUI.hasCharacterId(existing)) return existing;
      const randomId = randomCharacter().id;
      if (randomId) startLogoRandomCharacterIds[safeOwner] = randomId;
      return randomId;
    }

    function consumeStartLogoRandomCharacterId(owner) {
      const safeOwner = startLogoOwner(owner);
      const randomId = startLogoRandomCharacterIds[safeOwner];
      startLogoRandomCharacterIds[safeOwner] = null;
      return randomId;
    }

    function clearStartLogoRandomCharacterId(owner) {
      const safeOwner = startLogoOwner(owner);
      startLogoRandomCharacterIds[safeOwner] = null;
    }

    function startLogoCharacterFor(owner) {
      if (!isRandomCharacterChoice(owner)) return characterFor(owner);
      return CharacterUI.characterForId(ensureStartLogoRandomCharacterId(owner)) || CharacterUI.characterList()[0];
    }

    function randomCharacter() {
      const characterList = CharacterUI.characterList();
      return characterList[Math.floor(Math.random() * characterList.length)] || characterList[0];
    }

    function randomPortraitMarkup(owner) {
      return `
        <div class="fighter-portrait is-random" data-owner="${owner}" data-owner-mark="${ownerMeta(owner).mark}" style="${characterStyle({
          color: ownerMeta(owner).color,
          line: ownerMeta(owner).line,
          accent: "#fbbf24"
        }, owner)}">
          <span class="fighter-avatar-image random-portrait-mark" aria-hidden="true">?</span>
        </div>
      `;
    }

    function ownerMeta(owner) {
      const colors = CharacterConfig.colors;
      return owner === "computer"
        ? { mark: "P2", label: "P2", color: colors.computerHead, line: colors.computerHeadLine }
        : { mark: "P1", label: "P1", color: colors.head, line: colors.headLine };
    }

    function buildCharacterOptions() {
      [CharacterDom.playerCharacterInput, CharacterDom.computerCharacterInput].forEach(select => {
        select.innerHTML = [
          `<option value="${CharacterUI.randomCharacterChoiceId}">隨機選擇 / 開局抽選</option>`,
          ...CharacterUI.characterList().map(character => (
          `<option value="${character.id}">${character.name} / ${character.foodLabel}</option>`
          ))
        ].join("");
      });
      CharacterUI.syncCharacterInputs();
    }

    function portraitLibrary(character) {
      const variantMode = CharacterUiState.portraitVariantMode;
      if (variantMode === "human") {
        return character.humanPortraits || character.archivedPortraits || character.portraits || {};
      }
      if (variantMode === "beast") {
        return character.archivedPortraits || character.portraits || {};
      }
      return character.portraits || {};
    }

    function portraitUrl(character, pose, size = "full") {
      const safePose = portraitPoses.has(pose) ? pose : "idle";
      const semanticPose = CharacterUiState.portraitVariantMode === "beast" ? "opening" : poseAliases[safePose] || "intro";
      const deploySize = deployPortraitSize(size);
      const library = portraitLibrary(character);
      const portrait = library?.[semanticPose] || library?.intro || library?.opening;
      if (portrait) {
        if (typeof portrait === "string") return deployPortraitImageUrl(portrait);
        return deployPortraitImageUrl(portrait[deploySize] || portrait.md || portrait.sm || portrait.full || character.avatar || "");
      }
      const slug = character.slug || character.id;
      const legacyPose = safePose === "idle" ? "idle" : safePose === "attack" ? "attack" : semanticPose === "opening" ? "intro" : semanticPose;
      if (deploySize === "sm" || deploySize === "md") {
        return deployPortraitImageUrl(`assets/portraits/${deploySize}/${slug}_${legacyPose}.png`);
      }
      return deployPortraitImageUrl(`assets/portraits/${slug}_${legacyPose}.png`);
    }

    const preloadedPortraits = new Set();

    function portraitSrcset(character, pose, includeFull = false) {
      const sizes = deployPortraitSizes(includeFull ? ["sm", "md", "full"] : ["sm", "md"]);
      return sizes.map(size => `${portraitUrl(character, pose, size)} ${portraitSizeWidths[size]}w`).join(", ");
    }

    function preloadPortrait(character, pose, size = "sm") {
      const url = portraitUrl(character, pose, size);
      if (preloadedPortraits.has(url)) return;
      preloadedPortraits.add(url);
      const image = new Image();
      image.decoding = "async";
      image.src = url;
    }

    function preloadPortraitsFor(owner) {
      const character = characterFor(owner);
      const isBeastPortrait = CharacterUiState.portraitVariantMode === "beast";
      const smPoses = isBeastPortrait ? ["intro"] : ["intro", "idle", "attack", "victory", "defeat"];
      const mdPoses = isBeastPortrait ? ["intro"] : ["intro", "victory", "defeat"];
      smPoses.forEach(pose => preloadPortrait(character, pose, "sm"));
      mdPoses.forEach(pose => preloadPortrait(character, pose, "md"));
    }

    function preloadAllPortraits() {
      CharacterUI.characterList().forEach(character => {
        const poses = CharacterUiState.portraitVariantMode === "beast" ? ["intro"] : ["intro", "idle"];
        poses.forEach(pose => preloadPortrait(character, pose, "sm"));
      });
    }

    function portraitSizesAttribute(variant) {
      if (variant === "full") return "86vw";
      if (variant === "small") return "(max-width: 700px) 46vw, 220px";
      return "(max-width: 700px) 46vw, 360px";
    }

    function duelAvatarUrl(character, size = "sm") {
      const slug = character.slug || character.id;
      const deploySize = deployPortraitSize(size);
      const currentVariant = CharacterUiState.portraitVariantMode;
      const variant = CharacterUiState.portraitVariantModes.includes(currentVariant)
        ? currentVariant
        : CharacterUiState.defaultPortraitVariantMode;
      return deployPortraitImageUrl(`assets/portraits/avatars/${variant}/${deploySize}/${slug}_duel.png`);
    }

    function avatarUrl(character, size = "sm") {
      return duelAvatarUrl(character, size);
    }

    function avatarSrcset(character, includeFull = false) {
      const sizes = deployPortraitSizes(includeFull ? ["sm", "md", "full"] : ["sm", "md"]);
      return sizes.map(size => `${avatarUrl(character, size)} ${avatarSizeWidths[size]}w`).join(", ");
    }

    const HexSnakeCharacters = Object.freeze({
      avatarSrcset,
      avatarUrl,
      buildCharacterOptions,
      characterChoiceFor,
      characterFor,
      clearStartLogoRandomCharacterId,
      consumeStartLogoRandomCharacterId,
      ensureStartLogoRandomCharacterId,
      isRandomCharacterChoice,
      loadCharacterDatabase,
      ownerMeta,
      portraitSizesAttribute,
      portraitSrcset,
      portraitUrl,
      preloadAllPortraits,
      preloadPortraitsFor,
      randomCharacter,
      randomPortraitMarkup,
      selectedCharacterFor,
      showCharacterDatabaseError,
      startLogoCharacterFor
    });

    Object.assign(CharacterUI, HexSnakeCharacters);

export {
  HexSnakeCharacters,
  avatarSrcset,
  avatarUrl,
  buildCharacterOptions,
  characterChoiceFor,
  characterFor,
  clearStartLogoRandomCharacterId,
  consumeStartLogoRandomCharacterId,
  ensureStartLogoRandomCharacterId,
  isRandomCharacterChoice,
  loadCharacterDatabase,
  ownerMeta,
  portraitSizesAttribute,
  portraitSrcset,
  portraitUrl,
  preloadAllPortraits,
  preloadPortraitsFor,
  randomCharacter,
  randomPortraitMarkup,
  selectedCharacterFor,
  showCharacterDatabaseError,
  startLogoCharacterFor,
  HexSnakeCharacters as characterCatalog
};
