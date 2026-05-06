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

    bestEl.textContent = best;

    function normalizeCharacter(entry) {
      const foodPreference = foodLabels[entry.foodPreference] ? entry.foodPreference : "balanced";
      const food = foodTypes.some(type => type.id === foodPreference) ? foodPreference : "balanced";
      const colors = entry.colors || {};
      const representColor = entry.representColor || colors.body || "#f8fafc";
      return {
        ...entry,
        food,
        foodLabel: foodLabels[foodPreference] || foodLabels.balanced,
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
      characters = data.map(normalizeCharacter);
      characterById = new Map(characters.map(character => [character.id, character]));
      playerCharacterId = characterById.has(playerCharacterId) ? playerCharacterId : characters[0].id;
      computerCharacterId = characterById.has(computerCharacterId) ? computerCharacterId : characters[Math.min(1, characters.length - 1)].id;
      playerCharacterChoice = playerCharacterId;
      computerCharacterChoice = computerCharacterId;
      loadSavedCharacterChoices();
    }

    function showCharacterDatabaseError(error) {
      console.error(error);
      overlayTitle.textContent = "角色資料載入失敗";
      overlayText.textContent = `找不到或無法解析 data/characters.json：${error.message}`;
      startButton.textContent = "重新載入";
      startButton.onclick = () => window.location.reload();
      setOverlayChromeVisible(true);
      overlay.classList.add("show");
    }

    function characterFor(owner) {
      return characterById.get(owner === "player" ? playerCharacterId : computerCharacterId) || characters[0];
    }

    function characterChoiceFor(owner) {
      return owner === "player" ? playerCharacterChoice : computerCharacterChoice;
    }

    function isRandomCharacterChoice(owner) {
      return characterChoiceFor(owner) === randomCharacterChoiceId;
    }

    function selectedCharacterFor(owner) {
      return isRandomCharacterChoice(owner) ? null : characterFor(owner);
    }

    function randomCharacter() {
      return characters[Math.floor(Math.random() * characters.length)] || characters[0];
    }

    function randomPortraitMarkup(owner) {
      return `
        <div class="fighter-portrait is-random" data-owner="${owner}" data-owner-mark="${ownerMeta(owner).mark}" style="${characterStyle({
          color: ownerMeta(owner).color,
          line: ownerMeta(owner).line,
          accent: "#fbbf24"
        }, owner)}">
          <span class="random-portrait-mark" aria-hidden="true">?</span>
        </div>
      `;
    }

    function ownerMeta(owner) {
      return owner === "computer"
        ? { mark: "P2", label: "P2", color: colors.computerHead, line: colors.computerHeadLine }
        : { mark: "P1", label: "P1", color: colors.head, line: colors.headLine };
    }

    function buildCharacterOptions() {
      [playerCharacterInput, computerCharacterInput].forEach(select => {
        select.innerHTML = [
          `<option value="${randomCharacterChoiceId}">隨機選擇 / 開局抽選</option>`,
          ...characters.map(character => (
          `<option value="${character.id}">${character.name} / ${character.foodLabel}</option>`
          ))
        ].join("");
      });
      syncCharacterInputs();
    }

    function portraitLibrary(character) {
      if (portraitVariantMode === "human") {
        return character.humanPortraits || character.archivedPortraits || character.portraits || {};
      }
      if (portraitVariantMode === "beast") {
        return character.archivedPortraits || character.portraits || {};
      }
      return character.portraits || {};
    }

    function portraitUrl(character, pose, size = "full") {
      const safePose = portraitPoses.has(pose) ? pose : "idle";
      const semanticPose = portraitVariantMode === "beast" ? "opening" : poseAliases[safePose] || "intro";
      const library = portraitLibrary(character);
      const portrait = library?.[semanticPose] || library?.intro || library?.opening;
      if (portrait) {
        if (typeof portrait === "string") return portrait;
        return portrait[size] || portrait.full || portrait.md || portrait.sm || character.avatar || "";
      }
      const slug = character.slug || character.id;
      const legacyPose = safePose === "idle" ? "idle" : safePose === "attack" ? "attack" : semanticPose === "opening" ? "intro" : semanticPose;
      if (size === "sm" || size === "md") {
        return `assets/portraits/${size}/${slug}_${legacyPose}.png`;
      }
      return `assets/portraits/${slug}_${legacyPose}.png`;
    }

    const preloadedPortraits = new Set();

    function portraitSrcset(character, pose, includeFull = false) {
      const sizes = includeFull ? ["sm", "md", "full"] : ["sm", "md"];
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
      const smPoses = portraitVariantMode === "beast" ? ["intro"] : ["intro", "idle", "attack", "victory", "defeat"];
      const mdPoses = portraitVariantMode === "beast" ? ["intro"] : ["intro", "victory", "defeat"];
      smPoses.forEach(pose => preloadPortrait(character, pose, "sm"));
      mdPoses.forEach(pose => preloadPortrait(character, pose, "md"));
    }

    function preloadAllPortraits() {
      characters.forEach(character => {
        const poses = portraitVariantMode === "beast" ? ["intro"] : ["intro", "idle"];
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
      const variant = portraitVariantModes.includes(portraitVariantMode) ? portraitVariantMode : "chibi";
      return `assets/portraits/avatars/${variant}/${size}/${slug}_duel.png`;
    }

    function avatarUrl(character, size = "sm") {
      return duelAvatarUrl(character, size);
    }

    function avatarSrcset(character, includeFull = false) {
      const sizes = includeFull ? ["sm", "md", "full"] : ["sm", "md"];
      return sizes.map(size => `${avatarUrl(character, size)} ${avatarSizeWidths[size]}w`).join(", ");
    }
