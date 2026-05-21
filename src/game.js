    const GameControls = HexSnakeControls;
    const GameRuntime = HexSnakeRuntime;
    const GameRootState = HexSnakeState;
    const GameConfig = GameRootState.config;
    const GameRuntimeState = GameRootState.game;
    const GamePresentationState = GameRootState.ui;
    const GameUI = HexSnakeUI;
    const GameDom = HexSnakeDOM;
    const { keyLabel, normalizeAutoBattleSpeed, normalizeKey } = GameControls;
    const Dom = GameDom;
    const GameAI = GameUI.ai;
    const GameAbout = GameUI.about;
    const GameAudio = GameUI.audio;
    const GameNetwork = GameUI.network;
    const GameReplay = GameUI.replay;
    const GameRender = HexSnakeRender;
    const GameRenderGame = HexSnakeRenderGame;
    const GameStats = GameUI.stats;
    const GamePlatform = GameRuntime.platform;
    const GameStorage = GameRuntime.storage;

    function saveKeybinds() {
      GameStorage.setJson("hexSnakeKeybinds", GameRuntimeState.keybinds);
    }

    const controlProfilesKey = "hexSnakeControlProfilesV1";
    const selectedControlProfileKey = "hexSnakeSelectedControlProfileV1";
    const controlProfileLimit = 8;
    let controlProfiles = loadControlProfiles();
    let selectedControlProfileId = String(GameStorage.get(selectedControlProfileKey) || "").slice(0, 48);

    function cloneKeybinds(value = GameRuntimeState.keybinds) {
      return {
        smallAttack: normalizeKey(value.smallAttack, GameConfig.defaultKeybinds.smallAttack),
        bigAttack: normalizeKey(value.bigAttack, GameConfig.defaultKeybinds.bigAttack),
        pause: normalizeKey(value.pause, GameConfig.defaultKeybinds.pause),
        surrender: normalizeKey(value.surrender, GameConfig.defaultKeybinds.surrender),
        directions: GameConfig.defaultKeybinds.directions.map((fallback, index) => normalizeKey(value.directions?.[index], fallback))
      };
    }

    function cloneKeyboardAttackAim(value = GameRuntimeState.keyboardAttackAim) {
      return {
        small: {
          targetModeIndex: Math.max(0, Number(value.small?.targetModeIndex) || 0) % GameConfig.keyboardTargetModes.length,
          direction: Math.max(0, Number(value.small?.direction) || 0) % GameConfig.directions.length
        },
        big: {
          targetModeIndex: Math.max(0, Number(value.big?.targetModeIndex) || 0) % GameConfig.keyboardTargetModes.length,
          direction: Math.max(0, Number(value.big?.direction) || 0) % GameConfig.directions.length
        }
      };
    }

    function cloneInitialStock(value = GameRuntimeState.initialStock) {
      return GameConfig.foodTypes.reduce((stock, type) => {
        stock[type.id] = clampInitialStock(value?.[type.id] ?? GameConfig.defaultSettings.initialStock[type.id] ?? 0);
        return stock;
      }, {});
    }

    function normalizeCharacterChoice(owner, value) {
      const fallback = owner === "computer" ? GameConfig.defaultSettings.computerCharacterId : GameConfig.defaultSettings.playerCharacterId;
      const choice = String(value || fallback).slice(0, 64);
      if (GameUI.isRandomCharacterChoiceId(choice)) return choice;
      if (!GameUI.hasCharacterCatalog()) return choice || fallback;
      return GameUI.hasCharacterId(choice) ? choice : fallback;
    }

    function normalizeGmPresetMode(value) {
      return Object.prototype.hasOwnProperty.call(Dom.gmPresetButtons, value) ? value : null;
    }

    function cloneGameSettings(value = {}) {
      const presetMode = Object.prototype.hasOwnProperty.call(value, "gmPresetMode") ? value.gmPresetMode : GameRuntimeState.gmPresetMode;
      return {
        computerDifficulty: ["novice", "low", "medium", "high", "extreme"].includes(value.computerDifficulty) ? value.computerDifficulty : GameRuntimeState.computerDifficulty,
        playerCharacterChoice: normalizeCharacterChoice("player", value.playerCharacterChoice ?? GameRuntimeState.playerCharacterChoice),
        computerCharacterChoice: normalizeCharacterChoice("computer", value.computerCharacterChoice ?? GameRuntimeState.computerCharacterChoice),
        gmMode: Boolean(value.gmMode ?? GameRuntimeState.gmMode),
        gmPresetMode: normalizeGmPresetMode(presetMode),
        gridSize: clampGridSize(value.gridSize ?? GameRuntimeState.gridSize),
        foodCount: clampFoodCount(value.foodCount ?? GameRuntimeState.foodCount),
        initialSpeed: clampInitialSpeed(value.initialSpeed ?? GameRuntimeState.initialSpeed),
        initialLength: clampInitialLength(value.initialLength ?? GameRuntimeState.initialLength),
        initialEnergy: clampInitialEnergy(value.initialEnergy ?? GameRuntimeState.initialEnergy),
        initialBombs: clampInitialBombs(value.initialBombs ?? GameRuntimeState.initialBombs),
        initialStock: cloneInitialStock(value.initialStock ?? GameRuntimeState.initialStock)
      };
    }

    function cloneProfilePreferences(value = {}) {
      return {
        sfxMuted: Boolean(value.sfxMuted ?? GameAudio.muted),
        lowPowerMode: Boolean(value.lowPowerMode ?? GamePlatform.display.lowPowerMode()),
        "perfStatsVisible": Boolean(value.perfStatsVisible ?? GamePresentationState.perfStatsVisible)
      };
    }

    function controlProfileConfig() {
      return {
        keybinds: cloneKeybinds(),
        leftHandMode: Boolean(Dom.leftHandModeInput.checked),
        keyboardAttackAim: cloneKeyboardAttackAim(),
        gameSettings: cloneGameSettings(),
        preferences: cloneProfilePreferences()
      };
    }

    function normalizeControlProfile(profile, index = 0) {
      if (!profile || typeof profile !== "object") return null;
      const name = String(profile.name || "").trim().slice(0, 16);
      if (!name) return null;
      return {
        id: String(profile.id || `control-${Date.now().toString(36)}-${index}`).slice(0, 48),
        name,
        updatedAt: String(profile.updatedAt || new Date().toISOString()),
        config: {
          keybinds: cloneKeybinds(profile.config?.keybinds),
          leftHandMode: Boolean(profile.config?.leftHandMode),
          keyboardAttackAim: cloneKeyboardAttackAim(profile.config?.keyboardAttackAim),
          gameSettings: profile.config?.gameSettings ? cloneGameSettings(profile.config.gameSettings) : null,
          preferences: profile.config?.preferences ? cloneProfilePreferences(profile.config.preferences) : null
        }
      };
    }

    function loadControlProfiles() {
      const saved = GameStorage.getJson(controlProfilesKey, []);
      if (!Array.isArray(saved)) return [];
      return saved
        .map(normalizeControlProfile)
        .filter(Boolean)
        .slice(0, controlProfileLimit);
    }

    function saveControlProfiles() {
      GameStorage.setJson(controlProfilesKey, controlProfiles);
    }

    function saveSelectedControlProfileId() {
      if (selectedControlProfileId) GameStorage.set(selectedControlProfileKey, selectedControlProfileId);
      else GameStorage.remove(selectedControlProfileKey);
    }

    function selectedControlProfile() {
      return controlProfiles.find(profile => profile.id === selectedControlProfileId) || null;
    }

    function resolvedControlProfileId(preferredId = selectedControlProfileId, fallbackToFirst = false) {
      if (controlProfiles.some(profile => profile.id === preferredId)) return preferredId;
      return fallbackToFirst ? controlProfiles[0]?.id || "" : "";
    }

    function setControlProfileStatus(text = "", state = "") {
      Dom.controlProfileStatus.textContent = text;
      Dom.controlProfileStatus.hidden = !text;
      if (state) Dom.controlProfileStatus.dataset.state = state;
      else delete Dom.controlProfileStatus.dataset.state;
    }

    function renderControlProfiles(message = "", state = "") {
      const previousId = selectedControlProfileId;
      Dom.controlProfileSelect.innerHTML = "";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = controlProfiles.length ? "選擇配置" : "尚無配置";
      Dom.controlProfileSelect.append(empty);
      controlProfiles.forEach(profile => {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.name;
        Dom.controlProfileSelect.append(option);
      });
      selectedControlProfileId = resolvedControlProfileId(previousId);
      if (selectedControlProfileId !== previousId) saveSelectedControlProfileId();
      Dom.controlProfileSelect.value = selectedControlProfileId;
      const selected = selectedControlProfile();
      if (selected && !Dom.controlProfileNameInput.value.trim()) Dom.controlProfileNameInput.value = selected.name;
      Dom.controlProfileApplyButton.disabled = !selectedControlProfileId || GameRuntimeState.running;
      Dom.controlProfileDeleteButton.disabled = !selectedControlProfileId || GameRuntimeState.running;
      Dom.controlProfileSaveButton.disabled = GameRuntimeState.running;
      Dom.controlProfileNameInput.disabled = GameRuntimeState.running;
      Dom.controlProfileSelect.disabled = GameRuntimeState.running || !controlProfiles.length;
      setControlProfileStatus(message, state);
    }

    function uniqueControlProfileName() {
      let index = controlProfiles.length + 1;
      let name = `配置 ${index}`;
      while (controlProfiles.some(profile => profile.name === name)) {
        index += 1;
        name = `配置 ${index}`;
      }
      return name;
    }

    function applyProfileCharacterChoices(settings) {
      GameRuntimeState.playerCharacterChoice = normalizeCharacterChoice("player", settings.playerCharacterChoice);
      GameRuntimeState.computerCharacterChoice = normalizeCharacterChoice("computer", settings.computerCharacterChoice);
      if (GameUI.isRandomCharacterChoiceId(GameRuntimeState.playerCharacterChoice)) {
        GameUI.ensureStartLogoRandomCharacterId("player");
      } else {
        GameRuntimeState.playerCharacterId = GameUI.hasCharacterId(GameRuntimeState.playerCharacterChoice) ? GameRuntimeState.playerCharacterChoice : GameConfig.defaultSettings.playerCharacterId;
        GameUI.clearStartLogoRandomCharacterId("player");
      }
      if (GameUI.isRandomCharacterChoiceId(GameRuntimeState.computerCharacterChoice)) {
        GameUI.ensureStartLogoRandomCharacterId("computer");
      } else {
        GameRuntimeState.computerCharacterId = GameUI.hasCharacterId(GameRuntimeState.computerCharacterChoice) ? GameRuntimeState.computerCharacterChoice : GameConfig.defaultSettings.computerCharacterId;
        GameUI.clearStartLogoRandomCharacterId("computer");
      }
      syncCharacterInputs();
      saveCharacterChoices();
      GameUI.preloadPortraitsFor("player");
      GameUI.preloadPortraitsFor("computer");
      GameUI.buildCharacterStage();
    }

    function applyProfileGameSettings(settings) {
      if (!settings) return;
      const nextSettings = cloneGameSettings(settings);
      setComputerDifficulty(nextSettings.computerDifficulty);
      applyProfileCharacterChoices(nextSettings);
      setGmMode(nextSettings.gmMode);
      setGridSize(nextSettings.gridSize);
      setFoodCount(nextSettings.foodCount);
      setInitialSpeed(nextSettings.initialSpeed);
      setInitialLength(nextSettings.initialLength);
      setInitialEnergy(nextSettings.initialEnergy);
      setInitialBombs(nextSettings.initialBombs);
      GameConfig.foodTypes.forEach(type => setInitialStock(type.id, nextSettings.initialStock[type.id]));
      GameRuntimeState.gmPresetMode = normalizeGmPresetMode(nextSettings.gmPresetMode);
      updateGmPresetHighlight();
      saveGmSettings();
    }

    function applyProfilePreferences(preferences) {
      if (!preferences) return;
      const nextPreferences = cloneProfilePreferences(preferences);
      GameAudio.setMuted(nextPreferences.sfxMuted);
      setLowPowerPreference(nextPreferences.lowPowerMode);
      setPerfStatsVisible(nextPreferences.perfStatsVisible);
    }

    function saveCurrentControlProfile() {
      if (GameRuntimeState.running) return;
      const name = (Dom.controlProfileNameInput.value.trim() || selectedControlProfile()?.name || uniqueControlProfileName()).slice(0, 16);
      const now = new Date().toISOString();
      const existingIndex = controlProfiles.findIndex(profile => profile.id === selectedControlProfileId);
      const nextProfile = {
        id: existingIndex >= 0 ? controlProfiles[existingIndex].id : `control-${Date.now().toString(36)}`,
        name,
        updatedAt: now,
        config: controlProfileConfig()
      };
      if (existingIndex >= 0) controlProfiles[existingIndex] = nextProfile;
      else controlProfiles.unshift(nextProfile);
      controlProfiles = controlProfiles.slice(0, controlProfileLimit);
      selectedControlProfileId = nextProfile.id;
      Dom.controlProfileNameInput.value = name;
      saveControlProfiles();
      saveSelectedControlProfileId();
      renderControlProfiles("配置檔已儲存。", "success");
    }

    function applySelectedControlProfile() {
      if (GameRuntimeState.running) return;
      const profile = selectedControlProfile();
      if (!profile) return renderControlProfiles("請先選擇配置檔。", "error");
      GameRuntimeState.keybinds = cloneKeybinds(profile.config.keybinds);
      saveKeybinds();
      applyKeybinds();
      setLeftHandMode(profile.config.leftHandMode);
      GameRuntimeState.keyboardAttackAim = cloneKeyboardAttackAim(profile.config.keyboardAttackAim);
      updateTargetModeIndicator();
      const appliesGameSettings = Boolean(profile.config.gameSettings);
      applyProfileGameSettings(profile.config.gameSettings);
      applyProfilePreferences(profile.config.preferences);
      Dom.controlProfileNameInput.value = profile.name;
      saveSelectedControlProfileId();
      if (appliesGameSettings) {
        resetGame();
        resize();
        GameUI.renderIntroPortraits(true);
      }
      renderControlProfiles("配置檔已套用。", "success");
    }

    function deleteSelectedControlProfile() {
      if (GameRuntimeState.running) return;
      if (!selectedControlProfileId) return;
      controlProfiles = controlProfiles.filter(profile => profile.id !== selectedControlProfileId);
      selectedControlProfileId = resolvedControlProfileId("", true);
      saveControlProfiles();
      saveSelectedControlProfileId();
      Dom.controlProfileNameInput.value = "";
      renderControlProfiles("配置檔已刪除。", "success");
    }

    function loadSavedCharacterChoices() {
      const savedPlayer = GameStorage.get("hexSnakePlayerCharacterId");
      const savedComputer = GameStorage.get("hexSnakeComputerCharacterId");
      if (GameUI.isSelectableCharacterChoiceId(savedPlayer)) GameRuntimeState.playerCharacterChoice = savedPlayer;
      if (GameUI.isSelectableCharacterChoiceId(savedComputer)) GameRuntimeState.computerCharacterChoice = savedComputer;
      GameRuntimeState.playerCharacterId = GameUI.hasCharacterId(GameRuntimeState.playerCharacterChoice) ? GameRuntimeState.playerCharacterChoice : GameUI.characterFallbackId("player");
      GameRuntimeState.computerCharacterId = GameUI.hasCharacterId(GameRuntimeState.computerCharacterChoice) ? GameRuntimeState.computerCharacterChoice : GameUI.characterFallbackId("computer");
    }

    function saveCharacterChoices() {
      GameStorage.set("hexSnakePlayerCharacterId", GameRuntimeState.playerCharacterChoice);
      GameStorage.set("hexSnakeComputerCharacterId", GameRuntimeState.computerCharacterChoice);
    }

    function syncCharacterInputs() {
      Dom.playerCharacterInput.value = GameRuntimeState.playerCharacterChoice;
      Dom.computerCharacterInput.value = GameRuntimeState.computerCharacterChoice;
    }

    function resolveCharacterChoice(owner, choice) {
      const fallbackId = GameUI.characterFallbackId(owner);
      if (GameUI.isRandomCharacterChoiceId(choice)) return GameUI.consumeStartLogoRandomCharacterId(owner) || GameUI.randomCharacter().id;
      return GameUI.hasCharacterId(choice) ? choice : fallbackId;
    }

    function resolveCharacterChoicesForStart() {
      GameRuntimeState.playerCharacterChoice = GameUI.isSelectableCharacterChoiceId(Dom.playerCharacterInput.value)
        ? Dom.playerCharacterInput.value
        : GameConfig.defaultSettings.playerCharacterId;
      GameRuntimeState.computerCharacterChoice = GameUI.isSelectableCharacterChoiceId(Dom.computerCharacterInput.value)
        ? Dom.computerCharacterInput.value
        : GameConfig.defaultSettings.computerCharacterId;
      GameRuntimeState.playerCharacterId = resolveCharacterChoice("player", GameRuntimeState.playerCharacterChoice);
      GameRuntimeState.computerCharacterId = resolveCharacterChoice("computer", GameRuntimeState.computerCharacterChoice);
      syncCharacterInputs();
      saveCharacterChoices();
    }

    function applyKeybinds() {
      GameConfig.directions.forEach((direction, index) => {
        direction.key = GameRuntimeState.keybinds.directions[index];
      });
      GameRuntimeState.keyToDir = new Map(GameConfig.directions.map((direction, index) => [direction.key, index]));
      Dom.keyEls.forEach(el => {
        const direction = GameConfig.directions[Number(el.dataset.dir)];
        if (direction) el.textContent = keyLabel(direction.key);
      });
      Dom.hexDirButtons.forEach(button => {
        const direction = GameConfig.directions[Number(button.dataset.dir)];
        const label = button.querySelector("span") || button;
        if (direction) label.textContent = keyLabel(direction.key);
      });
      Dom.settingsDirButtons.forEach(button => {
        const direction = GameConfig.directions[Number(button.dataset.dir)];
        const label = button.querySelector("span") || button;
        if (direction) label.textContent = keyLabel(direction.key);
        button.classList.toggle("is-awaiting-key", Number(button.dataset.dir) === GameRuntimeState.pendingDirectionKeybind);
        button.setAttribute("aria-pressed", String(Number(button.dataset.dir) === GameRuntimeState.pendingDirectionKeybind));
      });
      document.querySelector("#smallAttackKey").value = keyLabel(GameRuntimeState.keybinds.smallAttack);
      document.querySelector("#bigAttackKey").value = keyLabel(GameRuntimeState.keybinds.bigAttack);
      document.querySelector("#pauseKey").value = keyLabel(GameRuntimeState.keybinds.pause);
      document.querySelector("#surrenderKey").value = keyLabel(GameRuntimeState.keybinds.surrender);
      document.querySelectorAll("[data-keybind-dir]").forEach(input => {
        input.value = keyLabel(GameRuntimeState.keybinds.directions[Number(input.dataset.keybindDir)]);
      });
    }

    function setPendingDirectionKeybind(direction) {
      GameRuntimeState.pendingDirectionKeybind = Number.isInteger(direction) && direction >= 0 && direction < GameConfig.directions.length ? direction : null;
      Dom.settingsDirHint.textContent = GameRuntimeState.pendingDirectionKeybind === null
        ? "點一個方向後按鍵盤設定快捷鍵"
        : `按鍵盤設定 ${GameConfig.directions[GameRuntimeState.pendingDirectionKeybind].label} 快捷鍵`;
      applyKeybinds();
    }

    function commitPendingDirectionKeybind(key) {
      if (GameRuntimeState.pendingDirectionKeybind === null) return false;
      GameRuntimeState.keybinds.directions[GameRuntimeState.pendingDirectionKeybind] = normalizeKey(key, GameRuntimeState.keybinds.directions[GameRuntimeState.pendingDirectionKeybind]);
      saveKeybinds();
      setPendingDirectionKeybind(null);
      return true;
    }

    function triggerTouchFeedback(event, strength = 8) {
      if (event?.pointerType === "mouse") return;
      GamePlatform.haptics.vibrate(strength);
    }

    function setAttackButtonHighlight(profile = null) {
      if (GameRuntimeState.attackHighlightReleaseTimer) {
        clearTimeout(GameRuntimeState.attackHighlightReleaseTimer);
        GameRuntimeState.attackHighlightReleaseTimer = null;
      }
      GameRuntimeState.highlightedAttackProfile = ["small", "big", "smallAim", "bigAim"].includes(profile) ? profile : null;
      updateAttackButtons();
    }

    function releaseAttackButtonHighlight(delayMs = 90) {
      if (GameRuntimeState.attackHighlightReleaseTimer) clearTimeout(GameRuntimeState.attackHighlightReleaseTimer);
      GameRuntimeState.attackHighlightReleaseTimer = setTimeout(() => {
        GameRuntimeState.attackHighlightReleaseTimer = null;
        GameRuntimeState.highlightedAttackProfile = null;
        updateAttackButtons();
      }, delayMs);
    }

    function flashAttackButton(profile, delayMs = 120) {
      setAttackButtonHighlight(profile);
      releaseAttackButtonHighlight(delayMs);
    }

    function updateAttackButtons() {
      Dom.smallAttackButton.classList.toggle("is-selected", GameRuntimeState.highlightedAttackProfile === "small");
      Dom.bigAttackButton.classList.toggle("is-selected", GameRuntimeState.highlightedAttackProfile === "big");
      Dom.keyboardSmallAimButton.classList.toggle("is-selected", GameRuntimeState.highlightedAttackProfile === "smallAim");
      Dom.keyboardBigAimButton.classList.toggle("is-selected", GameRuntimeState.highlightedAttackProfile === "bigAim");
      Dom.targetModeSmallIndicator.classList.toggle("is-active", GameRuntimeState.highlightedAttackProfile === "smallAim");
      Dom.targetModeBigIndicator.classList.toggle("is-active", GameRuntimeState.highlightedAttackProfile === "bigAim");
      Dom.smallAttackButton.classList.toggle("secondary", GameRuntimeState.highlightedAttackProfile !== "small");
      Dom.bigAttackButton.classList.toggle("secondary", GameRuntimeState.highlightedAttackProfile !== "big");
      updateTargetModeIndicator();
    }

    function selectAttackProfile(profile) {
      GameRuntimeState.selectedAttackProfile = profile === "big" ? "big" : "small";
      updateAttackButtons();
      const moveName = GameRuntimeState.selectedAttackProfile === "big" ? GameUI.characterFor("player").bigMove : GameUI.characterFor("player").smallMove;
      setStatus(`已選擇 ${moveName}。點棋盤即可攻擊。`);
    }

    function setLeftHandMode(enabled) {
      const active = Boolean(enabled);
      Dom.controlRow.classList.toggle("left-handed", active);
      Dom.leftHandModeInput.checked = active;
      GameStorage.set("hexSnakeLeftHandMode", active ? "1" : "0");
    }

    function syncLowPowerMode() {
      const active = GamePlatform.display.lowPowerMode();
      Dom.lowPowerModeInput.checked = active;
      document.body.classList.toggle("is-low-power", active);
      updatePerfOverlay();
      return active;
    }

    function setLowPowerPreference(enabled) {
      GamePlatform.display.setLowPowerMode(enabled);
      syncLowPowerMode();
      resize();
    }

    function setPerfStatsVisible(enabled) {
      GamePresentationState.perfStatsVisible = Boolean(enabled);
      Dom.perfStatsToggle.checked = GamePresentationState.perfStatsVisible;
      Dom.perfOverlay.hidden = !GamePresentationState.perfStatsVisible;
      GameStorage.set(GamePresentationState.perfStatsKey, GamePresentationState.perfStatsVisible ? "1" : "0");
      updatePerfOverlay();
    }

    function updatePerfOverlay(stats = GamePlatform.display.frameStats) {
      if (!Dom.perfOverlay) return;
      if (!GamePresentationState.perfStatsVisible) {
        Dom.perfOverlay.hidden = true;
        return;
      }
      Dom.perfOverlay.hidden = false;
      Dom.perfOverlay.classList.toggle("is-low-power", GamePlatform.display.lowPowerMode());
      const fps = Number.isFinite(stats.fps) ? Math.round(stats.fps) : 0;
      const frameMs = Number.isFinite(stats.frameMs) ? stats.frameMs.toFixed(1) : "0.0";
      Dom.perfFps.textContent = `${fps} FPS`;
      Dom.perfFrameMs.textContent = `${frameMs} ms`;
    }

    function clampGridSize(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return GameRuntimeState.gridSize;
      return Math.min(GameConfig.maxGridSize, Math.max(GameConfig.minGridSize, parsed));
    }

    function clampFoodCount(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return GameRuntimeState.foodCount;
      return Math.min(GameConfig.maxFoodCount, Math.max(GameConfig.minFoodCount, parsed));
    }

    function clampInitialSpeed(value) {
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed)) return GameRuntimeState.initialSpeed;
      return Math.min(GameConfig.maxInitialSpeed, Math.max(GameConfig.minInitialSpeed, parsed));
    }

    function clampInitialLength(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return GameRuntimeState.initialLength;
      return Math.min(GameConfig.maxInitialLength, Math.max(GameConfig.minInitialLength, parsed));
    }

    function clampInitialStock(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return 0;
      return Math.min(GameConfig.maxFoodStock, Math.max(0, parsed));
    }

    function clampInitialEnergy(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return 0;
      return Math.min(GameConfig.attackNeedTotal, Math.max(0, parsed));
    }

    function clampInitialBombs(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return 0;
      return Math.min(GameConfig.maxAmmo, Math.max(0, parsed));
    }

    function buildCells() {
      const nextCells = [];
      for (let q = -GameRuntimeState.radius; q <= GameRuntimeState.radius; q += 1) {
        const r1 = Math.max(-GameRuntimeState.radius, -q - GameRuntimeState.radius);
        const r2 = Math.min(GameRuntimeState.radius, -q + GameRuntimeState.radius);
        for (let r = r1; r <= r2; r += 1) {
          nextCells.push({ q, r });
        }
      }
      GameRuntimeState.cells = nextCells;
    }

    function setGridSize(value) {
      GameRuntimeState.gridSize = clampGridSize(value);
      GameRuntimeState.radius = GameRuntimeState.gridSize - 1;
      Dom.gridSizeInput.value = GameRuntimeState.gridSize;
      buildCells();
    }

    function setFoodCount(value) {
      GameRuntimeState.foodCount = clampFoodCount(value);
      Dom.foodCountInput.value = GameRuntimeState.foodCount;
    }

    function setComputerDifficulty(value) {
      GameRuntimeState.computerDifficulty = ["novice", "low", "medium", "high", "extreme"].includes(value) ? value : "medium";
      Dom.computerDifficultyInput.value = GameRuntimeState.computerDifficulty;
    }

    function setInitialSpeed(value) {
      GameRuntimeState.initialSpeed = clampInitialSpeed(value);
      Dom.initialSpeedInput.value = GameRuntimeState.initialSpeed;
    }

    function setInitialLength(value) {
      GameRuntimeState.initialLength = clampInitialLength(value);
      Dom.initialLengthInput.value = GameRuntimeState.initialLength;
    }

    function setInitialEnergy(value) {
      GameRuntimeState.initialEnergy = clampInitialEnergy(value);
      Dom.initialEnergyInput.value = GameRuntimeState.initialEnergy;
    }

    function setInitialBombs(value) {
      GameRuntimeState.initialBombs = clampInitialBombs(value);
      Dom.initialBombsInput.value = GameRuntimeState.initialBombs;
    }

    function setInitialStock(typeId, value) {
      if (!Object.prototype.hasOwnProperty.call(GameRuntimeState.initialStock, typeId)) return;
      GameRuntimeState.initialStock[typeId] = clampInitialStock(value);
      const input = Dom.initialStockInputs.find(stockInput => stockInput.dataset.initialStock === typeId);
      if (input) input.value = GameRuntimeState.initialStock[typeId];
    }

    function updateGmPresetHighlight() {
      Object.entries(Dom.gmPresetButtons).forEach(([mode, button]) => {
        const selected = GameRuntimeState.gmPresetMode === mode;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    }

    function saveGmSettings() {
      GameStorage.setJson("hexSnakeGmSettings", {
        gridSize: GameRuntimeState.gridSize,
        foodCount: GameRuntimeState.foodCount,
        computerDifficulty: GameRuntimeState.computerDifficulty,
        initialSpeed: GameRuntimeState.initialSpeed,
        gmMode: GameRuntimeState.gmMode,
        initialLength: GameRuntimeState.initialLength,
        initialEnergy: GameRuntimeState.initialEnergy,
        initialBombs: GameRuntimeState.initialBombs,
        initialStock: GameRuntimeState.initialStock,
        gmPresetMode: GameRuntimeState.gmPresetMode
      });
    }

    function applyGmSettingsChanged(options = {}) {
      GameRuntimeState.gmPresetMode = options.presetMode ?? null;
      updateGmPresetHighlight();
      saveGmSettings();
    }

    function loadSavedGmSettings() {
      try {
        const saved = GameStorage.getJson("hexSnakeGmSettings", null);
        if (!saved || typeof saved !== "object") {
          updateGmPresetHighlight();
          return;
        }
        setGridSize(saved.gridSize ?? GameConfig.defaultSettings.gridSize);
        setFoodCount(saved.foodCount ?? GameConfig.defaultSettings.foodCount);
        setComputerDifficulty(saved.computerDifficulty ?? GameConfig.defaultSettings.computerDifficulty);
        setInitialSpeed(saved.initialSpeed ?? GameConfig.defaultSettings.initialSpeed);
        setGmMode(saved.gmMode ?? GameConfig.defaultSettings.gmMode);
        setInitialLength(saved.initialLength ?? GameConfig.defaultSettings.initialLength);
        setInitialEnergy(saved.initialEnergy ?? GameConfig.defaultSettings.initialEnergy);
        setInitialBombs(saved.initialBombs ?? GameConfig.defaultSettings.initialBombs);
        GameConfig.foodTypes.forEach(type => setInitialStock(type.id, saved.initialStock?.[type.id] ?? GameConfig.defaultSettings.initialStock[type.id]));
        GameRuntimeState.gmPresetMode = Object.prototype.hasOwnProperty.call(Dom.gmPresetButtons, saved.gmPresetMode) ? saved.gmPresetMode : null;
        updateGmPresetHighlight();
      } catch {
        GameRuntimeState.gmPresetMode = "real";
        updateGmPresetHighlight();
      }
    }

    function setGmMode(active) {
      GameRuntimeState.gmMode = Boolean(active);
      Dom.settingsToggle.classList.toggle("is-gm-active", GameRuntimeState.gmMode);
      updateSettingsActionMode();
      updateGmControlState();
    }

    function updateGmControlState() {
      const disabled = GameRuntimeState.running;
      Dom.initialLengthInput.disabled = disabled;
      Dom.initialEnergyInput.disabled = disabled;
      Dom.initialBombsInput.disabled = disabled;
      Dom.initialStockInputs.forEach(input => {
        input.disabled = disabled;
      });
    }

    function resetGmParameters() {
      setGridSize(GameConfig.defaultSettings.gridSize);
      setFoodCount(GameConfig.defaultSettings.foodCount);
      setInitialSpeed(GameConfig.defaultSettings.initialSpeed);
      setInitialLength(GameConfig.defaultSettings.initialLength);
      setInitialEnergy(GameConfig.defaultSettings.initialEnergy);
      setInitialBombs(GameConfig.defaultSettings.initialBombs);
      GameConfig.foodTypes.forEach(type => setInitialStock(type.id, GameConfig.defaultSettings.initialStock[type.id]));
    }

    function refreshGmPreview() {
      resetGame();
      resize();
      if (Dom.overlay.classList.contains("show")) {
        GameUI.renderIntroPortraits(false);
      }
    }

    function applyUltimateModePreset() {
      setGmMode(true);
      const presetStock = 4;
      setInitialBombs(GameConfig.maxAmmo);
      setInitialEnergy(GameConfig.attackNeedTotal);
      setInitialLength(presetStock);
      GameConfig.foodTypes.forEach(type => setInitialStock(type.id, presetStock));
    }

    function applyMidGameModePreset() {
      setGmMode(true);
      const presetStock = Math.floor(GameConfig.maxFoodStock / 2);
      setInitialBombs(GameConfig.maxAmmo);
      setInitialEnergy(GameConfig.attackNeedTotal);
      setInitialLength(presetStock);
      GameConfig.foodTypes.forEach(type => setInitialStock(type.id, presetStock));
    }

    function applyLateGameModePreset() {
      setGmMode(true);
      const presetStock = GameConfig.maxFoodStock;
      setInitialBombs(GameConfig.maxAmmo);
      setInitialEnergy(GameConfig.attackNeedTotal);
      setInitialLength(presetStock);
      GameConfig.foodTypes.forEach(type => setInitialStock(type.id, presetStock));
    }

    function setGmSettingsLocked(locked) {
      Dom.gridSizeInput.disabled = locked;
      Dom.foodCountInput.disabled = locked;
      Dom.initialSpeedInput.disabled = locked;
      Dom.initialLengthInput.disabled = locked;
      Dom.initialEnergyInput.disabled = locked;
      Dom.initialBombsInput.disabled = locked;
      Dom.initialStockInputs.forEach(input => {
        input.disabled = locked;
      });
      Dom.networkToggle.disabled = locked;
      Dom.realModeButton.disabled = locked;
      Dom.midGameModeButton.disabled = locked;
      Dom.ultimateModeButton.disabled = locked;
      Dom.lateGameModeButton.disabled = locked;
    }

    function updateSettingsActionMode() {
      const showSurrender = GameRuntimeState.running && !GameRuntimeState.gameOver && !GameReplay.isPlaybackMode();
      if (showSurrender) {
        setSettingsOpen(false);
        setGmOpen(false);
        setNetworkOpen(false);
      }
      Dom.settingsToggle.hidden = showSurrender;
      Dom.surrenderButton.hidden = !showSurrender;
      Dom.surrenderButton.disabled = !showSurrender;
      Dom.networkToggle.classList.toggle("is-auto", showSurrender);
      Dom.networkToggle.classList.toggle("is-active", showSurrender ? isPlayerAutoControlActive() : !Dom.networkContent.hidden);
      Dom.gmLetter.textContent = showSurrender ? "Auto" : "LAN";
      Dom.networkToggle.title = showSurrender ? "Auto 操作" : "LAN / Wi-Fi";
      Dom.networkToggle.setAttribute("aria-label", showSurrender ? "Auto 操作" : "LAN / Wi-Fi");
      Dom.networkToggle.setAttribute("aria-expanded", showSurrender ? "false" : Dom.networkToggle.getAttribute("aria-expanded"));
      Dom.networkToggle.disabled = showSurrender ? false : Dom.networkToggle.disabled;
    }

    function setSettingsLocked(locked) {
      if (locked) {
        setSettingsOpen(false);
        setGmOpen(false);
        setNetworkOpen(false);
      }
      Dom.settingsToggle.disabled = locked;
      Dom.settingsReplayButton.disabled = locked;
      Dom.statsButton.disabled = locked;
      Dom.versionInfoButton.disabled = locked;
      Dom.controlProfileNameInput.disabled = locked;
      Dom.controlProfileSelect.disabled = locked || !controlProfiles.length;
      Dom.controlProfileSaveButton.disabled = locked;
      Dom.controlProfileApplyButton.disabled = locked || !selectedControlProfileId;
      Dom.controlProfileDeleteButton.disabled = locked || !selectedControlProfileId;
      Dom.computerDifficultyInput.disabled = locked;
      Dom.playerCharacterInput.disabled = locked;
      Dom.computerCharacterInput.disabled = locked;
      setGmSettingsLocked(locked);
      updateSettingsActionMode();
    }

    function keyOf(cell) {
      return `${cell.q},${cell.r}`;
    }

    function stableVariantIndex(cell, salt = 0, count = 1) {
      const q = Math.imul(cell.q + 97, 73856093);
      const r = Math.imul(cell.r - 53, 19349663);
      const mixed = (q ^ r ^ Math.imul(salt + 31, 83492791)) >>> 0;
      return mixed % Math.max(1, count);
    }

    function isInside(cell) {
      const s = -cell.q - cell.r;
      return Math.max(Math.abs(cell.q), Math.abs(cell.r), Math.abs(s)) <= GameRuntimeState.radius;
    }

    function axialToPixel(cell) {
      return {
        x: GameRuntimeState.center.x + GameRuntimeState.cellSize * Math.sqrt(3) * (cell.q + cell.r / 2),
        y: GameRuntimeState.center.y + GameRuntimeState.cellSize * 1.5 * cell.r
      };
    }

    function pixelToAxial(x, y) {
      const px = x - GameRuntimeState.center.x;
      const py = y - GameRuntimeState.center.y;
      const q = (Math.sqrt(3) / 3 * px - 1 / 3 * py) / GameRuntimeState.cellSize;
      const r = (2 / 3 * py) / GameRuntimeState.cellSize;
      return roundAxial(q, r);
    }

    function roundAxial(q, r) {
      let x = q;
      let z = r;
      let y = -x - z;
      let rx = Math.round(x);
      let ry = Math.round(y);
      let rz = Math.round(z);
      const xDiff = Math.abs(rx - x);
      const yDiff = Math.abs(ry - y);
      const zDiff = Math.abs(rz - z);
      if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
      else if (yDiff > zDiff) ry = -rx - rz;
      else rz = -rx - ry;
      return { q: rx, r: rz };
    }

    function nearestInsideCell(cell) {
      if (isInside(cell)) return cell;
      return GameRuntimeState.cells.reduce((bestCell, candidate) => {
        return hexDistance(candidate, cell) < hexDistance(bestCell, cell) ? candidate : bestCell;
      }, GameRuntimeState.cells[0]);
    }

    function hexPath(x, y, size) {
      Dom.ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.PI / 180 * (60 * i - 30);
        const px = x + size * Math.cos(angle);
        const py = y + size * Math.sin(angle);
        if (i === 0) Dom.ctx.moveTo(px, py);
        else Dom.ctx.lineTo(px, py);
      }
      Dom.ctx.closePath();
    }

    function resize() {
      const rect = Dom.playArea.getBoundingClientRect();
      const dpr = GamePlatform.display.devicePixelRatio();
      Dom.canvas.width = Math.floor(rect.width * dpr);
      Dom.canvas.height = Math.floor(rect.height * dpr);
      Dom.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      GameRuntimeState.center = { x: rect.width / 2, y: rect.height / 2 };
      const boardWidth = Math.sqrt(3) * (GameRuntimeState.radius * 2 + 1);
      const boardHeight = GameRuntimeState.radius * 3 + 2;
      GameRuntimeState.cellSize = Math.min(rect.width / (boardWidth + 0.8), rect.height / (boardHeight + 0.8));
      GameRender.draw();
    }

    function createStartingSnake(head, direction, length) {
      const segments = [{ ...head }];
      let cursor = { ...head };
      const bodyDirection = (direction + 3) % 6;
      const used = new Set([keyOf(cursor)]);
      while (segments.length < length) {
        const next = nextWrappedCell(cursor, bodyDirection);
        const nextKey = keyOf(next);
        if (used.has(nextKey)) break;
        segments.push(next);
        used.add(nextKey);
        cursor = next;
      }
      return segments;
    }

    function resetGame() {
      clearGameOverSettlementTimer();
      GameUI.renderWinnerPortrait(null);
      Object.values(GameRuntimeState.portraitPoseTimers).forEach(clearTimeout);
      GameRuntimeState.portraitPoseTimers = {};
      Object.values(GameRuntimeState.attackCalloutTimers).forEach(clearTimeout);
      GameRuntimeState.attackCalloutTimers = {};
      GameUI.clearFighterCallouts();
      GameUI.preloadPortraitsFor("player");
      GameUI.preloadPortraitsFor("computer");
      GameUI.buildCharacterStage();
      const offset = Math.min(2, Math.max(1, GameRuntimeState.radius - 3));
      GameRuntimeState.dir = 0;
      GameRuntimeState.nextDir = 0;
      GameRuntimeState.computerDir = 3;
      const startLength = GameRuntimeState.gmMode ? GameRuntimeState.initialLength : GameConfig.defaultSettings.initialLength;
      GameRuntimeState.snake = createStartingSnake({ q: -offset, r: offset }, GameRuntimeState.dir, startLength);
      GameRuntimeState.computerSnake = createStartingSnake({ q: offset, r: -offset }, GameRuntimeState.computerDir, startLength);
      GameRuntimeState.score = 0;
      GameRuntimeState.computerScore = 0;
      GameRuntimeState.playerHp = GameUI.maxHpForSnake(GameRuntimeState.snake);
      GameRuntimeState.computerHp = GameUI.maxHpForSnake(GameRuntimeState.computerSnake);
      GameRuntimeState.playerStock = GameUI.startingStock();
      GameRuntimeState.computerStock = GameUI.startingStock();
      GameRuntimeState.playerAmmo = GameUI.startingBombs();
      GameRuntimeState.computerAmmo = GameUI.startingBombs();
      GameRuntimeState.playerAmmoCharge = GameUI.startingEnergy();
      GameRuntimeState.computerAmmoCharge = GameUI.startingEnergy();
      GameRuntimeState.playerEnergyFlashUntil = 0;
      GameRuntimeState.computerEnergyFlashUntil = 0;
      GameRuntimeState.playerBombFlashUntil = 0;
      GameRuntimeState.computerBombFlashUntil = 0;
      GameRuntimeState.foods = [];
      GameRuntimeState.projectiles = [];
      GameRuntimeState.blasts = [];
      GameRuntimeState.hazards = [];
      GameRuntimeState.boardShakeUntil = 0;
      GameRuntimeState.boardShakeStartedAt = 0;
      GameRuntimeState.boardShakeStrength = 0;
      GameRuntimeState.keyboardAttackAim.small = { targetModeIndex: 0, direction: GameRuntimeState.dir };
      GameRuntimeState.keyboardAttackAim.big = { targetModeIndex: 0, direction: GameRuntimeState.dir };
      GameRuntimeState.keyboardAttackPreview = null;
      GameRuntimeState.keyboardAimHeldKeys.clear();
      if (GameRuntimeState.keyboardAttackPreviewTimer) {
        clearTimeout(GameRuntimeState.keyboardAttackPreviewTimer);
        GameRuntimeState.keyboardAttackPreviewTimer = null;
      }
      updateTargetModeIndicator();
      GameRuntimeState.targetCell = { ...GameRuntimeState.snake[0] };
      GameRuntimeState.targetActive = false;
      GameRuntimeState.totalElapsedMs = 0;
      GameRuntimeState.lastFeedElapsedMs = 0;
      GameRuntimeState.lastTimerFrame = 0;
      GameRuntimeState.lastHudFrameAt = -Infinity;
      GamePresentationState.lastReplayRecordCheckAt = -Infinity;
      GameRuntimeState.lastPlayerStep = 0;
      GameRuntimeState.lastComputerStep = 0;
      GameRuntimeState.playerStunUntil = 0;
      GameRuntimeState.playerSlowUntil = 0;
      GameRuntimeState.playerCollisionParalysisMs = 0;
      GameRuntimeState.playerVulnerable = false;
      GameRuntimeState.computerStunUntil = 0;
      GameRuntimeState.computerSlowUntil = 0;
      GameRuntimeState.computerCollisionParalysisMs = 0;
      GameRuntimeState.computerVulnerable = false;
      GameRuntimeState.playerUndergroundFrom = 0;
      GameRuntimeState.playerUndergroundUntil = 0;
      GameRuntimeState.computerUndergroundFrom = 0;
      GameRuntimeState.computerUndergroundUntil = 0;
      GameRuntimeState.playerSandwormArmorFrom = 0;
      GameRuntimeState.playerSandwormArmorUntil = 0;
      GameRuntimeState.computerSandwormArmorFrom = 0;
      GameRuntimeState.computerSandwormArmorUntil = 0;
      GameRuntimeState.lastVisiblePlayerSnake = GameRuntimeState.snake.map(segment => ({ ...segment }));
      GameRuntimeState.lastVisibleComputerSnake = GameRuntimeState.computerSnake.map(segment => ({ ...segment }));
      GameRuntimeState.lastVisiblePlayerDir = GameRuntimeState.dir;
      GameRuntimeState.lastVisibleComputerDir = GameRuntimeState.computerDir;
      GameRuntimeState.playerFoodTargetKey = null;
      GameRuntimeState.computerFoodTargetKey = null;
      GameRuntimeState.playerFoodTargetAt = 0;
      GameRuntimeState.computerFoodTargetAt = 0;
      GameRuntimeState.lastPlayerFoodAt = 0;
      GameRuntimeState.lastComputerFoodAt = 0;
      GameRuntimeState.lastPlayerAttackMs = GameUI.resetAttackCooldownTracker();
      GameRuntimeState.lastComputerAttackMs = GameUI.resetAttackCooldownTracker();
      GameReplay.resetSurrendered();
      GameRuntimeState.gameOver = false;
      GameUI.setLastResultShareData(null);
      GameRuntimeState.paused = false;
      placeFoods();
      updateHud();
      setStatus("準備就緒。右搖桿移動，左搖桿瞄準攻擊。");
    }

    function canRestartAfterGameOver() {
      return !GameRuntimeState.gameOverSettlementPending && performance.now() >= GameRuntimeState.restartUnlockAt;
    }

    function resultCopyText(data) {
      return [data?.text, data?.url].filter(Boolean).join("\n");
    }

    function currentModeLabel(endedInAutoMode = false) {
      if (GameRuntimeState.relayMode) return "接力賽";
      if (GameRuntimeState.computerBattleMode) return "自動對弈";
      if (endedInAutoMode) return "Auto 操作";
      return "玩家操作";
    }

    function currentDifficultyLabel() {
      return Dom.computerDifficultyInput.selectedOptions[0]?.textContent?.trim() || GameRuntimeState.computerDifficulty;
    }

    function buildResultShareData({ winnerOwner, plainResultText, scoreText, resultReason, endedInAutoMode }) {
      const playerCharacter = GameUI.characterFor("player");
      const computerCharacter = GameUI.characterFor("computer");
      const url = window.location.href.split("#")[0];
      const lines = [
        "Hex Snake 對戰結果",
        plainResultText,
        scoreText,
        `角色：P1 ${playerCharacter?.name || "隨機選擇"} vs P2 ${computerCharacter?.name || "隨機選擇"}`,
        `時間：${GameUI.formatTime(GameRuntimeState.totalElapsedMs)}`,
        `模式：${currentModeLabel(endedInAutoMode)}`,
        `難度：${currentDifficultyLabel()}`,
        resultReason,
        winnerOwner ? `勝者：${winnerOwner === "player" ? "P1" : "P2"}` : "勝者：平手"
      ];
      return {
        title: "Hex Snake 對戰結果",
        text: lines.join("\n"),
        url
      };
    }

    async function copyCurrentResult() {
      if (!GamePresentationState.lastResultShareData || GamePresentationState.resultShareInProgress) return;
      GamePresentationState.resultShareInProgress = true;
      GameUI.updateResultSharePanel();
      GameUI.setResultShareStatus("正在複製結果...");
      try {
        if (await GamePlatform.share.copyText(resultCopyText(GamePresentationState.lastResultShareData))) {
          GameUI.setResultShareStatus("結果已複製。", "success");
          return;
        }
        GameUI.setResultShareStatus("此瀏覽器無法複製結果。", "error");
      } catch (error) {
        console.warn("Unable to copy result.", error);
        GameUI.setResultShareStatus("複製失敗，請稍後再試。", "error");
      } finally {
        GamePresentationState.resultShareInProgress = false;
        GameUI.updateResultSharePanel();
      }
    }

    function beginStartLogoCountdown() {
      if (isNetworkGuestActive()) {
        setStatus("LAN guest is waiting for Host to start.");
        return false;
      }
      if (GameReplay.isPlaybackMode() || GameRuntimeState.running || GamePresentationState.startLogoCountdownPending || GameUI.isLogoTransitionActive()) return false;
      if (GameRuntimeState.gameOver) {
        if (!canRestartAfterGameOver()) return false;
        returnToStartScreen();
      }
      GameUI.showCharacterStage({ startLogoCharacters: true, "overlay": true });
      GamePresentationState.startLogoCountdownPending = true;
      setSettingsLocked(true);
      setStatus("開局倒數中：3 秒後開始。");
      GameUI.playStartLogoCountdown().then(ready => {
        GamePresentationState.startLogoCountdownPending = false;
        if (!ready || GameRuntimeState.running || GameRuntimeState.gameOver || GameReplay.isPlaybackMode()) {
          if (!GameRuntimeState.running && !GameRuntimeState.gameOver) setSettingsLocked(false);
          return;
        }
        startGame();
      });
      return true;
    }

    function skipLogoTransition() {
      if (GameUI.logoTransitionDirection() !== "in" || GameRuntimeState.gameOverLogoTransitionEndsAt <= 0) return false;
      GameRuntimeState.gameOverLogoTransitionEndsAt = 0;
      showGameOverSettlement();
      return true;
    }

    function startGame(options = {}) {
      if (isNetworkGuestActive()) {
        setStatus("LAN guest cannot start the host simulation.");
        return false;
      }
      if (GameReplay.isPlaybackMode()) return false;
      if (GameRuntimeState.gameOver && !canRestartAfterGameOver()) return false;
      clearGameOverSettlementTimer();
      clearRelayRestartTimer();
      GameRuntimeState.computerBattleMode = Boolean(options.computerBattle);
      GameRuntimeState.playerAutoMode = Boolean(options.playerAuto) && !GameRuntimeState.computerBattleMode;
      GameRuntimeState.computerBattleManualOverride = false;
      if (GameRuntimeState.computerBattleMode || GameRuntimeState.playerAutoMode) setRelayMode(GameRuntimeState.relayModePreference, Boolean(options.resetRelayScore), false);
      if (!GameRuntimeState.computerBattleMode && !GameRuntimeState.playerAutoMode) setRelayMode(false, false, false);
      if (GameRuntimeState.computerBattleMode || GameRuntimeState.playerAutoMode) setComputerBattleSpeed(GameStorage.get("hexSnakeAutoBattleSpeed"), false);
      setFoodCount(Dom.foodCountInput.value);
      setComputerDifficulty(Dom.computerDifficultyInput.value);
      setInitialSpeed(Dom.initialSpeedInput.value);
      setGmMode(GameRuntimeState.gmMode);
      setInitialLength(Dom.initialLengthInput.value);
      setInitialEnergy(Dom.initialEnergyInput.value);
      setInitialBombs(Dom.initialBombsInput.value);
      Dom.initialStockInputs.forEach(input => setInitialStock(input.dataset.initialStock, input.value));
      saveGmSettings();
      resolveCharacterChoicesForStart();
      resetGame();
      GameAudio.warmup([GameUI.characterFor("player"), GameUI.characterFor("computer")]);
      GameAudio.playCharacter("player", "start", { unlock: true });
      GameAudio.playCharacter("computer", "start", { delay: 0.08, gainScale: 0.75 });
      GameRuntimeState.running = true;
      setSettingsLocked(true);
      setStatus("對戰中：吃食物累積能量，集滿可獲得炸彈。");
      Dom.overlay.classList.remove("show");
      GameUI.showCharacterStage({ rebuild: false, "overlay": false });
      updateAutoBattleControls();
      GameRuntimeState.lastPlayerStep = performance.now();
      GameRuntimeState.lastComputerStep = GameRuntimeState.lastPlayerStep;
      GameRuntimeState.lastTimerFrame = GameRuntimeState.lastPlayerStep;
      GameReplay.startRecording();
      broadcastNetworkStart(GameRuntimeState.lastPlayerStep);
      cancelAnimationFrame(GameRuntimeState.rafId);
      GameRuntimeState.rafId = requestAnimationFrame(loop);
      return true;
    }

    function autoStartGame() {
      if (GameRuntimeState.running && !GameRuntimeState.gameOver) return true;
      if (GameRuntimeState.gameOver) return false;
      beginStartLogoCountdown();
      return false;
    }

    function returnToStartScreen() {
      clearGameOverSettlementTimer();
      clearRelayRestartTimer();
      GameRuntimeState.computerBattleMode = false;
      GameRuntimeState.playerAutoMode = false;
      GameRuntimeState.computerBattleManualOverride = false;
      setRelayMode(false, false, false);
      updateSettingsActionMode();
      updateAutoBattleControls();
      resetGame();
      Dom.overlayTitle.textContent = "準備開局";
      Dom.overlayText.textContent = "重新選擇角色後按開始。";
      Dom.startButton.textContent = "開始";
      Dom.computerBattleButton.hidden = false;
      Dom.replayArchiveButton.hidden = false;
      GameUI.renderIntroPortraits(false);
      Dom.overlay.classList.add("show");
    }

    function openGameOverCharacterSelect(owner) {
      if (!GameRuntimeState.gameOver) return;
      const nextOwner = owner === "computer" ? "computer" : "player";
      returnToStartScreen();
      GamePresentationState.selectedPortraitOwner = nextOwner;
      Dom.overlayTitle.textContent = "角色選擇";
      Dom.overlayText.textContent = "選好角色後關閉選擇畫面，會回到開始畫面。";
      GameUI.renderIntroPortraits(true);
      Dom.overlay.classList.add("show");
    }

    function randomFoodType(preferredFoodId = null) {
      if (!preferredFoodId || preferredFoodId === "balanced") {
        return GameConfig.foodTypes[Math.floor(Math.random() * GameConfig.foodTypes.length)];
      }
      let roll = Math.random();
      for (const type of GameConfig.foodTypes) {
        const weight = type.id === preferredFoodId ? GameConfig.preferredFoodWeight : GameConfig.otherFoodWeight;
        if (roll < weight) return type;
        roll -= weight;
      }
      return GameConfig.foodTypes[GameConfig.foodTypes.length - 1];
    }

    function randomFoodTypeIds(preferredFoodId = null, dualColor = false) {
      const firstType = randomFoodType(preferredFoodId);
      if (!dualColor) return [firstType.id];
      const secondOptions = GameConfig.foodTypes.filter(type => type.id !== firstType.id);
      const secondType = secondOptions[Math.floor(Math.random() * secondOptions.length)];
      return [firstType.id, secondType.id];
    }

    function randomFoodTypeIdsForCharacter(character) {
      if (character?.specialFood === "black" && Math.random() < GameConfig.blackSpecialChance) {
        return ["black"];
      }
      if (character?.specialFood === "black") {
        return randomFoodTypeIds(null, false);
      }
      const preferredFoodId = character ? character.food : null;
      const dualColor = character?.food === "balanced" && Math.random() < GameConfig.balancedDualChance;
      return randomFoodTypeIds(preferredFoodId, dualColor);
    }

    function placeFoods(preferredOwners = []) {
      const occupied = new Set([
        ...GameRuntimeState.snake.map(keyOf),
        ...GameRuntimeState.computerSnake.map(keyOf),
        ...GameRuntimeState.foods.map(keyOf)
      ]);
      let generated = 0;
      while (GameRuntimeState.foods.length < GameRuntimeState.foodCount) {
        const openCells = GameRuntimeState.cells.filter(cell => !occupied.has(keyOf(cell)));
        if (!openCells.length) return;
        const cell = openCells[Math.floor(Math.random() * openCells.length)];
        const owner = preferredOwners[generated];
        const character = owner ? GameUI.characterFor(owner) : null;
        GameRuntimeState.foods.push({ q: cell.q, r: cell.r, types: randomFoodTypeIdsForCharacter(character) });
        occupied.add(keyOf(cell));
        generated += 1;
      }
    }

    function updateStockHud(owner, stock, ammo, ammoCharge) {
      const totalEl = GameRuntimeState.resourceEls.get(owner);
      if (totalEl) {
        const now = performance.now();
        const energyFlashing = now < (owner === "player" ? GameRuntimeState.playerEnergyFlashUntil : GameRuntimeState.computerEnergyFlashUntil);
        const bombFlashing = now < (owner === "player" ? GameRuntimeState.playerBombFlashUntil : GameRuntimeState.computerBombFlashUntil);
        const energyRatio = Math.max(0, Math.min(1, ammoCharge / Math.max(1, GameConfig.attackNeedTotal)));
        const bombRatio = Math.max(0, Math.min(1, ammo / Math.max(1, GameConfig.maxAmmo)));
        totalEl.innerHTML = `
          <span class="resource-chip${energyFlashing ? " is-flashing" : ""}" title="能量">
            <span class="resource-icon energy-icon" aria-hidden="true"></span>
            <span class="resource-chip-track" role="meter" aria-label="能量" aria-valuemin="0" aria-valuenow="${ammoCharge}" aria-valuemax="${GameConfig.attackNeedTotal}" aria-valuetext="${ammoCharge}/${GameConfig.attackNeedTotal}">
              <span class="resource-chip-fill" style="--resource-ratio: ${energyRatio.toFixed(4)}"></span>
            </span>
            <span class="resource-chip-value">${ammoCharge}/${GameConfig.attackNeedTotal}</span>
          </span>
          <span class="resource-chip${bombFlashing ? " is-flashing" : ""}" title="炸彈">
            <span class="resource-icon missile-icon" aria-hidden="true"></span>
            <span class="resource-chip-track" role="meter" aria-label="炸彈" aria-valuemin="0" aria-valuenow="${ammo}" aria-valuemax="${GameConfig.maxAmmo}" aria-valuetext="${ammo}/${GameConfig.maxAmmo}">
              <span class="resource-chip-fill" style="--resource-ratio: ${bombRatio.toFixed(4)}"></span>
            </span>
            <span class="resource-chip-value">${ammo}/${GameConfig.maxAmmo}</span>
          </span>
        `;
      }
      const now = performance.now();
      const energyFlashing = now < (owner === "player" ? GameRuntimeState.playerEnergyFlashUntil : GameRuntimeState.computerEnergyFlashUntil);
      const bombFlashing = now < (owner === "player" ? GameRuntimeState.playerBombFlashUntil : GameRuntimeState.computerBombFlashUntil);
      const energyRatio = Math.max(0, Math.min(1, ammoCharge / Math.max(1, GameConfig.attackNeedTotal)));
      const bombRatio = Math.max(0, Math.min(1, ammo / Math.max(1, GameConfig.maxAmmo)));
      const energyChip = GameRuntimeState.resourceEls.get(`${owner}-energyChip`);
      const energyTrack = GameRuntimeState.resourceEls.get(`${owner}-energyTrack`);
      const energyFill = GameRuntimeState.resourceEls.get(`${owner}-energyFill`);
      const energyValue = GameRuntimeState.resourceEls.get(`${owner}-energyValue`);
      const bombChip = GameRuntimeState.resourceEls.get(`${owner}-bombChip`);
      const bombTrack = GameRuntimeState.resourceEls.get(`${owner}-bombTrack`);
      const bombFill = GameRuntimeState.resourceEls.get(`${owner}-bombFill`);
      const bombValue = GameRuntimeState.resourceEls.get(`${owner}-bombValue`);
      energyChip?.classList.toggle("is-flashing", energyFlashing);
      bombChip?.classList.toggle("is-flashing", bombFlashing);
      if (energyTrack) {
        energyTrack.setAttribute("aria-valuenow", String(ammoCharge));
        energyTrack.setAttribute("aria-valuemax", String(GameConfig.attackNeedTotal));
        energyTrack.setAttribute("aria-valuetext", `${ammoCharge}/${GameConfig.attackNeedTotal}`);
      }
      if (bombTrack) {
        bombTrack.setAttribute("aria-valuenow", String(ammo));
        bombTrack.setAttribute("aria-valuemax", String(GameConfig.maxAmmo));
        bombTrack.setAttribute("aria-valuetext", `${ammo}/${GameConfig.maxAmmo}`);
      }
      if (energyFill) energyFill.style.setProperty("--resource-ratio", energyRatio.toFixed(4));
      if (bombFill) bombFill.style.setProperty("--resource-ratio", bombRatio.toFixed(4));
      if (energyValue) energyValue.textContent = `${ammoCharge}/${GameConfig.attackNeedTotal}`;
      if (bombValue) bombValue.textContent = `${ammo}/${GameConfig.maxAmmo}`;
      GameConfig.foodTypes.forEach(type => {
        const count = Math.max(0, Math.min(GameConfig.maxFoodStock, Math.round(stock[type.id] || 0)));
        const countEl = GameRuntimeState.resourceEls.get(`${owner}-${type.id}-count`);
        const fill = GameRuntimeState.resourceEls.get(`${owner}-${type.id}-fill`);
        if (countEl) countEl.textContent = count;
        if (fill) fill.style.width = `${Math.min(100, count / GameConfig.maxFoodStock * 100)}%`;
      });
    }

    function updateHealthBar(owner, hp, maxHp) {
      const bar = owner === "player" ? Dom.playerHealthBar : Dom.computerHealthBar;
      if (!bar) return;
      const safeMax = Math.max(1, maxHp);
      const safeHp = Math.max(0, Math.min(safeMax, hp));
      const ratio = safeHp / safeMax;
      bar.style.setProperty("--health-ratio", ratio.toFixed(4));
      bar.setAttribute("aria-valuenow", String(Math.ceil(safeHp)));
      bar.setAttribute("aria-valuemax", String(safeMax));
      bar.setAttribute("aria-valuetext", `${Math.ceil(safeHp)}/${safeMax}`);
      bar.closest(".player-metric")?.classList.toggle("is-low-health", ratio <= 0.3);
    }

    function cooldownTimerText(remainingMs) {
      if (remainingMs <= 0) return "0";
      const seconds = remainingMs / 1000;
      return seconds >= 10 ? String(Math.ceil(seconds)) : seconds.toFixed(1);
    }

    function updateCooldownIndicator(profile = "small", indicator = null, valueEl = null, now = performance.now()) {
      if (!indicator || !valueEl) return;
      const remainingMs = GameUI.attackCooldownRemainingMs("player", profile, now);
      const cooling = remainingMs > 0;
      const available = GameUI.canAttack("player", profile);
      const label = profile === "big" ? "大招" : "小招";
      const text = cooldownTimerText(remainingMs);
      valueEl.textContent = text;
      indicator.classList.toggle("is-cooling", cooling);
      indicator.classList.toggle("is-ready", !cooling && available);
      indicator.classList.toggle("is-blocked", !cooling && !available);
      const title = cooling
        ? `${label}冷卻 ${text} 秒`
        : available
          ? `${label}冷卻完成`
          : `${label}冷卻完成，資源不足`;
      indicator.title = title;
      indicator.setAttribute("aria-label", title);
    }

    function updateCooldownHud(now = performance.now()) {
      updateCooldownIndicator("small", Dom.cooldownSmallIndicator, Dom.cooldownSmallValue, now);
      updateCooldownIndicator("big", Dom.cooldownBigIndicator, Dom.cooldownBigValue, now);
    }

    function updateSkillPrepVisibility() {
      const visible = !GameReplay.isPlaybackMode() && !isPlayerAutoControlActive();
      const skillPrepHud = [
        Dom.targetModeSmallIndicator,
        Dom.targetModeBigIndicator,
        Dom.cooldownSmallIndicator,
        Dom.cooldownBigIndicator
      ];
      skillPrepHud.forEach(element => {
        if (element) element.hidden = !visible;
      });
    }

    function updateHud() {
      GameRuntimeState.lastHudFrameAt = performance.now();
      updateSkillPrepVisibility();
      const playerMaxHp = GameUI.maxHpForSnake(GameRuntimeState.snake);
      const computerMaxHp = GameUI.maxHpForSnake(GameRuntimeState.computerSnake);
      Dom.scoreEl.textContent = `HP ${Math.max(0, Math.ceil(GameRuntimeState.playerHp))}/${playerMaxHp}`;
      Dom.computerScoreEl.textContent = `HP ${Math.max(0, Math.ceil(GameRuntimeState.computerHp))}/${computerMaxHp}`;
      updateHealthBar("player", GameRuntimeState.playerHp, playerMaxHp);
      updateHealthBar("computer", GameRuntimeState.computerHp, computerMaxHp);
      Dom.bestEl.textContent = GameRuntimeState.best;
      Dom.totalTimeEl.textContent = GameUI.formatTime(GameRuntimeState.totalElapsedMs);
      Dom.lastFeedTimeEl.textContent = GameUI.formatTime(GameRuntimeState.lastFeedElapsedMs);
      Dom.bestTimeEl.textContent = GameUI.formatTime(GameRuntimeState.bestTotalMs);
      const now = performance.now();
      const playerSpeedValue = GameUI.isMovementStunned("player", now) ? 0 : GameUI.movementSpeed(GameRuntimeState.playerStock) / (now < GameRuntimeState.playerSlowUntil ? 2 : 1);
      const computerSpeedValue = GameUI.isMovementStunned("computer", now) ? 0 : GameUI.movementSpeed(GameRuntimeState.computerStock) / (now < GameRuntimeState.computerSlowUntil ? 2 : 1);
      const playerSpeed = Math.round(playerSpeedValue * 10) / 10;
      const computerSpeed = Math.round(computerSpeedValue * 10) / 10;
      Dom.playerSpeedEl.textContent = `${playerSpeed}x`;
      Dom.computerSpeedEl.textContent = `${computerSpeed}x`;
      Dom.keyEls.forEach(el => el.classList.toggle("active", Number(el.dataset.dir) === GameRuntimeState.nextDir));
      updateStockHud("player", GameRuntimeState.playerStock, GameRuntimeState.playerAmmo, GameRuntimeState.playerAmmoCharge);
      updateStockHud("computer", GameRuntimeState.computerStock, GameRuntimeState.computerAmmo, GameRuntimeState.computerAmmoCharge);
      updateCooldownHud(now);
    }

    function updateHudThrottled(now = performance.now()) {
      if (now - GameRuntimeState.lastHudFrameAt < GameConfig.hudFrameIntervalMs) return;
      updateHud();
    }

    function recordReplaySnapshotThrottled(now) {
      if (now - GamePresentationState.lastReplayRecordCheckAt < GamePresentationState.replayRecordCheckIntervalMs) return;
      GamePresentationState.lastReplayRecordCheckAt = now;
      GameReplay.recordSnapshot(now);
    }

    function setStatus(text) {
      Dom.statusEl.textContent = text;
    }

    function autoBattleSpeedLabel(value) {
      return `x${Number(value).toString()}`;
    }

    function renderAutoSpeedMenu() {
      Dom.autoSpeedMenu.innerHTML = GameConfig.autoBattleSpeeds.map(speed => `
        <button class="${speed === GameRuntimeState.computerBattleSpeed ? "is-selected" : ""}" type="button" data-auto-speed="${speed}">${autoBattleSpeedLabel(speed)}</button>
      `).join("");
    }

    function setAutoSpeedMenuOpen(open) {
      Dom.autoSpeedMenu.hidden = !open;
      Dom.autoBattleSpeedSelect.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) renderAutoSpeedMenu();
    }

    function replaySpeedOptions() {
      return [...GameReplay.playbackSpeeds].sort((a, b) => b - a);
    }

    function replaySpeedLabel(value) {
      return `x${Number(value).toString()}`;
    }

    function renderReplaySpeedMenu() {
      const playback = GameReplay.playback;
      const selectedSpeed = playback?.speed ?? 1;
      Dom.replaySpeedMenu.innerHTML = replaySpeedOptions().map(speed => `
        <button class="${speed === selectedSpeed ? "is-selected" : ""}" type="button" data-replay-speed="${speed}">${replaySpeedLabel(speed)}</button>
      `).join("");
    }

    function setReplaySpeedMenuOpen(open) {
      Dom.replaySpeedMenu.hidden = !open;
      Dom.replaySpeedSelect.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) renderReplaySpeedMenu();
    }

    function setComputerBattleSpeed(value, persist = true) {
      GameRuntimeState.computerBattleSpeed = normalizeAutoBattleSpeed(value);
      Dom.autoBattleSpeedSelect.textContent = autoBattleSpeedLabel(GameRuntimeState.computerBattleSpeed);
      Dom.autoBattleSpeedSelect.dataset.value = String(GameRuntimeState.computerBattleSpeed);
      Dom.autoBattleSpeedSelect.setAttribute("aria-valuenow", String(GameRuntimeState.computerBattleSpeed));
      Dom.autoBattleSpeedSelect.setAttribute("aria-valuetext", autoBattleSpeedLabel(GameRuntimeState.computerBattleSpeed));
      renderAutoSpeedMenu();
      if (persist) {
        GameStorage.set("hexSnakeAutoBattleSpeed", String(GameRuntimeState.computerBattleSpeed));
      }
    }

    function resetAutoBattleStepTimers() {
      GameRuntimeState.lastPlayerStep = performance.now();
      GameRuntimeState.lastComputerStep = GameRuntimeState.lastPlayerStep;
      GameRuntimeState.lastTimerFrame = GameRuntimeState.lastPlayerStep;
    }

    function isPlayerAutoControlActive() {
      return (GameRuntimeState.computerBattleMode && !GameRuntimeState.computerBattleManualOverride) || GameRuntimeState.playerAutoMode;
    }

    function isRelayModeAvailable() {
      return GameRuntimeState.computerBattleMode ? !GameRuntimeState.computerBattleManualOverride : GameRuntimeState.playerAutoMode;
    }

    function clearRelayRestartTimer() {
      if (!GameRuntimeState.relayRestartTimer) return;
      clearTimeout(GameRuntimeState.relayRestartTimer);
      GameRuntimeState.relayRestartTimer = null;
    }

    function clearGameOverSettlementTimer() {
      GameRuntimeState.gameOverSettlementPending = false;
      GameRuntimeState.gameOverRelayStartOptions = null;
      GameRuntimeState.gameOverContinuousVisualDeadlineAt = 0;
      GameRuntimeState.gameOverLogoTransitionEndsAt = 0;
      GameRuntimeState.gameOverResultOwner = null;
      GameRuntimeState.gameOverPlayerLost = false;
      GameRuntimeState.gameOverComputerLost = false;
      GameUI.clearLogoTransition();
    }

    function resetRelayScore() {
      GameRuntimeState.relayPlayerWins = 0;
      GameRuntimeState.relayComputerWins = 0;
      GameRuntimeState.relayDraws = 0;
    }

    function setRelayMode(enabled, resetScore = false, persist = true) {
      if (persist) GameRuntimeState.relayModePreference = Boolean(enabled);
      const requestedRelayMode = persist ? GameRuntimeState.relayModePreference : Boolean(enabled);
      GameRuntimeState.relayMode = requestedRelayMode && isRelayModeAvailable();
      Dom.relayModeInput.checked = GameRuntimeState.relayMode;
      if (persist) GameStorage.set("hexSnakeRelayMode", GameRuntimeState.relayModePreference ? "1" : "0");
      if (resetScore) resetRelayScore();
      if (!GameRuntimeState.relayMode) clearRelayRestartTimer();
      updateRelayControls();
    }

    function updateRelayControls() {
      const visible = !GameReplay.isPlaybackMode() && (GameRuntimeState.relayMode || (GameRuntimeState.running && !GameRuntimeState.gameOver && isRelayModeAvailable()));
      Dom.relayPanel.hidden = !visible;
      Dom.relayModeInput.checked = GameRuntimeState.relayMode;
      Dom.relayScore.innerHTML = `<span class="owner-name is-p1">P1</span> ${GameRuntimeState.relayPlayerWins} 勝 / <span class="owner-name is-p2">P2</span> ${GameRuntimeState.relayComputerWins} 勝 / 平手 ${GameRuntimeState.relayDraws}`;
    }

    function updateAutoBattleControls() {
      const visible = isPlayerAutoControlActive() && GameRuntimeState.running && !GameRuntimeState.gameOver && !GameReplay.isPlaybackMode();
      Dom.autoBattlePanel.hidden = !visible;
      Dom.autoBattleSpeedSelect.textContent = autoBattleSpeedLabel(GameRuntimeState.computerBattleSpeed);
      Dom.autoBattleSpeedSelect.dataset.value = String(GameRuntimeState.computerBattleSpeed);
      Dom.autoBattleSpeedSelect.setAttribute("aria-valuenow", String(GameRuntimeState.computerBattleSpeed));
      Dom.autoBattleSpeedSelect.setAttribute("aria-valuetext", autoBattleSpeedLabel(GameRuntimeState.computerBattleSpeed));
      if (!visible) setAutoSpeedMenuOpen(false);
      Dom.autoPauseButton.textContent = GameRuntimeState.paused ? "▶" : "⏸";
      Dom.autoPauseButton.setAttribute("aria-label", GameRuntimeState.paused ? "播放" : "暫停");
      Dom.autoPauseButton.title = GameRuntimeState.paused ? "播放" : "暫停";
      updateRelayControls();
      updateSkillPrepVisibility();
    }

    function setPlayerAutoMode(active, announce = true) {
      const nextActive = Boolean(active) && GameRuntimeState.running && !GameRuntimeState.gameOver && !GameReplay.isPlaybackMode();
      if (GameRuntimeState.playerAutoMode === nextActive) return;
      GameRuntimeState.playerAutoMode = nextActive;
      if (GameRuntimeState.playerAutoMode) {
        setComputerBattleSpeed(GameStorage.get("hexSnakeAutoBattleSpeed"), false);
        setRelayMode(GameRuntimeState.relayModePreference, false, false);
        resetAutoBattleStepTimers();
        if (announce) setStatus("Auto 已開啟，電腦接手 P1 操作。");
      } else {
        setRelayMode(false, false, false);
        setAutoSpeedMenuOpen(false);
        if (announce) setStatus("Auto 已關閉，回到玩家操作。");
      }
      updateSettingsActionMode();
      updateAutoBattleControls();
      updateHud();
    }

    function setComputerBattleManualOverride(active) {
      if (!GameRuntimeState.computerBattleMode || !GameRuntimeState.running || GameRuntimeState.gameOver || GameReplay.isPlaybackMode()) return;
      GameRuntimeState.computerBattleManualOverride = Boolean(active);
      if (!GameRuntimeState.computerBattleManualOverride) {
        setComputerBattleSpeed(GameStorage.get("hexSnakeAutoBattleSpeed"), false);
        setRelayMode(GameRuntimeState.relayModePreference, false, false);
        resetAutoBattleStepTimers();
        setStatus("Auto 已開啟，電腦接手 P1 操作。");
      } else {
        setRelayMode(false, false, false);
        setAutoSpeedMenuOpen(false);
        setStatus("Auto 已關閉，回到玩家操作。");
      }
      updateSettingsActionMode();
      updateAutoBattleControls();
      updateHud();
    }

    let lastNetworkSnapshotAt = -Infinity;

    function networkAdapter() {
      return GameNetwork || null;
    }

    function isNetworkHostActive() {
      const net = networkAdapter();
      return Boolean(net?.isHost?.() && net?.hasPeer?.());
    }

    function isNetworkGuestActive() {
      return Boolean(networkAdapter()?.isGuest?.());
    }

    function safeNetworkCell(value) {
      const q = Number(value?.q);
      const r = Number(value?.r);
      if (!Number.isFinite(q) || !Number.isFinite(r)) return null;
      return nearestInsideCell({ q, r });
    }

    function safeNetworkDirection(value) {
      const direction = Number(value);
      return Number.isInteger(direction) && direction >= 0 && direction < GameConfig.directions.length ? direction : null;
    }

    function safeNetworkAttackOptions(options = {}) {
      const nextOptions = {};
      const aimDirection = safeNetworkDirection(options.aimDirection);
      const aimOrigin = safeNetworkCell(options.aimOrigin);
      if (aimDirection !== null) nextOptions.aimDirection = aimDirection;
      if (aimOrigin) nextOptions.aimOrigin = aimOrigin;
      return nextOptions;
    }

    function sendNetworkInput(input) {
      const net = networkAdapter();
      if (!net?.isGuest?.()) return false;
      net.setInGame?.(true);
      return net.sendInput(input);
    }

    function broadcastNetworkGameMessage(payload) {
      const net = networkAdapter();
      if (!net?.isHost?.()) return false;
      return net.sendGameMessage(payload);
    }

    function broadcastNetworkSnapshot(now = performance.now(), force = false, final = false) {
      if (!isNetworkHostActive() || !GameRuntimeState.snake || !GameRuntimeState.computerSnake) return;
      const snapshotIntervalMs = Number(networkAdapter()?.snapshotIntervalMs?.()) || 100;
      if (!force && now - lastNetworkSnapshotAt < snapshotIntervalMs) return;
      lastNetworkSnapshotAt = now;
      networkAdapter()?.setInGame?.(!final);
      broadcastNetworkGameMessage({
        type: final ? "end" : "snapshot",
        force: Boolean(force),
        snapshot: GameReplay.createSnapshot(now, final)
      });
    }

    function broadcastNetworkStart(now = performance.now()) {
      if (!isNetworkHostActive()) return;
      lastNetworkSnapshotAt = now;
      networkAdapter()?.setInGame?.(true);
      broadcastNetworkGameMessage({
        type: "start",
        snapshot: GameReplay.createSnapshot(now, true)
      });
      setStatus("LAN match started. Host controls P1; guest controls P2.");
    }

    function applyNetworkDirectionInput(direction) {
      const nextDirection = safeNetworkDirection(direction);
      if (nextDirection === null || !GameRuntimeState.computerSnake?.length) return false;
      if (!canComputerTurn(nextDirection)) return false;
      GameRuntimeState.computerDir = nextDirection;
      updateHud();
      return true;
    }

    function applyNetworkAttackInput(input = {}) {
      if (!GameRuntimeState.running || GameRuntimeState.paused || GameRuntimeState.gameOver || !GameRuntimeState.computerSnake?.length || !GameRuntimeState.snake?.length) return false;
      const profile = input.profile === "small" ? "small" : "big";
      const direction = safeNetworkDirection(input.direction);
      const options = safeNetworkAttackOptions(input.options);
      if (direction !== null) {
        options.aimDirection = direction;
        options.aimOrigin = { ...GameRuntimeState.computerSnake[0] };
      }
      const target = safeNetworkCell(input.target) || GameRuntimeState.snake[0];
      const launched = launchAttack("computer", target, performance.now(), profile, options);
      if (launched) {
        setStatus(profile === "small" ? "P2 LAN attack fired." : "P2 LAN big attack fired.");
        broadcastNetworkSnapshot(performance.now(), true);
      }
      return launched;
    }

    function applyNetworkInput(input = {}) {
      if (!isNetworkHostActive()) return;
      if (input.kind === "direction") {
        applyNetworkDirectionInput(input.direction);
        return;
      }
      if (input.kind === "attack" || input.kind === "attack-direction") {
        applyNetworkAttackInput(input);
      }
    }

    function applyNetworkSnapshotMessage(message = {}) {
      if (!isNetworkGuestActive() || !message.snapshot) return;
      const final = message.type === "end";
      GameRuntimeState.running = false;
      GameRuntimeState.paused = false;
      GameRuntimeState.gameOver = final;
      GameRuntimeState.computerBattleMode = false;
      GameRuntimeState.playerAutoMode = false;
      GameRuntimeState.computerBattleManualOverride = false;
      GameRuntimeState.relayMode = false;
      setSettingsLocked(!final);
      Dom.overlay.classList.remove("show");
      GameUI.showCharacterStage({ rebuild: false, "overlay": false });
      GameReplay.applySnapshot(message.snapshot, {
        playerCharacterId: message.snapshot.playerCharacterId,
        computerCharacterId: message.snapshot.computerCharacterId,
        settings: { gridSize: message.snapshot.gridSize }
      });
      networkAdapter()?.setInGame?.(!final);
      setStatus(final ? "LAN match ended." : "LAN match: you control P2.");
    }

    function handleNetworkGameMessage(message = {}) {
      if (message.type === "input") {
        applyNetworkInput(message.input);
        return;
      }
      if (message.type === "start" || message.type === "snapshot" || message.type === "end") {
        applyNetworkSnapshotMessage(message);
      }
    }

    networkAdapter()?.onGameMessage?.(handleNetworkGameMessage);

    function sandwormUndergroundAlpha(owner, now) {
      if (GameUI.characterFor(owner).id !== "sandworm") return 1;
      const armorFrom = owner === "player" ? GameRuntimeState.playerSandwormArmorFrom : GameRuntimeState.computerSandwormArmorFrom;
      const armorUntil = owner === "player" ? GameRuntimeState.playerSandwormArmorUntil : GameRuntimeState.computerSandwormArmorUntil;
      const from = owner === "player" ? GameRuntimeState.playerUndergroundFrom : GameRuntimeState.computerUndergroundFrom;
      const until = owner === "player" ? GameRuntimeState.playerUndergroundUntil : GameRuntimeState.computerUndergroundUntil;
      if (from && now >= from && now <= until) return 0;
      if (armorFrom && now >= armorFrom && now <= armorUntil) {
        const fadeTargetAt = from && from > armorFrom ? from : armorFrom + 500;
        if (now < fadeTargetAt) {
          const fadeProgress = Math.max(0, Math.min(1, (now - armorFrom) / Math.max(1, fadeTargetAt - armorFrom)));
          return 1 - fadeProgress * 0.55;
        }
        if (until && now > until) {
          const fadeProgress = Math.max(0, Math.min(1, (now - until) / Math.max(1, armorUntil - until)));
          return 0.45 + fadeProgress * 0.55;
        }
        return 0.45;
      }
      if (!from || now < from || now > until) return 1;
      const fadeMs = 120;
      const fadeIn = Math.min(1, Math.max(0, (now - from) / fadeMs));
      const fadeOut = Math.min(1, Math.max(0, (until - now) / fadeMs));
      return 1 - Math.min(fadeIn, fadeOut);
    }

    function isOwnerSandwormArmored(owner, now) {
      if (GameUI.characterFor(owner).id !== "sandworm") return false;
      const from = owner === "player" ? GameRuntimeState.playerSandwormArmorFrom : GameRuntimeState.computerSandwormArmorFrom;
      const until = owner === "player" ? GameRuntimeState.playerSandwormArmorUntil : GameRuntimeState.computerSandwormArmorUntil;
      return Boolean(from && now >= from && now <= until);
    }

    function isOwnerDamageImmune(owner, now) {
      return GameAI.isOwnerUnderground(owner, now);
    }

    function clearOwnerAbnormalStatus(owner, now) {
      if (owner === "player") {
        GameRuntimeState.playerStunUntil = Math.min(GameRuntimeState.playerStunUntil, now);
        GameRuntimeState.playerSlowUntil = Math.min(GameRuntimeState.playerSlowUntil, now);
        GameRuntimeState.playerCollisionParalysisMs = 0;
        GameRuntimeState.playerVulnerable = false;
      } else {
        GameRuntimeState.computerStunUntil = Math.min(GameRuntimeState.computerStunUntil, now);
        GameRuntimeState.computerSlowUntil = Math.min(GameRuntimeState.computerSlowUntil, now);
        GameRuntimeState.computerCollisionParalysisMs = 0;
        GameRuntimeState.computerVulnerable = false;
      }
    }

    function refreshSandwormProtections(now) {
      ["player", "computer"].forEach(owner => {
        if (isOwnerSandwormArmored(owner, now)) clearOwnerAbnormalStatus(owner, now);
      });
    }

    function canTurn(newDir) {
      return GameRuntimeState.snake.length < 2 || (newDir + 3) % 6 !== GameRuntimeState.dir;
    }

    function canComputerTurn(newDir) {
      return GameRuntimeState.computerSnake.length < 2 || (newDir + 3) % 6 !== GameRuntimeState.computerDir;
    }

    function canOwnerTurn(owner, newDir) {
      if (owner === "player") return GameRuntimeState.snake.length < 2 || (newDir + 3) % 6 !== GameRuntimeState.dir;
      return canComputerTurn(newDir);
    }

    function hexDistance(a, b) {
      const as = -a.q - a.r;
      const bs = -b.q - b.r;
      return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(as - bs)) / 2;
    }

    function nextCell(head, direction) {
      const delta = GameConfig.directions[direction];
      return { q: head.q + delta.q, r: head.r + delta.r };
    }

    function nextWrappedCell(head, direction) {
      const next = nextCell(head, direction);
      if (isInside(next)) return next;

      const oppositeDirection = (direction + 3) % 6;
      let wrapped = head;
      while (isInside(nextCell(wrapped, oppositeDirection))) {
        wrapped = nextCell(wrapped, oppositeDirection);
      }
      return wrapped;
    }

    function directionalAttackTarget(direction) {
      let target = { ...GameRuntimeState.snake[0] };
      for (let step = 0; step < GameRuntimeState.targetMaxHex; step += 1) {
        const next = nextWrappedCell(target, direction);
        target = next;
      }
      return target;
    }

    function setDirectionButtonHighlight(direction = null) {
      Dom.hexDirButtons.forEach(button => button.classList.toggle("active", Number(button.dataset.dir) === direction));
    }

    function setDirection(newDir, options = {}) {
      if (!Number.isInteger(newDir) || newDir < 0 || newDir > 5) return;
      if (isNetworkGuestActive()) {
        if (!GameRuntimeState.computerSnake?.length || !canComputerTurn(newDir)) return;
        setDirectionButtonHighlight(newDir);
        sendNetworkInput({ kind: "direction", direction: newDir });
        if (options.feedbackEvent) triggerTouchFeedback(options.feedbackEvent, options.feedbackStrength ?? 6);
        return;
      }
      if (canTurn(newDir)) {
        const changed = GameRuntimeState.nextDir !== newDir;
        GameRuntimeState.nextDir = newDir;
        setDirectionButtonHighlight(newDir);
        if (changed) triggerTouchFeedback(options.feedbackEvent, options.feedbackStrength ?? 6);
        updateHud();
      }
    }

    function attackStats(stock, profile = "big") {
      const isSmall = profile === "small";
      return {
        delay: GameUI.attackDelay(stock) * (isSmall ? GameConfig.smallAttackDelayScale : 1),
        radius: Math.max(1, GameUI.blastRadius(stock) + (isSmall ? -1 : 0)),
        damage: GameUI.attackDamage(stock, profile)
      };
    }

    function bandDistanceFromTotalWidth(totalWidth) {
      return Math.max(0, Math.floor((totalWidth - 1) / 2));
    }

    function bandShapeFromTotalWidth(totalWidth) {
      const fullDamageWidth = bandDistanceFromTotalWidth(totalWidth);
      const fullTotalWidth = fullDamageWidth * 2 + 1;
      const outerDamageMultiplier = Math.max(0, Math.min(1, (totalWidth - fullTotalWidth) / 2));
      return {
        width: fullDamageWidth + (outerDamageMultiplier > 0 ? 1 : 0),
        fullDamageWidth,
        outerDamageMultiplier
      };
    }

    function lineBandDamageMultiplier(distance, band) {
      if (distance > (band?.width ?? 0)) return 0;
      if (distance <= (band?.fullDamageWidth ?? 0)) return 1;
      return band?.outerDamageMultiplier ?? 1;
    }

    function ownerDirection(owner) {
      return owner === "player" ? GameRuntimeState.nextDir : GameRuntimeState.computerDir;
    }

    function directionVector(direction) {
      const delta = GameConfig.directions[direction];
      if (!delta) return { x: 1, y: 0 };
      return {
        x: Math.sqrt(3) * (delta.q + delta.r / 2),
        y: 1.5 * delta.r
      };
    }

    function directionScreenAngle(direction) {
      const vector = directionVector(direction);
      return Math.atan2(vector.y, vector.x) * 180 / Math.PI;
    }

    function directionFromSourceToTarget(source, target, fallbackDirection = 0) {
      if (!source || !target || keyOf(source) === keyOf(target)) return fallbackDirection;
      const start = axialToPixel(source);
      const end = axialToPixel(target);
      const vx = end.x - start.x;
      const vy = end.y - start.y;
      if (!vx && !vy) return fallbackDirection;
      let bestDirection = fallbackDirection;
      let bestDot = -Infinity;
      GameConfig.directions.forEach((direction, index) => {
        const vector = directionVector(index);
        const dot = vx * vector.x + vy * vector.y;
        if (dot > bestDot) {
          bestDot = dot;
          bestDirection = index;
        }
      });
      return bestDirection;
    }

    function turnDistance(left, right) {
      const directionCount = GameConfig.directions.length;
      const clockwise = (right - left + directionCount) % directionCount;
      return Math.min(clockwise, directionCount - clockwise);
    }

    function cellsForwardFrom(source, direction, includeSource = true) {
      const path = includeSource ? [{ q: source.q, r: source.r }] : [];
      let cursor = source;
      while (true) {
        const next = nextCell(cursor, direction);
        if (!isInside(next)) break;
        path.push(next);
        cursor = next;
      }
      return path;
    }

    function boardLineThrough(origin, direction) {
      let start = origin;
      const opposite = (direction + 3) % 6;
      while (isInside(nextCell(start, opposite))) {
        start = nextCell(start, opposite);
      }
      return cellsForwardFrom(start, direction, true);
    }

    function lobsterFistDirection(cursor, direction, targetSnake, remainingSteps = 0) {
      const head = targetSnake[0];
      const bodyTarget = targetSnake.slice(1).sort((a, b) => hexDistance(cursor, a) - hexDistance(cursor, b))[0];
      const target = head && hexDistance(cursor, head) <= remainingSteps ? head : (bodyTarget || head);
      if (!target) return direction;
      const directionCount = GameConfig.directions.length;
      const candidates = [direction, (direction + 1) % directionCount, (direction + 5) % directionCount];
      candidates.sort((a, b) => {
        const nextA = nextWrappedCell(cursor, a);
        const nextB = nextWrappedCell(cursor, b);
        const distanceA = hexDistance(nextA, target);
        const distanceB = hexDistance(nextB, target);
        if (distanceA !== distanceB) return distanceA - distanceB;
        return turnDistance(a, direction) - turnDistance(b, direction);
      });
      return candidates[0];
    }

    function lobsterFistPath(source, direction, targetSnake) {
      const path = [];
      let cursor = { q: source.q, r: source.r };
      let currentDirection = direction;
      const maxSteps = Math.max(1, Math.ceil((GameRuntimeState.radius * 2 + 1) / 2));
      const turnStep = Math.ceil(maxSteps / 2);
      for (let step = 0; step < maxSteps; step += 1) {
        if (step === turnStep) {
          currentDirection = lobsterFistDirection(cursor, currentDirection, targetSnake, maxSteps - step);
        }
        cursor = nextWrappedCell(cursor, currentDirection);
        if (keyOf(cursor) === keyOf(source)) break;
        path.push({ q: cursor.q, r: cursor.r });
      }
      return path;
    }

    function pointAlongPath(source, pathCells = [], progress = 0) {
      const points = [source, ...pathCells].map(cell => axialToPixel(cell));
      if (points.length <= 1) return points[0] || { x: 0, y: 0, angle: 0 };
      const segmentProgress = Math.min(points.length - 1, Math.max(0, progress) * (points.length - 1));
      const index = Math.min(points.length - 2, Math.floor(segmentProgress));
      const localProgress = segmentProgress - index;
      const start = points[index];
      const end = points[index + 1];
      return {
        x: start.x + (end.x - start.x) * localProgress,
        y: start.y + (end.y - start.y) * localProgress,
        angle: Math.atan2(end.y - start.y, end.x - start.x)
      };
    }

    function pathHits(path, targetSnake) {
      const targetCells = cellKeySet(targetSnake);
      return path
        .map((cell, index) => ({ cell, index }))
        .filter(hit => targetCells.has(keyOf(hit.cell)));
    }

    function cellKeySet(cellList = []) {
      return new Set(cellList.map(cell => keyOf(cell)));
    }

    function cellsNearCells(effectCells, width, excludedCells = [], minDistance = 0) {
      const excluded = cellKeySet(excludedCells);
      return GameRuntimeState.cells.filter(cell => !excluded.has(keyOf(cell)) && effectCells.some(effectCell => {
        const distance = hexDistance(cell, effectCell);
        return distance >= minDistance && distance <= width;
      }));
    }

    function attackVisualType(owner, profile = "big", characterId = null) {
      const character = GameUI.characterFor(owner);
      return `${characterId || character.id}-${profile}`;
    }

    function characterForVisualType(owner, visualType = null) {
      const visualCharacterId = typeof visualType === "string" ? visualType.split("-")[0] : null;
      return GameUI.characterForId(visualCharacterId) || GameUI.characterFor(owner);
    }

    function burstVisualType(projectile) {
      const type = projectile.visualType || attackVisualType(projectile.owner, projectile.profile);
      return type.endsWith("-big") ? type.replace(/-big$/, "-burst") : type;
    }

    function triggerSmallHitShake(projectile, playerDamage, computerDamage, now) {
      if (projectile.profile !== "small") return;
      if (playerDamage <= 0 && computerDamage <= 0) return;
      GameRender.triggerBoardShake(projectile.visualType || attackVisualType(projectile.owner, projectile.profile), now, { profile: "smallHit" });
    }

    function pushCircleAttack({ owner, profile, source = null, target, createdAt, impactAt, delay, radius, damage, stunChance, hidden = false, flat = false, visualType = null, ...extra }) {
      GameRuntimeState.projectiles.push({
        kind: "circle",
        owner,
        profile,
        visualType: visualType || attackVisualType(owner, profile),
        source: source ? { q: source.q, r: source.r } : { q: target.q, r: target.r },
        target: { q: target.q, r: target.r },
        createdAt,
        impactAt,
        delay,
        radius,
        damage,
        stunChance,
        hidden,
        flat,
        ...extra
      });
    }

    function guKingBestDamageStep(currentTarget, targetSnake, radius, damage) {
      const head = targetSnake[0];
      const current = {
        target: { q: currentTarget.q, r: currentTarget.r },
        damage: damageSnake(targetSnake, currentTarget, radius, damage),
        headDistance: head ? hexDistance(currentTarget, head) : 0
      };
      return GameConfig.directions
        .map((_, direction) => nextWrappedCell(currentTarget, direction))
        .reduce((bestCandidate, candidate) => {
          const next = {
            target: candidate,
            damage: damageSnake(targetSnake, candidate, radius, damage),
            headDistance: head ? hexDistance(candidate, head) : 0
          };
          if (next.damage > bestCandidate.damage) return next;
          if (next.damage === bestCandidate.damage && keyOf(bestCandidate.target) !== keyOf(current.target) && next.headDistance < bestCandidate.headDistance) return next;
          return bestCandidate;
        }, current).target;
    }

    function scheduleLobsterPalmVolley({
      owner,
      source,
      direction,
      targetSnake,
      now,
      smallDelay,
      fistStepMs,
      contactRadius,
      contactDamage,
      burstRadius,
      burstDamage,
      stunChance,
      headStunChance,
      vulnerabilityChance,
      visualType,
      hand
    }) {
      const path = lobsterFistPath(source, direction, targetSnake);
      const hits = pathHits(path, targetSnake);
      const firstHit = hits[0];
      const travelPath = firstHit ? path.slice(0, firstHit.index + 1) : path;
      const endCell = firstHit?.cell || path[path.length - 1] || source;
      const travelDelay = smallDelay + travelPath.length * fistStepMs;
      GameRuntimeState.projectiles.push({
        kind: "lobsterPalm",
        owner,
        profile: "big",
        source: { q: source.q, r: source.r },
        target: { q: endCell.q, r: endCell.r },
        pathCells: travelPath,
        visualType,
        hand,
        createdAt: now,
        impactAt: now + travelDelay,
        delay: travelDelay,
        radius: contactRadius,
        damage: contactDamage,
        burstRadius,
        burstDamage,
        stunChance,
        headStunChance,
        vulnerabilityChance
      });
      const burstHits = firstHit ? [firstHit] : [{ cell: endCell, index: Math.max(0, travelPath.length - 1) }];
      burstHits.forEach(hit => {
        GameRuntimeState.projectiles.push({
          kind: "lobsterPalmBurst",
          owner,
          profile: "big",
          source: { q: source.q, r: source.r },
          target: { q: hit.cell.q, r: hit.cell.r },
          visualType,
          hand,
          hidden: true,
          createdAt: now,
          impactAt: now + smallDelay + (hit.index + 1) * fistStepMs,
          delay: smallDelay + (hit.index + 1) * fistStepMs,
          radius: contactRadius,
          damage: contactDamage,
          burstRadius,
          burstDamage,
          stunChance,
          headStunChance,
          vulnerabilityChance
        });
      });
      return travelDelay;
    }

    function lobsterPalmVulnerabilityChance(stock) {
      return GameUI.attackStunChance(stock, GameAI.ultimateSetting("lobster", "vulnerabilityChance", 0.3));
    }

    function attackHitStunChances(stock) {
      return {
        body: Math.min(1, GameConfig.bodyHitStunChance + GameUI.foodBonus(stock, "carb", GameConfig.bodyHitStunChanceBonusPerPoint, GameConfig.bodyHitMaxStunChanceBonus)),
        head: Math.min(1, GameConfig.headHitStunChance + GameUI.foodBonus(stock, "carb", GameConfig.headHitStunChanceBonusPerPoint, GameConfig.headHitMaxStunChanceBonus))
      };
    }

    function scheduleCharacterBigAttack(owner, character, source, target, now, stock, stunChance, options = {}) {
      const small = attackStats(stock, "small");
      const bigDamage = GameUI.attackDamage(stock, "big");
      const direction = Number.isInteger(options.aimDirection)
        ? options.aimDirection
        : directionFromSourceToTarget(source, target, ownerDirection(owner));

      if (character.id === "lobster") {
        const fistStepMs = GameAI.ultimateSetting(character.id, "fistStepMs", 36);
        const volleys = Math.max(1, Math.round(GameAI.ultimateSetting(character.id, "volleyCount", 2)));
        const contactDamage = bigDamage * GameAI.ultimateSetting(character.id, "contactDamageMultiplier", 0.6);
        const contactRadius = Math.max(0.25, GameAI.ultimateSetting(character.id, "contactRadius", 1));
        const burstRadius = small.radius * GameAI.ultimateSetting(character.id, "burstRadiusMultiplier", 1.6);
        const burstDamage = bigDamage * GameAI.ultimateSetting(character.id, "burstDamageMultiplier", 1.6);
        const palmVulnerabilityChance = Number.isFinite(options.vulnerabilityChance)
          ? options.vulnerabilityChance
          : lobsterPalmVulnerabilityChance(stock);
        const visualType = "lobster-palm-big";
        const volleyIntervalMs = GameUI.attackDelay(stock);
        let maxTravelDelay = 0;
        for (let volley = 0; volley < volleys; volley += 1) {
          const volleyDelay = volley * volleyIntervalMs;
          const hand = volley % 2 === 0 ? "right" : "left";
          if (volley === 0) {
            maxTravelDelay = Math.max(maxTravelDelay, scheduleLobsterPalmVolley({
              owner,
              source,
              direction,
              targetSnake: owner === "player" ? GameRuntimeState.computerSnake : GameRuntimeState.snake,
              now,
              smallDelay: small.delay,
              fistStepMs,
              contactRadius,
              contactDamage,
              burstRadius,
              burstDamage,
              stunChance,
              headStunChance: options.hitStunChances?.head ?? stunChance,
              vulnerabilityChance: palmVulnerabilityChance,
              visualType,
              hand
            }));
          } else {
            const maxSteps = Math.max(1, Math.ceil((GameRuntimeState.radius * 2 + 1) / 2));
            maxTravelDelay = Math.max(maxTravelDelay, small.delay + maxSteps * fistStepMs);
            GameRuntimeState.projectiles.push({
              kind: "lobsterPalmSetup",
              owner,
              profile: "big",
              target: { q: target.q, r: target.r },
              direction,
              visualType,
              hand,
              hidden: true,
              createdAt: now + volleyDelay,
              impactAt: now + volleyDelay,
              delay: 0,
              smallDelay: small.delay,
              fistStepMs,
              radius: contactRadius,
              damage: contactDamage,
              burstRadius,
              burstDamage,
              stunChance,
              headStunChance: options.hitStunChances?.head ?? stunChance,
              vulnerabilityChance: palmVulnerabilityChance
            });
          }
        }
        return maxTravelDelay + (volleys - 1) * volleyIntervalMs;
      }

      if (character.id === "moray") {
        const lineOrigin = options.aimOrigin || target;
        const lineCells = boardLineThrough(lineOrigin, direction);
        const lineShape = bandShapeFromTotalWidth(small.radius);
        const excludedCells = (owner === "player" ? GameRuntimeState.snake : GameRuntimeState.computerSnake).map(segment => ({ q: segment.q, r: segment.r }));
        const durationMs = GameConfig.baseAttackDelayMs * GameConfig.smallAttackDelayScale * Math.max(1, GameAI.ultimateSetting(character.id, "durationBaseTicks", 4));
        const tickMs = Math.max(1, small.delay);
        const damage = bigDamage * GameAI.ultimateSetting(character.id, "damageMultiplier", 0.24);
        GameRuntimeState.projectiles.push({
          kind: "lineHazardSetup",
          owner,
          profile: "big",
          source: { q: source.q, r: source.r },
          target: { q: target.q, r: target.r },
          lineCells,
          excludedCells,
          width: lineShape.width,
          fullDamageWidth: lineShape.fullDamageWidth,
          outerDamageMultiplier: lineShape.outerDamageMultiplier,
          visualType: attackVisualType(owner, "big"),
          createdAt: now,
          impactAt: now + tickMs,
          delay: tickMs,
          tickMs,
          fieldStartedAt: now,
          fieldEndAt: now + durationMs,
          damage,
          stunChance,
          headStunChance: options.hitStunChances?.head ?? stunChance,
          stackStun: true
        });
        return durationMs;
      }

      if (character.id === "quetzal") {
        const trail = (owner === "player" ? GameRuntimeState.snake : GameRuntimeState.computerSnake).map(segment => ({ q: segment.q, r: segment.r }));
        const duration = 3000;
        const extensionDamageMultiplier = Math.max(0, Math.min(1, (stock.protein || 0) / GameConfig.maxFoodStock));
        const outwardWidth = extensionDamageMultiplier > 0 ? 1 : 0;
        const tickMs = GameAI.ultimateSetting(character.id, "tickMs", GameConfig.baseStepMs);
        const slowDurationMs = GameAI.ultimateSetting(character.id, "slowDurationMs", 2000);
        GameRuntimeState.hazards.push({
          kind: "swamp",
          owner,
          cells: trail,
          damageExcludedCells: trail,
          visualExcludedCells: [],
          width: outwardWidth,
          minDistance: 0,
          outerDamageMultiplier: extensionDamageMultiplier,
          visualType: attackVisualType(owner, "big"),
          damage: bigDamage * GameAI.ultimateDamageMultiplier(character.id),
          stunChance,
          headStunChance: options.hitStunChances?.head ?? stunChance,
          stunTicksRemaining: 1,
          slowChance: 1,
          slowStack: false,
          slowDurationMs,
          startedAt: now + small.delay,
          nextTickAt: now + small.delay,
          tickMs,
          endAt: now + small.delay + duration
        });
        return small.delay + duration;
      }

      if (character.id === "sandworm") {
        const armorFrom = now + small.delay * GameAI.ultimateSetting(character.id, "superArmorDelayMultiplier", 1);
        const armorUntil = armorFrom + GameAI.ultimateSetting(character.id, "superArmorDurationMs", 3000);
        const undergroundFrom = now + small.delay * GameAI.ultimateSetting(character.id, "invisibleDelayMultiplier", 2);
        const undergroundUntil = undergroundFrom + GameAI.ultimateSetting(character.id, "invisibleDurationMs", 1500);
        const delay = small.delay * GameAI.ultimateSetting(character.id, "impactDelayMultiplier", 3);
        if (owner === "player") {
          GameRuntimeState.playerSandwormArmorFrom = armorFrom;
          GameRuntimeState.playerSandwormArmorUntil = Math.max(GameRuntimeState.playerSandwormArmorUntil, armorUntil);
          GameRuntimeState.playerUndergroundFrom = undergroundFrom;
          GameRuntimeState.playerUndergroundUntil = Math.max(GameRuntimeState.playerUndergroundUntil, undergroundUntil);
        } else {
          GameRuntimeState.computerSandwormArmorFrom = armorFrom;
          GameRuntimeState.computerSandwormArmorUntil = Math.max(GameRuntimeState.computerSandwormArmorUntil, armorUntil);
          GameRuntimeState.computerUndergroundFrom = undergroundFrom;
          GameRuntimeState.computerUndergroundUntil = Math.max(GameRuntimeState.computerUndergroundUntil, undergroundUntil);
        }
        pushCircleAttack({
          owner,
          profile: "big",
          source,
          target,
          createdAt: now,
          impactAt: now + delay,
          delay,
          radius: Math.max(0.5, small.radius * 0.5),
          damage: bigDamage * GameAI.ultimateSetting(character.id, "damageMultiplier", 7),
          stunChance,
          headStunChance: options.hitStunChances?.head ?? stunChance,
          hidden: true,
          sandwormHidden: true,
          sandwormParalyzeOnBody: true,
          sandwormKillOnHead: true
        });
        return delay;
      }

      if (character.id === "dragon") {
        const spiritRadius = small.radius * GameAI.ultimateSetting(character.id, "radiusMultiplier", 2);
        const impactDamage = bigDamage * GameAI.ultimateSetting(character.id, "impactDamageMultiplier", 1.08);
        const radiationTotalDamage = bigDamage * GameAI.ultimateSetting(character.id, "radiationDamageMultiplier", 2);
        const radiationDurationMs = GameAI.ultimateSetting(character.id, "radiationDurationMs", 4000);
        const radiationTickMs = GameAI.ultimateSetting(character.id, "radiationTickMs", 500);
        const firstImpactDelay = small.delay * GameAI.ultimateSetting(character.id, "firstImpactDelayMultiplier", 2);
        const visualType = "dragon-spirit-big";
        const volleys = 1;
        for (let index = 0; index < volleys; index += 1) {
          const impactDelay = firstImpactDelay + index * 2000;
          GameRuntimeState.projectiles.push({
            kind: "headCircle",
            owner,
            profile: "big",
            source: { q: source.q, r: source.r },
            target: { q: target.q, r: target.r },
            createdAt: now,
            impactAt: now + impactDelay,
            delay: impactDelay,
            radius: spiritRadius,
            damage: impactDamage,
            radiationDurationMs,
            radiationTickMs,
            radiationTotalDamage,
            stunChance,
            headStunChance: options.hitStunChances?.head ?? stunChance,
            flat: true,
            ignoreCasterInterrupt: true,
            visualType
          });
        }
        return firstImpactDelay + (volleys - 1) * 2000;
      }

      if (character.id === "gu_king") {
        const volleyIntervalMs = small.delay;
        const firstImpactDelay = small.delay;
        const targetSnake = owner === "player" ? GameRuntimeState.computerSnake : GameRuntimeState.snake;
        const damage = bigDamage * GameAI.ultimateSetting(character.id, "damageMultiplier", 1.414);
        let waveTarget = { q: target.q, r: target.r };
        for (let index = 0; index < 3; index += 1) {
          const impactDelay = firstImpactDelay + index * volleyIntervalMs;
          waveTarget = guKingBestDamageStep(waveTarget, targetSnake, small.radius, damage);
          pushCircleAttack({
            owner,
            profile: "big",
            target: waveTarget,
            createdAt: now,
            impactAt: now + impactDelay,
            delay: impactDelay,
            radius: small.radius,
            damage,
            stunChance,
            headStunChance: options.hitStunChances?.head ?? stunChance
          });
        }
        return firstImpactDelay + volleyIntervalMs * 2;
      }

      const big = attackStats(stock, "big");
      pushCircleAttack({ owner, profile: "big", target, createdAt: now, impactAt: now + big.delay, delay: big.delay, radius: big.radius, damage: big.damage * GameAI.ultimateDamageMultiplier(character.id), stunChance, headStunChance: options.hitStunChances?.head ?? stunChance });
      return big.delay;
    }

    function launchAttack(owner, target, now, profile = "big", options = {}) {
      const stock = owner === "player" ? GameRuntimeState.playerStock : GameRuntimeState.computerStock;
      const lastAttack = GameUI.lastAttackMsFor(owner, profile);
      const source = owner === "player" ? GameRuntimeState.snake[0] : GameRuntimeState.computerSnake[0];
      const character = GameUI.characterFor(owner);
      const isSmall = profile === "small";
      if (!GameUI.canAttack(owner, profile)) return false;
      if (now - lastAttack < GameUI.attackProfileCooldown(stock, profile, character.id)) return false;
      const stats = attackStats(stock, profile);
      const hitStunChances = attackHitStunChances(stock);
      const stunChance = hitStunChances.body;
      const vulnerabilityChance = !isSmall && character.id === "lobster"
        ? lobsterPalmVulnerabilityChance(stock)
        : 0;
      GameUI.consumeAttackCost(owner, stock, profile);
      if (owner === "player") {
        GameUI.setLastAttackMsFor(owner, profile, now);
        GameRuntimeState.playerBombFlashUntil = now + 1200;
      } else {
        GameUI.setLastAttackMsFor(owner, profile, now);
        GameRuntimeState.computerBombFlashUntil = now + 1200;
      }
      GameAudio.playCharacter(owner, isSmall ? "small" : "big");
      const poseDuration = isSmall
        ? stats.delay
        : scheduleCharacterBigAttack(owner, character, source, target, now, stock, stunChance, { ...options, vulnerabilityChance, hitStunChances });
      if (isSmall) {
        GameRuntimeState.projectiles.push({
          kind: "circle",
          owner,
          profile,
          visualType: attackVisualType(owner, profile),
          source: { q: source.q, r: source.r },
          target: { q: target.q, r: target.r },
          createdAt: now,
          impactAt: now + stats.delay,
          delay: stats.delay,
          radius: stats.radius,
          damage: stats.damage,
          stunChance,
          headStunChance: hitStunChances.head
        });
      }
      GameUI.setFighterPose(owner, "attack", Math.max(180, Math.min(poseDuration, 520)));
      GameUI.showAttackCallout(owner, profile);
      updateHud();
      return true;
    }

    function damageSnake(parts, target, radius, damageScale) {
      return parts.reduce((total, segment) => {
        const multiplier = circleDamageMultiplier(hexDistance(segment, target), radius);
        return total + damageScale * multiplier;
      }, 0);
    }

    function circleDamageMultiplier(distance, radius) {
      if (!Number.isFinite(radius) || radius <= 0) return distance === 0 ? 1 : 0;
      return Math.max(0, Math.min(1, 1 - distance / radius));
    }

    function circleAttackHitsHead(parts, target, radius) {
      const head = parts[0];
      return Boolean(head && target && circleDamageMultiplier(hexDistance(head, target), radius) > 0);
    }

    function stunChanceForHeadHit(hitHead, projectile) {
      return hitHead ? projectile.headStunChance ?? projectile.stunChance : projectile.stunChance;
    }

    function damageSnakeCells(parts, effectCells, width, damageScale, excludedCells = [], minDistance = 0, outerDamageMultiplier = 1, fullDamageWidth = 0) {
      const excluded = cellKeySet(excludedCells);
      return parts.reduce((total, segment) => {
        if (excluded.has(keyOf(segment))) return total;
        const bestMultiplier = effectCells.reduce((bestValue, cell) => {
          const distance = hexDistance(segment, cell);
          if (distance < minDistance || distance > width) return bestValue;
          return Math.max(bestValue, lineBandDamageMultiplier(distance, { width, fullDamageWidth, outerDamageMultiplier }));
        }, 0);
        return bestMultiplier > 0 ? total + damageScale * bestMultiplier : total;
      }, 0);
    }

    function lineProjectileHitsHead(parts, projectile) {
      const head = parts[0];
      if (!head) return false;
      if (cellKeySet(projectile.excludedCells || []).has(keyOf(head))) return false;
      return (projectile.lineCells || []).some(cell => {
        const distance = hexDistance(head, cell);
        if (distance < (projectile.minDistance || 0) || distance > (projectile.width || 0)) return false;
        return lineBandDamageMultiplier(distance, {
          width: projectile.width || 0,
          fullDamageWidth: projectile.fullDamageWidth || 0,
          outerDamageMultiplier: projectile.outerDamageMultiplier ?? 1
        }) > 0;
      });
    }

    function lineProjectileStunChance(parts, projectile) {
      return stunChanceForHeadHit(lineProjectileHitsHead(parts, projectile), projectile);
    }

    function effectCellsHitHead(parts, effectCells = [], width = 0, excludedCells = [], minDistance = 0, outerDamageMultiplier = 1, fullDamageWidth = 0) {
      const head = parts[0];
      if (!head) return false;
      if (cellKeySet(excludedCells || []).has(keyOf(head))) return false;
      return effectCells.some(cell => {
        const distance = hexDistance(head, cell);
        if (distance < minDistance || distance > width) return false;
        return lineBandDamageMultiplier(distance, { width, fullDamageWidth, outerDamageMultiplier }) > 0;
      });
    }

    function hazardHitsHead(parts, hazard, excludedCells = []) {
      if (hazard.kind === "radiation") return circleAttackHitsHead(parts, hazard.target, hazard.radius);
      return effectCellsHitHead(
        parts,
        hazard.cells || hazard.lineCells || [],
        hazard.width || 0,
        excludedCells,
        hazard.minDistance || 0,
        hazard.outerDamageMultiplier ?? 1,
        hazard.fullDamageWidth || 0
      );
    }

    function snakeBodyHitAtCenter(parts, target) {
      return parts.slice(1).some(segment => keyOf(segment) === keyOf(target));
    }

    function snakeHeadHitAtCenter(parts, target) {
      return Boolean(parts[0] && keyOf(parts[0]) === keyOf(target));
    }

    function isOwnerVulnerable(owner) {
      return owner === "player" ? GameRuntimeState.playerVulnerable : GameRuntimeState.computerVulnerable;
    }

    function setOwnerVulnerable(owner, vulnerable) {
      if (owner === "player") GameRuntimeState.playerVulnerable = vulnerable;
      else GameRuntimeState.computerVulnerable = vulnerable;
    }

    function applyBlastDamage(owner, damage, now = performance.now()) {
      if (damage <= 0) return;
      if (isOwnerDamageImmune(owner, now)) return;
      const finalDamage = isOwnerVulnerable(owner) ? damage * 2 : damage;
      if (isOwnerVulnerable(owner)) setOwnerVulnerable(owner, false);
      if (owner === "player") {
        GameRuntimeState.playerHp = Math.max(0, GameRuntimeState.playerHp - finalDamage);
      } else {
        GameRuntimeState.computerHp = Math.max(0, GameRuntimeState.computerHp - finalDamage);
      }
    }

    function interruptCasting(owner) {
      const beforeCount = GameRuntimeState.projectiles.length;
      GameRuntimeState.projectiles = GameRuntimeState.projectiles.filter(projectile => projectile.owner !== owner || projectile.ignoreCasterInterrupt);
      return GameRuntimeState.projectiles.length !== beforeCount;
    }

    function applyAttackStun(owner, chance = GameConfig.baseAttackStunChance, now = performance.now(), options = {}) {
      if (Math.random() >= chance) return false;
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      const interrupted = options.interrupt !== false && interruptCasting(owner);
      const currentStunUntil = owner === "player" ? GameRuntimeState.playerStunUntil : GameRuntimeState.computerStunUntil;
      const stunBase = options.stack ? Math.max(now, currentStunUntil) : now;
      const stunUntil = stunBase + GameConfig.attackStunMs;
      const slowUntil = stunUntil + GameConfig.attackSlowMs;
      if (owner === "player") {
        GameRuntimeState.playerStunUntil = Math.max(GameRuntimeState.playerStunUntil, stunUntil);
        GameRuntimeState.playerSlowUntil = Math.max(GameRuntimeState.playerSlowUntil, slowUntil);
      } else {
        GameRuntimeState.computerStunUntil = Math.max(GameRuntimeState.computerStunUntil, stunUntil);
        GameRuntimeState.computerSlowUntil = Math.max(GameRuntimeState.computerSlowUntil, slowUntil);
      }
      GameUI.showStatusCallout(owner, interrupted ? "暈眩！招式中斷" : "暈眩！", { interrupted });
      return true;
    }

    function applyAttackSlow(owner, chance = 1, durationMs = 2000, now = performance.now(), options = {}) {
      if (Math.random() >= chance) return false;
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      const currentSlowUntil = owner === "player" ? GameRuntimeState.playerSlowUntil : GameRuntimeState.computerSlowUntil;
      const slowUntil = options.stack === false && currentSlowUntil > now
        ? currentSlowUntil
        : Math.max(currentSlowUntil, now + durationMs);
      if (owner === "player") {
        GameRuntimeState.playerSlowUntil = slowUntil;
      } else {
        GameRuntimeState.computerSlowUntil = slowUntil;
      }
      return true;
    }

    function applyVulnerability(owner, chance = GameConfig.baseAttackStunChance, now = performance.now()) {
      if (Math.random() >= chance) return false;
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      setOwnerVulnerable(owner, true);
      GameUI.showStatusCallout(owner, "易傷");
      return true;
    }

    function applyCollisionPenalty(owner, severity = 1, now = performance.now()) {
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      const interrupted = interruptCasting(owner);
      const stunUntil = now + GameConfig.collisionStunMs * severity;
      const slowUntil = stunUntil + GameConfig.collisionSlowMs * severity;
      if (owner === "player") {
        GameRuntimeState.playerStunUntil = Math.max(GameRuntimeState.playerStunUntil, stunUntil);
        GameRuntimeState.playerSlowUntil = Math.max(GameRuntimeState.playerSlowUntil, slowUntil);
        GameRuntimeState.playerCollisionParalysisMs += GameConfig.collisionStunMs * severity;
        if (interrupted) GameUI.showStatusCallout(owner, severity > 1 ? "重度麻痺！招式中斷" : "麻痺！招式中斷", { interrupted });
        return GameRuntimeState.playerCollisionParalysisMs > GameConfig.maxCollisionParalysisMs;
      } else {
        GameRuntimeState.computerStunUntil = Math.max(GameRuntimeState.computerStunUntil, stunUntil);
        GameRuntimeState.computerSlowUntil = Math.max(GameRuntimeState.computerSlowUntil, slowUntil);
        GameRuntimeState.computerCollisionParalysisMs += GameConfig.collisionStunMs * severity;
        if (interrupted) GameUI.showStatusCallout(owner, severity > 1 ? "重度麻痺！招式中斷" : "麻痺！招式中斷", { interrupted });
        return GameRuntimeState.computerCollisionParalysisMs > GameConfig.maxCollisionParalysisMs;
      }
    }

    function applyCollisionParalysis(owner, now = performance.now()) {
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      const interrupted = interruptCasting(owner);
      const stunUntil = now + GameConfig.collisionStunMs;
      const slowUntil = stunUntil + GameConfig.collisionSlowMs;
      if (owner === "player") {
        GameRuntimeState.playerStunUntil = Math.max(GameRuntimeState.playerStunUntil, stunUntil);
        GameRuntimeState.playerSlowUntil = Math.max(GameRuntimeState.playerSlowUntil, slowUntil);
      } else {
        GameRuntimeState.computerStunUntil = Math.max(GameRuntimeState.computerStunUntil, stunUntil);
        GameRuntimeState.computerSlowUntil = Math.max(GameRuntimeState.computerSlowUntil, slowUntil);
      }
      if (interrupted) GameUI.showStatusCallout(owner, "麻痺！招式中斷", { interrupted });
      return true;
    }

    function collisionSeverity(selfHit, opponentHit) {
      if (selfHit) return 2;
      if (opponentHit) return 1;
      return 0;
    }

    function resolveProjectiles(now) {
      const landed = GameRuntimeState.projectiles.filter(projectile => now >= projectile.impactAt);
      if (!landed.length) return;
      GameRuntimeState.projectiles = GameRuntimeState.projectiles.filter(projectile => now < projectile.impactAt);

      landed.forEach(projectile => {
        let playerDamage = 0;
        let computerDamage = 0;
        let playerStunChance = projectile.stunChance;
        let computerStunChance = projectile.stunChance;
        if (projectile.kind === "lineHazardSetup") {
          GameRuntimeState.hazards.push({
            kind: "lineHazard",
            owner: projectile.owner,
            cells: projectile.lineCells,
            damageExcludedCells: projectile.excludedCells,
            visualExcludedCells: projectile.excludedCells,
            width: projectile.width,
            minDistance: projectile.minDistance || 0,
            fullDamageWidth: projectile.fullDamageWidth || 0,
            outerDamageMultiplier: projectile.outerDamageMultiplier ?? 1,
            visualType: projectile.visualType,
            damage: projectile.damage,
            profile: projectile.profile,
            stunChance: projectile.stunChance,
            headStunChance: projectile.headStunChance,
            stackStun: projectile.stackStun,
            startedAt: projectile.fieldStartedAt ?? now,
            nextTickAt: now,
            tickMs: projectile.tickMs,
            endAt: projectile.fieldEndAt ?? now
          });
          return;
        } else if (projectile.kind === "lobsterPalmSetup") {
          const source = GameAI.ownerHead(projectile.owner);
          if (source) {
            scheduleLobsterPalmVolley({
              owner: projectile.owner,
              source,
              direction: Number.isInteger(projectile.direction) ? projectile.direction : ownerDirection(projectile.owner),
              targetSnake: projectile.owner === "player" ? GameRuntimeState.computerSnake : GameRuntimeState.snake,
              now,
              smallDelay: projectile.smallDelay,
              fistStepMs: projectile.fistStepMs,
              contactRadius: projectile.radius,
              contactDamage: projectile.damage,
              burstRadius: projectile.burstRadius,
              burstDamage: projectile.burstDamage,
              stunChance: projectile.stunChance,
              headStunChance: projectile.headStunChance,
              vulnerabilityChance: projectile.vulnerabilityChance,
              visualType: projectile.visualType,
              hand: projectile.hand
            });
          }
          return;
        } else if (projectile.kind === "lobsterPalm") {
          return;
        } else if (projectile.kind === "lobsterPalmBurst") {
          const defenderOwner = projectile.owner === "player" ? "computer" : "player";
          const defenderSnake = defenderOwner === "player" ? GameRuntimeState.snake : GameRuntimeState.computerSnake;
          const contactDamage = damageSnake(defenderSnake, projectile.target, projectile.radius, projectile.damage);
          if (defenderOwner === "player") playerDamage += contactDamage;
          else computerDamage += contactDamage;
          playerDamage += damageSnake(GameRuntimeState.snake, projectile.target, projectile.burstRadius, projectile.burstDamage);
          computerDamage += damageSnake(GameRuntimeState.computerSnake, projectile.target, projectile.burstRadius, projectile.burstDamage);
          const playerHeadHit = (defenderOwner === "player" && projectile.damage > 0 && circleAttackHitsHead(GameRuntimeState.snake, projectile.target, projectile.radius))
            || (projectile.burstDamage > 0 && circleAttackHitsHead(GameRuntimeState.snake, projectile.target, projectile.burstRadius));
          const computerHeadHit = (defenderOwner === "computer" && projectile.damage > 0 && circleAttackHitsHead(GameRuntimeState.computerSnake, projectile.target, projectile.radius))
            || (projectile.burstDamage > 0 && circleAttackHitsHead(GameRuntimeState.computerSnake, projectile.target, projectile.burstRadius));
          playerStunChance = stunChanceForHeadHit(playerHeadHit, projectile);
          computerStunChance = stunChanceForHeadHit(computerHeadHit, projectile);
          addProjectileBlastVisual(projectile, now);
        } else if (projectile.kind === "line") {
          playerDamage = damageSnakeCells(GameRuntimeState.snake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells, 0, projectile.outerDamageMultiplier ?? 1, projectile.fullDamageWidth ?? 0);
          computerDamage = damageSnakeCells(GameRuntimeState.computerSnake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells, 0, projectile.outerDamageMultiplier ?? 1, projectile.fullDamageWidth ?? 0);
          playerStunChance = lineProjectileStunChance(GameRuntimeState.snake, projectile);
          computerStunChance = lineProjectileStunChance(GameRuntimeState.computerSnake, projectile);
          addProjectileBlastVisual(projectile, now);
        } else {
          const radiationDamage = projectile.kind === "headCircle" && projectile.radiationDurationMs
            ? projectile.radiationTotalDamage / Math.max(1, Math.ceil(projectile.radiationDurationMs / projectile.radiationTickMs))
            : 0;
          const { explosionTarget, radius } = addProjectileBlastVisual(projectile, now, { radiationDamage });
          const damage = projectile.damage || 1;
          playerDamage = damageSnake(GameRuntimeState.snake, explosionTarget, radius, damage);
          computerDamage = damageSnake(GameRuntimeState.computerSnake, explosionTarget, radius, damage);
          playerStunChance = stunChanceForHeadHit(circleAttackHitsHead(GameRuntimeState.snake, explosionTarget, radius), projectile);
          computerStunChance = stunChanceForHeadHit(circleAttackHitsHead(GameRuntimeState.computerSnake, explosionTarget, radius), projectile);
          if (projectile.sandwormParalyzeOnBody || projectile.sandwormKillOnHead) {
            if (projectile.owner !== "player") {
              if (projectile.sandwormKillOnHead && snakeHeadHitAtCenter(GameRuntimeState.snake, explosionTarget)) playerDamage = Math.max(playerDamage, GameRuntimeState.playerHp);
              else if (projectile.sandwormParalyzeOnBody && snakeBodyHitAtCenter(GameRuntimeState.snake, explosionTarget)) applyCollisionParalysis("player", now);
            }
            if (projectile.owner !== "computer") {
              if (projectile.sandwormKillOnHead && snakeHeadHitAtCenter(GameRuntimeState.computerSnake, explosionTarget)) computerDamage = Math.max(computerDamage, GameRuntimeState.computerHp);
              else if (projectile.sandwormParalyzeOnBody && snakeBodyHitAtCenter(GameRuntimeState.computerSnake, explosionTarget)) applyCollisionParalysis("computer", now);
            }
          }
        }
        if (projectile.owner === "player") playerDamage = 0;
        if (projectile.owner === "computer") computerDamage = 0;
        if (isOwnerDamageImmune("player", now)) playerDamage = 0;
        if (isOwnerDamageImmune("computer", now)) computerDamage = 0;
        triggerSmallHitShake(projectile, playerDamage, computerDamage, now);
        applyBlastDamage("player", playerDamage, now);
        applyBlastDamage("computer", computerDamage, now);
        if (projectile.owner !== "player" && playerDamage > 0) applyAttackStun("player", playerStunChance, now, { stack: projectile.stackStun });
        if (projectile.owner !== "computer" && computerDamage > 0) applyAttackStun("computer", computerStunChance, now, { stack: projectile.stackStun });
        if (projectile.owner !== "player" && playerDamage > 0 && projectile.vulnerabilityChance > 0) applyVulnerability("player", projectile.vulnerabilityChance, now);
        if (projectile.owner !== "computer" && computerDamage > 0 && projectile.vulnerabilityChance > 0) applyVulnerability("computer", projectile.vulnerabilityChance, now);
      });
      GameRuntimeState.blasts = GameRuntimeState.blasts.filter(blast => now <= blast.endAt);
      if (GameRuntimeState.playerHp <= 0 || GameRuntimeState.computerHp <= 0) endGame(GameRuntimeState.playerHp <= 0, GameRuntimeState.computerHp <= 0);
    }

    function addProjectileBlastVisual(projectile, now, options = {}) {
      if (projectile.kind === "lobsterPalmSetup") return {};
      if (projectile.kind === "lobsterPalm") return {};
      if (projectile.kind === "lobsterPalmBurst") {
        const visualType = burstVisualType(projectile);
        GameRuntimeState.blasts.push({
          kind: "circle",
          target: projectile.target,
          owner: projectile.owner,
          radius: projectile.burstRadius,
          visualType,
          hand: projectile.hand,
          startedAt: now,
          endAt: now + GameConfig.blastDurationMs * 1.25
        });
        GameRender.triggerBoardShake(visualType, now);
        return { visualType };
      }
      if (projectile.kind === "lineHazardSetup") {
        const visualType = projectile.visualType || attackVisualType(projectile.owner, projectile.profile);
        GameRuntimeState.blasts.push({
          kind: "line",
          lineCells: projectile.lineCells,
          excludedCells: projectile.excludedCells,
          width: projectile.width,
          fullDamageWidth: projectile.fullDamageWidth,
          outerDamageMultiplier: projectile.outerDamageMultiplier,
          target: projectile.target,
          owner: projectile.owner,
          visualType,
          startedAt: now,
          endAt: now + GameConfig.blastDurationMs
        });
        GameRender.triggerBoardShake(visualType, now);
        return { visualType };
      }
      if (projectile.kind === "line") {
        const visualType = projectile.visualType || attackVisualType(projectile.owner, projectile.profile);
        GameRuntimeState.blasts.push({
          kind: "line",
          lineCells: projectile.lineCells,
          excludedCells: projectile.excludedCells,
          width: projectile.width,
          fullDamageWidth: projectile.fullDamageWidth,
          outerDamageMultiplier: projectile.outerDamageMultiplier,
          target: projectile.target,
          owner: projectile.owner,
          visualType,
          startedAt: now,
          endAt: now + GameConfig.blastDurationMs
        });
        GameRender.triggerBoardShake(visualType, now);
        return { visualType };
      }
      if (projectile.kind === "headCircle" && projectile.followHead) {
        const head = GameAI.ownerHead(projectile.owner);
        projectile.explosionTarget = { q: head.q, r: head.r };
        projectile.target = { q: projectile.explosionTarget.q, r: projectile.explosionTarget.r };
      }
      const explosionTarget = projectile.explosionTarget || projectile.target;
      const explosionRadius = projectile.radius || GameConfig.baseBlastHexRadius;
      const visualType = projectile.visualType || attackVisualType(projectile.owner, projectile.profile);
      GameRuntimeState.blasts.push({
        kind: "circle",
        target: explosionTarget,
        owner: projectile.owner,
        radius: explosionRadius,
        visualType,
        hand: projectile.hand,
        startedAt: now,
        endAt: now + GameConfig.blastDurationMs
      });
      GameRender.triggerBoardShake(visualType, now);
      if (projectile.kind === "headCircle" && projectile.radiationDurationMs) {
        GameRuntimeState.hazards.push({
          kind: "radiation",
          owner: projectile.owner,
          target: { q: explosionTarget.q, r: explosionTarget.r },
          radius: explosionRadius,
          width: explosionRadius,
          visualType: projectile.visualType === "dragon-spirit-big" ? "dragon-spirit-radiation" : "lobster-radiation",
          damage: options.radiationDamage ?? 0,
          stunChance: 0,
          startedAt: now,
          nextTickAt: now + projectile.radiationTickMs,
          tickMs: projectile.radiationTickMs,
          endAt: now + projectile.radiationDurationMs
        });
      }
      return { explosionTarget, radius: explosionRadius, visualType };
    }

    function addProjectileImpactVisual(projectile, now) {
      addProjectileBlastVisual(projectile, now);
    }

    function advanceGameOverVisuals(now) {
      const landed = GameRuntimeState.projectiles.filter(projectile => now >= projectile.impactAt);
      if (landed.length) {
        GameRuntimeState.projectiles = GameRuntimeState.projectiles.filter(projectile => now < projectile.impactAt);
        landed.forEach(projectile => addProjectileImpactVisual(projectile, now));
      }
      GameRuntimeState.blasts = GameRuntimeState.blasts.filter(blast => now <= blast.endAt);
      GameRuntimeState.hazards = GameRuntimeState.hazards.filter(hazard => now <= hazard.endAt);
      GameRuntimeState.hazards.forEach(hazard => {
        if (now < hazard.startedAt || hazard.shaken) return;
        GameRender.triggerBoardShake(hazard.visualType || attackVisualType(hazard.owner, "big"), now);
        hazard.shaken = true;
      });
      const projectilesActive = GameRuntimeState.projectiles.some(projectile => now < projectile.impactAt);
      const blastsActive = GameRuntimeState.blasts.some(blast => now <= blast.endAt);
      const continuousSkillVisualsActive = GameRuntimeState.hazards.some(hazard => now <= hazard.endAt);
      const boardShakeActive = now < GameRuntimeState.boardShakeUntil;
      if (
        continuousSkillVisualsActive
        && GameRuntimeState.gameOverContinuousVisualDeadlineAt
        && now >= GameRuntimeState.gameOverContinuousVisualDeadlineAt
        && !projectilesActive
        && !blastsActive
        && !boardShakeActive
      ) {
        return false;
      }
      return projectilesActive || blastsActive || continuousSkillVisualsActive || boardShakeActive;
    }

    function showGameOverSettlement() {
      GameRuntimeState.gameOverSettlementPending = false;
      GameRuntimeState.gameOverLogoTransitionEndsAt = 0;
      if (!GameRuntimeState.gameOver || GameRuntimeState.running || GameReplay.isPlaybackMode()) return;
      GameUI.hideCharacterStage();
      GameUI.clearLogoTransition();
      GameUI.renderWinnerPortrait(GameRuntimeState.gameOverResultOwner, GameRuntimeState.gameOverPlayerLost, GameRuntimeState.gameOverComputerLost);
      Dom.overlay.classList.add("show");
      if (GameRuntimeState.gameOverRelayStartOptions) {
        const nextOptions = GameRuntimeState.gameOverRelayStartOptions;
        GameRuntimeState.gameOverRelayStartOptions = null;
        GameRuntimeState.relayRestartTimer = setTimeout(() => {
          GameRuntimeState.relayRestartTimer = null;
          if (!GameRuntimeState.relayMode) return;
          startGame(nextOptions);
        }, Math.max(900, GameConfig.gameOverRestartDelayMs + 80));
      }
    }

    function resolveHazards(now) {
      const activeHazards = GameRuntimeState.hazards.filter(hazard => now <= hazard.endAt);
      GameRuntimeState.hazards = activeHazards;
      activeHazards.forEach(hazard => {
        if (now < hazard.startedAt || now < hazard.nextTickAt) return;
        if (!hazard.shaken) {
          GameRender.triggerBoardShake(hazard.visualType || attackVisualType(hazard.owner, "big"), now);
          hazard.shaken = true;
        }
        hazard.nextTickAt = now + hazard.tickMs;
        const damageExcludedCells = hazard.damageExcludedCells || hazard.excludedCells || [];
        let playerDamage = hazard.kind === "radiation"
          ? damageSnake(GameRuntimeState.snake, hazard.target, hazard.radius, hazard.damage)
          : damageSnakeCells(GameRuntimeState.snake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "player" ? damageExcludedCells : [], hazard.minDistance || 0, hazard.outerDamageMultiplier ?? 1, hazard.fullDamageWidth || 0);
        let computerDamage = hazard.kind === "radiation"
          ? damageSnake(GameRuntimeState.computerSnake, hazard.target, hazard.radius, hazard.damage)
          : damageSnakeCells(GameRuntimeState.computerSnake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "computer" ? damageExcludedCells : [], hazard.minDistance || 0, hazard.outerDamageMultiplier ?? 1, hazard.fullDamageWidth || 0);
        const playerStunChance = stunChanceForHeadHit(
          hazardHitsHead(GameRuntimeState.snake, hazard, hazard.owner === "player" ? damageExcludedCells : []),
          hazard
        );
        const computerStunChance = stunChanceForHeadHit(
          hazardHitsHead(GameRuntimeState.computerSnake, hazard, hazard.owner === "computer" ? damageExcludedCells : []),
          hazard
        );
        const canApplyStun = (hazard.stunTicksRemaining ?? Infinity) > 0;
        if (hazard.owner === "player") playerDamage = 0;
        if (hazard.owner === "computer") computerDamage = 0;
        if (isOwnerDamageImmune("player", now)) playerDamage = 0;
        if (isOwnerDamageImmune("computer", now)) computerDamage = 0;
        applyBlastDamage("player", playerDamage, now);
        applyBlastDamage("computer", computerDamage, now);
        if (hazard.owner !== "player" && playerDamage > 0 && hazard.slowChance > 0) {
          applyAttackSlow("player", hazard.slowChance, hazard.slowDurationMs ?? 2000, now, { stack: hazard.slowStack });
        }
        if (hazard.owner !== "computer" && computerDamage > 0 && hazard.slowChance > 0) {
          applyAttackSlow("computer", hazard.slowChance, hazard.slowDurationMs ?? 2000, now, { stack: hazard.slowStack });
        }
        if (canApplyStun && hazard.owner !== "player" && playerDamage > 0) {
          applyAttackStun("player", playerStunChance, now, { interrupt: false, stack: hazard.stackStun });
        }
        if (canApplyStun && hazard.owner !== "computer" && computerDamage > 0) {
          applyAttackStun("computer", computerStunChance, now, { interrupt: false, stack: hazard.stackStun });
        }
        if (Number.isFinite(hazard.stunTicksRemaining)) {
          hazard.stunTicksRemaining = Math.max(0, hazard.stunTicksRemaining - 1);
        }
      });
      if (GameRuntimeState.playerHp <= 0 || GameRuntimeState.computerHp <= 0) endGame(GameRuntimeState.playerHp <= 0, GameRuntimeState.computerHp <= 0);
    }

    function advanceOwnerMovement(owner, next, eatenFood) {
      const parts = owner === "player" ? GameRuntimeState.snake : GameRuntimeState.computerSnake;
      const ate = Boolean(eatenFood);
      parts.unshift(next);
      if (!ate) {
        parts.pop();
        return null;
      }

      if (owner === "player") {
        GameRuntimeState.score += 1;
        GameUI.collectFood("player", eatenFood);
        GameRuntimeState.best = Math.max(GameRuntimeState.best, GameRuntimeState.score);
        GameStorage.set("hexSnakeBest", String(GameRuntimeState.best));
        GameRuntimeState.lastFeedElapsedMs = 0;
        GameRuntimeState.lastPlayerFoodAt = performance.now();
        GameRuntimeState.playerFoodTargetKey = null;
        GameRuntimeState.playerFoodTargetAt = 0;
        GameRuntimeState.playerHp = Math.min(GameUI.maxHpForSnake(GameRuntimeState.snake), GameRuntimeState.playerHp + GameUI.foodHealAmount());
      } else {
        GameRuntimeState.computerScore += 1;
        GameRuntimeState.lastComputerFoodAt = performance.now();
        GameRuntimeState.computerFoodTargetKey = null;
        GameRuntimeState.computerFoodTargetAt = 0;
        if (GameAI.computerCanGrow()) {
          GameUI.collectFood("computer", eatenFood);
          GameRuntimeState.computerHp = Math.min(GameUI.maxHpForSnake(GameRuntimeState.computerSnake), GameRuntimeState.computerHp + GameUI.foodHealAmount());
        } else {
          parts.pop();
        }
      }

      return { owner, key: keyOf(next) };
    }

    function replaceConsumedFoods(consumedFoods, attemptedFood = false) {
      const consumed = consumedFoods.filter(Boolean);
      if (!attemptedFood && !consumed.length) return;
      const eatenKeys = new Set(consumed.map(food => food.key));
      if (eatenKeys.size) GameRuntimeState.foods = GameRuntimeState.foods.filter(food => !eatenKeys.has(keyOf(food)));
      placeFoods(consumed.map(food => food.owner));
    }

    function step(headCollisionOrder = "simultaneous", now = performance.now()) {
      if (isPlayerAutoControlActive()) {
        GameRuntimeState.nextDir = GameAI.chooseAutoDirection("player");
        setDirectionButtonHighlight(GameRuntimeState.nextDir);
      }
      GameRuntimeState.dir = GameRuntimeState.nextDir;
      if (!isNetworkHostActive()) GameRuntimeState.computerDir = GameAI.chooseComputerDirection();

      const next = nextWrappedCell(GameRuntimeState.snake[0], GameRuntimeState.dir);
      const computerNext = nextWrappedCell(GameRuntimeState.computerSnake[0], GameRuntimeState.computerDir);
      const nextKey = keyOf(next);
      const computerNextKey = keyOf(computerNext);
      const eatenFood = GameRuntimeState.foods.find(food => next.q === food.q && next.r === food.r);
      const computerEatenFood = GameRuntimeState.foods.find(food => computerNext.q === food.q && computerNext.r === food.r);
      const eating = Boolean(eatenFood);
      const computerEating = Boolean(computerEatenFood);
      const body = eating ? GameRuntimeState.snake : GameRuntimeState.snake.slice(0, -1);
      const computerBody = computerEating ? GameRuntimeState.computerSnake : GameRuntimeState.computerSnake.slice(0, -1);
      const playerSelfHit = body.some(segment => keyOf(segment) === nextKey);
      const computerSelfHit = computerBody.some(segment => keyOf(segment) === computerNextKey);
      let playerOpponentHit = computerBody.some(segment => keyOf(segment) === nextKey);
      let computerOpponentHit = body.some(segment => keyOf(segment) === computerNextKey);
      if (nextKey === computerNextKey) {
        if (headCollisionOrder === "playerFirst") {
          computerOpponentHit = true;
        } else if (headCollisionOrder === "computerFirst") {
          playerOpponentHit = true;
        } else {
          playerOpponentHit = true;
          computerOpponentHit = true;
        }
      }
      if (nextKey === keyOf(GameRuntimeState.computerSnake[0]) && computerNextKey === keyOf(GameRuntimeState.snake[0])) {
        playerOpponentHit = true;
        computerOpponentHit = true;
      }

      let playerCollision = collisionSeverity(playerSelfHit, playerOpponentHit);
      let computerCollision = collisionSeverity(computerSelfHit, computerOpponentHit);
      if (computerCollision && !playerCollision && GameRuntimeState.computerSnake.some(segment => keyOf(segment) === nextKey)) {
        playerOpponentHit = true;
        playerCollision = collisionSeverity(playerSelfHit, playerOpponentHit);
      }
      if (playerCollision && !computerCollision && GameRuntimeState.snake.some(segment => keyOf(segment) === computerNextKey)) {
        computerOpponentHit = true;
        computerCollision = collisionSeverity(computerSelfHit, computerOpponentHit);
      }
      const playerParalysisLimitReached = playerCollision && applyCollisionPenalty("player", playerCollision);
      const computerParalysisLimitReached = computerCollision && applyCollisionPenalty("computer", computerCollision);
      if (playerCollision || computerCollision) {
        setStatus("撞擊造成麻痺與減速，撞到自己懲罰加倍。");
      }
      if (playerParalysisLimitReached || computerParalysisLimitReached) {
        endGame(playerParalysisLimitReached, computerParalysisLimitReached);
        return;
      }

      const playerConsumedFood = !playerCollision ? advanceOwnerMovement("player", next, eatenFood) : null;
      const computerConsumedFood = !computerCollision ? advanceOwnerMovement("computer", computerNext, computerEatenFood) : null;
      replaceConsumedFoods([playerConsumedFood, computerConsumedFood], eating || computerEating);

      if (!playerCollision && GameRuntimeState.running && !GameRuntimeState.paused) GameAI.maybeAutoBattlePlayerAttack(now);
      if (!computerCollision && GameRuntimeState.running && !GameRuntimeState.paused && !isNetworkHostActive()) GameAI.maybeComputerAttack(now);
      updateHud();
    }

    function stepPlayerOnly(now = performance.now()) {
      if (isPlayerAutoControlActive()) {
        GameRuntimeState.nextDir = GameAI.chooseAutoDirection("player");
        setDirectionButtonHighlight(GameRuntimeState.nextDir);
      }
      GameRuntimeState.dir = GameRuntimeState.nextDir;
      const next = nextWrappedCell(GameRuntimeState.snake[0], GameRuntimeState.dir);
      const nextKey = keyOf(next);
      const eatenFood = GameRuntimeState.foods.find(food => next.q === food.q && next.r === food.r);
      const eating = Boolean(eatenFood);
      const body = eating ? GameRuntimeState.snake : GameRuntimeState.snake.slice(0, -1);
      const playerSelfHit = body.some(segment => keyOf(segment) === nextKey);
      const playerOpponentHit = GameRuntimeState.computerSnake.some(segment => keyOf(segment) === nextKey);
      const playerCollision = collisionSeverity(playerSelfHit, playerOpponentHit);

      if (playerCollision) {
        const playerParalysisLimitReached = applyCollisionPenalty("player", playerCollision);
        setStatus("撞擊造成麻痺與減速，撞到自己懲罰加倍。");
        updateHud();
        if (playerParalysisLimitReached) endGame(true, false);
        return;
      }

      const consumedFood = advanceOwnerMovement("player", next, eatenFood);
      replaceConsumedFoods([consumedFood], eating);
      if (GameRuntimeState.running && !GameRuntimeState.paused) GameAI.maybeAutoBattlePlayerAttack(now);
      updateHud();
    }

    function stepComputerOnly(now = performance.now()) {
      if (!isNetworkHostActive()) GameRuntimeState.computerDir = GameAI.chooseComputerDirection();
      const computerNext = nextWrappedCell(GameRuntimeState.computerSnake[0], GameRuntimeState.computerDir);
      const computerNextKey = keyOf(computerNext);
      const computerEatenFood = GameRuntimeState.foods.find(food => computerNext.q === food.q && computerNext.r === food.r);
      const computerEating = Boolean(computerEatenFood);
      const computerBody = computerEating ? GameRuntimeState.computerSnake : GameRuntimeState.computerSnake.slice(0, -1);
      const computerSelfHit = computerBody.some(segment => keyOf(segment) === computerNextKey);
      const computerOpponentHit = GameRuntimeState.snake.some(segment => keyOf(segment) === computerNextKey);
      const computerCollision = collisionSeverity(computerSelfHit, computerOpponentHit);

      if (computerCollision) {
        const computerParalysisLimitReached = applyCollisionPenalty("computer", computerCollision);
        setStatus("P2 撞擊後麻痺並減速。");
        updateHud();
        if (computerParalysisLimitReached) endGame(false, true);
        return;
      }

      const consumedFood = advanceOwnerMovement("computer", computerNext, computerEatenFood);
      replaceConsumedFoods([consumedFood], computerEating);
      if (GameRuntimeState.running && !GameRuntimeState.paused && !isNetworkHostActive()) GameAI.maybeComputerAttack(now);
      updateHud();
    }

    function endGame(playerLost = true, computerLost = false) {
      if (GameRuntimeState.gameOver) return;
      clearGameOverSettlementTimer();
      const shouldContinueRelay = GameRuntimeState.relayMode && (GameRuntimeState.computerBattleMode || GameRuntimeState.playerAutoMode);
      const endedInAutoMode = isPlayerAutoControlActive();
      const shouldUseGameOverLogo = !endedInAutoMode && !shouldContinueRelay && !GameReplay.isPlaybackMode();
      const nextRelayStartOptions = GameRuntimeState.computerBattleMode
        ? { computerBattle: true }
        : { playerAuto: true };
      const gameOverAt = performance.now();
      GameReplay.finishRecording(playerLost, computerLost);
      GameRuntimeState.running = false;
      GameRuntimeState.playerAutoMode = false;
      GameRuntimeState.computerBattleManualOverride = false;
      GameRuntimeState.gameOver = true;
      if (shouldUseGameOverLogo) GameUI.showCharacterStage({ rebuild: false, "overlay": true });
      else GameUI.hideCharacterStage();
      GameRuntimeState.gameOverContinuousVisualDeadlineAt = gameOverAt + GameConfig.gameOverContinuousVisualMaxWaitMs;
      GameRuntimeState.gameOverLogoTransitionEndsAt = shouldUseGameOverLogo ? gameOverAt + GamePresentationState.logoTransitionDurationMs : 0;
      updateAutoBattleControls();
      GameRuntimeState.restartUnlockAt = gameOverAt + (shouldUseGameOverLogo ? GamePresentationState.logoTransitionDurationMs : GameConfig.gameOverRestartDelayMs);
      setSettingsLocked(false);
      if (GameRuntimeState.totalElapsedMs > GameRuntimeState.bestTotalMs) {
        GameRuntimeState.bestTotalMs = GameRuntimeState.totalElapsedMs;
        GameStorage.set("hexSnakeBestTotalMs", String(Math.floor(GameRuntimeState.bestTotalMs)));
      }
      updateHud();
      broadcastNetworkSnapshot(gameOverAt, true, true);
      const winnerOwner = (!playerLost && computerLost) || (playerLost && computerLost && GameRuntimeState.score > GameRuntimeState.computerScore)
        ? "player"
        : (playerLost && !computerLost) || (playerLost && computerLost && GameRuntimeState.computerScore > GameRuntimeState.score)
          ? "computer"
          : null;
      const plainResultText = winnerOwner === "player" ? "P1 勝利" : winnerOwner === "computer" ? "P2 勝利" : "平手";
      try {
        GameStats.recordMatch({
          winnerOwner,
          playerScore: GameRuntimeState.score,
          computerScore: GameRuntimeState.computerScore,
          durationMs: Math.round(GameRuntimeState.totalElapsedMs),
          playerCharacterId: GameRuntimeState.playerCharacterId,
          computerCharacterId: GameRuntimeState.computerCharacterId,
          mode: GameRuntimeState.relayMode ? "relay" : GameRuntimeState.computerBattleMode ? "autoBattle" : endedInAutoMode ? "playerAuto" : "player",
          difficulty: GameRuntimeState.computerDifficulty,
          surrendered: Boolean(GameRootState.replay.surrendered)
        });
      } catch (error) {
        console.warn("Unable to record match stats.", error);
      }
      const resultTitleHtml = winnerOwner === "player"
        ? `本局結果：<span class="owner-name is-p1">P1</span> 勝利`
        : winnerOwner === "computer"
          ? `本局結果：<span class="owner-name is-p2">P2</span> 勝利`
          : "本局結果：平手";
      const scoreText = `比分：P1 ${GameRuntimeState.score}：${GameRuntimeState.computerScore} P2`;
      const resultReason = playerLost && computerLost
        ? GameRuntimeState.score === GameRuntimeState.computerScore
          ? "雙方同時結束，分數相同。"
          : "雙方同時結束，以分數較高者勝出。"
        : winnerOwner === "player"
          ? "P2 淘汰，P1 獲勝。"
          : winnerOwner === "computer"
            ? "P1 淘汰，P2 獲勝。"
            : "雙方分數相同。";
      GameUI.setLastResultShareData(buildResultShareData({
        winnerOwner,
        plainResultText,
        scoreText,
        resultReason,
        endedInAutoMode
      }));
      setStatus(`對戰結束：${plainResultText}`);
      Dom.overlayTitle.innerHTML = resultTitleHtml;
      GameAudio.playCharacter("player", winnerOwner === "player" ? "victory" : "defeat", { gainScale: winnerOwner ? 1 : 0.82 });
      GameAudio.playCharacter("computer", winnerOwner === "computer" ? "victory" : "defeat", { delay: winnerOwner ? 0.08 : 0.12, gainScale: winnerOwner ? 1 : 0.82 });
      GameRuntimeState.gameOverResultOwner = winnerOwner;
      GameRuntimeState.gameOverPlayerLost = playerLost;
      GameRuntimeState.gameOverComputerLost = computerLost;
      GameUI.showResultCallout("player", winnerOwner === "player" ? "victory" : "defeat");
      GameUI.showResultCallout("computer", winnerOwner === "computer" ? "victory" : "defeat");
      if (shouldContinueRelay) {
        if (winnerOwner === "player") GameRuntimeState.relayPlayerWins += 1;
        else if (winnerOwner === "computer") GameRuntimeState.relayComputerWins += 1;
        else GameRuntimeState.relayDraws += 1;
        updateRelayControls();
      }
      Dom.startButton.textContent = "重新開始";
      GameRuntimeState.gameOverSettlementPending = true;
      GameRuntimeState.gameOverRelayStartOptions = shouldContinueRelay ? nextRelayStartOptions : null;
      Dom.overlayText.textContent = shouldContinueRelay
        ? `${scoreText}。${resultReason} 接力賽：P1 ${GameRuntimeState.relayPlayerWins} 勝，P2 ${GameRuntimeState.relayComputerWins} 勝，平手 ${GameRuntimeState.relayDraws}。`
        : `${scoreText}。${resultReason}`;
      Dom.overlayText.hidden = true;
      if (shouldUseGameOverLogo) {
        const winnerLabel = winnerOwner === "player" ? "P1" : winnerOwner === "computer" ? "P2" : null;
        const winnerCharacter = winnerOwner ? GameUI.characterFor(winnerOwner) : null;
        const winnerMessage = winnerOwner
          ? `\u606d\u559c ${winnerLabel}\uff08${winnerCharacter?.name || "\u96a8\u6a5f\u9078\u64c7"}\uff09\u7372\u52dd`
          : "\u672c\u5c40\u5e73\u624b";
        GameUI.showLogoTransition("in", { message: winnerMessage });
      }
      cancelAnimationFrame(GameRuntimeState.rafId);
      GameRuntimeState.rafId = requestAnimationFrame(loop);
    }

    function loop(now) {
      if (GamePlatform.lifecycle.isPaused()) {
        GameRuntimeState.rafId = 0;
        return;
      }
      updatePerfOverlay(GamePlatform.display.recordFrame(now || performance.now()));
      if (!GameRuntimeState.running) {
        const frameNow = now || performance.now();
        const visualsActive = GameRuntimeState.gameOverSettlementPending && advanceGameOverVisuals(frameNow);
        GameRender.draw();
        if (GameRuntimeState.gameOverSettlementPending && GameRuntimeState.gameOverLogoTransitionEndsAt) {
          if (frameNow < GameRuntimeState.gameOverLogoTransitionEndsAt) {
            GameRuntimeState.rafId = requestAnimationFrame(loop);
          } else {
            showGameOverSettlement();
          }
        } else if (visualsActive) {
          GameRuntimeState.rafId = requestAnimationFrame(loop);
        } else if (GameRuntimeState.gameOverSettlementPending) {
          showGameOverSettlement();
        }
        return;
      }
      if (!GameRuntimeState.paused) {
        const delta = GameRuntimeState.lastTimerFrame ? now - GameRuntimeState.lastTimerFrame : 0;
        const timeScale = isPlayerAutoControlActive() ? GameRuntimeState.computerBattleSpeed : 1;
        GameRuntimeState.totalElapsedMs += delta * timeScale;
        GameRuntimeState.lastFeedElapsedMs += delta * timeScale;
        GameRuntimeState.lastTimerFrame = now;
        if (GameRuntimeState.totalElapsedMs >= GameConfig.maxMatchMs) {
          GameRuntimeState.totalElapsedMs = GameConfig.maxMatchMs;
          endGame(true, true);
          return;
        }
      } else {
        GameRuntimeState.lastTimerFrame = now;
      }
      if (!GameRuntimeState.paused) {
        refreshSandwormProtections(now);
        resolveProjectiles(now);
        resolveHazards(now);
        refreshSandwormProtections(now);
        GameAI.updateAiVisibilityMemory(now);
      }
      if (GameRuntimeState.running && !GameRuntimeState.paused) {
        const playerDue = !GameUI.isMovementStunned("player", now) && now - GameRuntimeState.lastPlayerStep >= GameUI.moveIntervalFor("player", now);
        const computerDue = !GameUI.isMovementStunned("computer", now) && now - GameRuntimeState.lastComputerStep >= GameUI.moveIntervalFor("computer", now);
        if (playerDue && computerDue) {
          const playerDueAt = GameRuntimeState.lastPlayerStep + GameUI.moveIntervalFor("player", now);
          const computerDueAt = GameRuntimeState.lastComputerStep + GameUI.moveIntervalFor("computer", now);
          const headCollisionOrder = Math.abs(playerDueAt - computerDueAt) < 0.001
            ? "simultaneous"
            : playerDueAt < computerDueAt ? "playerFirst" : "computerFirst";
          step(headCollisionOrder, now);
          GameRuntimeState.lastPlayerStep = now;
          GameRuntimeState.lastComputerStep = now;
        } else if (playerDue) {
          stepPlayerOnly(now);
          GameRuntimeState.lastPlayerStep = now;
        } else if (computerDue) {
          stepComputerOnly(now);
          GameRuntimeState.lastComputerStep = now;
        }
      }
      GameRuntimeState.blasts = GameRuntimeState.blasts.filter(blast => now <= blast.endAt);
      GameRuntimeState.hazards = GameRuntimeState.hazards.filter(hazard => now <= hazard.endAt);
      updateHudThrottled(now);
      recordReplaySnapshotThrottled(now);
      broadcastNetworkSnapshot(now);
      updateAutoBattleControls();
      GameRender.draw();
      GameRuntimeState.rafId = requestAnimationFrame(loop);
    }

    function pointerToDirection(event, rect) {
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(x, y);
      if (distance < Math.max(4, rect.width * 0.035)) return null;
      let bestDirection = 0;
      let bestDot = -Infinity;
      GameConfig.directions.forEach((_, direction) => {
        const vector = directionVector(direction);
        const dot = x * vector.x + y * vector.y;
        if (dot > bestDot) {
          bestDot = dot;
          bestDirection = direction;
        }
      });
      return bestDirection;
    }

    function controlPadDirectionFromEvent(event) {
      const rect = Dom.joyZone.contains(event.target) ? Dom.joyZone.getBoundingClientRect() : Dom.controlRow.getBoundingClientRect();
      return pointerToDirection(event, rect);
    }

    function beginControlPadAttackPointer(event) {
      if (GameUI.isLogoTransitionActive()) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      if (!GameAI.shouldUseControlPadAttackDirection()) return false;
      if (!GameRuntimeState.running || GameRuntimeState.gameOver) {
        if (!autoStartGame()) return true;
      }
      event.preventDefault();
      event.stopPropagation();
      const dirButton = event.target.closest("[data-dir-button]");
      const direction = dirButton ? Number(dirButton.dataset.dir) : controlPadDirectionFromEvent(event);
      GameRuntimeState.controlAttackPointer = {
        pointerId: event.pointerId,
        direction: Number.isInteger(direction) ? direction : ownerDirection("player")
      };
      triggerTouchFeedback(event, 10);
      GameRuntimeState.targetCell = directionalAttackTarget(GameRuntimeState.controlAttackPointer.direction);
      GameRuntimeState.targetActive = true;
      try {
        Dom.controlRow.setPointerCapture(event.pointerId);
      } catch (error) {
        // Window-level pointer listeners still finish the attack gesture.
      }
      GameRender.requestPreviewDraw();
      return true;
    }

    function moveControlPadAttackPointer(event) {
      if (!GameRuntimeState.controlAttackPointer || event.pointerId !== GameRuntimeState.controlAttackPointer.pointerId) return;
      event.preventDefault();
      const direction = controlPadDirectionFromEvent(event);
      const previousDirection = GameRuntimeState.controlAttackPointer.direction;
      if (direction !== null) GameRuntimeState.controlAttackPointer.direction = direction;
      GameRuntimeState.targetCell = directionalAttackTarget(GameRuntimeState.controlAttackPointer.direction);
      GameRuntimeState.targetActive = true;
      if (GameRuntimeState.controlAttackPointer.direction !== previousDirection) triggerTouchFeedback(event, 5);
      GameRender.requestPreviewDraw();
    }

    function finishControlPadAttackPointer(event) {
      if (!GameRuntimeState.controlAttackPointer || event.pointerId !== GameRuntimeState.controlAttackPointer.pointerId) return;
      event.preventDefault();
      const direction = GameRuntimeState.controlAttackPointer.direction;
      GameRuntimeState.controlAttackPointer = null;
      if (Dom.controlRow.hasPointerCapture?.(event.pointerId)) Dom.controlRow.releasePointerCapture(event.pointerId);
      triggerTouchFeedback(event, 6);
      launchPlayerAttackDirection(direction, "big");
    }

    function cancelControlPadAttackPointer(event) {
      if (!GameRuntimeState.controlAttackPointer || event.pointerId !== GameRuntimeState.controlAttackPointer.pointerId) return;
      GameRuntimeState.controlAttackPointer = null;
      GameRuntimeState.targetActive = false;
      if (Dom.controlRow.hasPointerCapture?.(event.pointerId)) Dom.controlRow.releasePointerCapture(event.pointerId);
      GameRender.requestPreviewDraw();
    }

    function moveStick(event) {
      clearMoveStickRebound();
      const rect = Dom.joyZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const distance = Math.min(54, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      Dom.stick.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
      const newDir = pointerToDirection(event, rect);
      if (newDir !== null) {
        GameRuntimeState.movePointerMoved = true;
        setDirection(newDir, { feedbackEvent: event, feedbackStrength: 5 });
      }
    }

    function setMoveStickLocked(locked) {
      GameRuntimeState.moveStickLocked = locked;
      GameRuntimeState.moveStickEngaged = locked;
      Dom.joyZone.querySelector(".joystick").classList.toggle("locked", locked);
      if (!locked) {
        GameRuntimeState.movePointerId = null;
        GameRuntimeState.moveStickEngaged = false;
        clearMoveStickRebound();
        Dom.stick.style.transform = "translate(0, 0)";
      }
    }

    function clearMoveStickHoldTimer() {
      if (!GameRuntimeState.moveStickHoldTimer) return;
      clearTimeout(GameRuntimeState.moveStickHoldTimer);
      GameRuntimeState.moveStickHoldTimer = null;
    }

    function clearMoveStickRebound() {
      if (GameRuntimeState.moveStickReboundTimer) {
        clearTimeout(GameRuntimeState.moveStickReboundTimer);
        GameRuntimeState.moveStickReboundTimer = null;
      }
      Dom.stick.classList.remove("is-rebounding");
    }

    function clearAttackPointerLongPressTimer() {
      if (!GameRuntimeState.attackPointerLongPressTimer) return;
      clearTimeout(GameRuntimeState.attackPointerLongPressTimer);
      GameRuntimeState.attackPointerLongPressTimer = null;
    }

    function pointerNearMoveCenter(event) {
      const rect = Dom.joyZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return Math.hypot(event.clientX - cx, event.clientY - cy) < Math.min(46, rect.width * 0.36);
    }

    function engageMoveStick(event) {
      clearMoveStickHoldTimer();
      if (GameRuntimeState.movePointerId !== event.pointerId || GameRuntimeState.moveStickEngaged) return;
      GameRuntimeState.moveStickEngaged = true;
      Dom.joyZone.querySelector(".joystick").classList.add("locked");
      moveStick(event);
    }

    function releaseMoveStick(event) {
      clearMoveStickHoldTimer();
      if (GameRuntimeState.moveStickLocked) return;
      GameRuntimeState.movePointerId = null;
      GameRuntimeState.moveStickEngaged = false;
      Dom.joyZone.querySelector(".joystick").classList.remove("locked");
      setDirectionButtonHighlight(null);
      Dom.stick.classList.add("is-rebounding");
      Dom.stick.style.transform = "translate(0, 0)";
      if (GameRuntimeState.moveStickReboundTimer) clearTimeout(GameRuntimeState.moveStickReboundTimer);
      GameRuntimeState.moveStickReboundTimer = setTimeout(() => {
        GameRuntimeState.moveStickReboundTimer = null;
        Dom.stick.classList.remove("is-rebounding");
      }, 180);
    }

    function moveTargetStick(event) {
      if (GameReplay.isPlaybackMode()) return;
      if (GameUI.isLogoTransitionActive()) return;
      if (!GameRuntimeState.running || GameRuntimeState.gameOver) {
        if (!autoStartGame()) return;
      }
      const rect = targetZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const rawDistance = Math.hypot(dx, dy);
      const distance = Math.min(54, rawDistance);
      const angle = Math.atan2(dy, dx);
      targetStick.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
      const playerPixel = axialToPixel(GameRuntimeState.snake[0]);
      const maxPixelRange = GameRuntimeState.targetMaxHex * GameRuntimeState.cellSize;
      const ratio = Math.min(1, rawDistance / Math.max(1, rect.width * 0.44));
      const targetPixel = {
        x: playerPixel.x + Math.cos(angle) * maxPixelRange * ratio,
        y: playerPixel.y + Math.sin(angle) * maxPixelRange * ratio
      };
      GameRuntimeState.targetCell = nearestInsideCell(pixelToAxial(targetPixel.x, targetPixel.y));
      GameRuntimeState.targetActive = true;
      GameRender.requestPreviewDraw();
    }

    function releaseTargetStick() {
      GameRuntimeState.targetPointerId = null;
      targetStick.style.transform = "translate(0, 0)";
      if (GameRuntimeState.targetActive && GameRuntimeState.running && !GameRuntimeState.paused && !GameRuntimeState.gameOver) {
        if (launchAttack("player", GameRuntimeState.targetCell || GameRuntimeState.snake[0], performance.now())) {
          setStatus("P1 施放炸彈，2 秒後落地。");
        } else {
          setStatus(`大招需要 ${GameConfig.bigAttackBombCost} 枚炸彈，且四種庫存各至少 2。`);
        }
      }
      GameRuntimeState.targetActive = false;
    }

    function opponentHeadTarget() {
      return GameRuntimeState.computerSnake?.[0] || GameRuntimeState.snake?.[0] || GameRuntimeState.targetCell;
    }

    function opponentCentroidTarget() {
      const computerSnake = GameRuntimeState.computerSnake;
      if (!computerSnake?.length) return opponentHeadTarget();
      const average = computerSnake.reduce((total, segment) => ({
        q: total.q + segment.q / computerSnake.length,
        r: total.r + segment.r / computerSnake.length
      }), { q: 0, r: 0 });
      return nearestInsideCell(roundAxial(average.q, average.r));
    }

    function opponentNearestFoodTarget() {
      const head = opponentHeadTarget();
      const foods = GameRuntimeState.foods;
      if (!foods.length || !head) return head;
      return [...foods].sort((a, b) => hexDistance(head, a) - hexDistance(head, b))[0] || head;
    }

    function keyboardTargetMode(profile = "small") {
      const aim = GameRuntimeState.keyboardAttackAim[profile] || GameRuntimeState.keyboardAttackAim.small;
      const targetModes = GameConfig.keyboardTargetModes;
      return targetModes[aim.targetModeIndex % targetModes.length] || "head";
    }

    function keyboardAttackTarget(profile = "small") {
      if (keyboardAttackUsesDirection(profile)) return opponentHeadTarget();
      const mode = keyboardTargetMode(profile);
      if (mode === "centroid") return opponentCentroidTarget();
      if (mode === "food") return opponentNearestFoodTarget();
      return opponentHeadTarget();
    }

    function keyboardAttackUsesDirection(profile = "small") {
      return profile === "big" && GameAI.bigAttackUsesDrawnDirection(GameUI.characterFor("player").id);
    }

    function keyboardAttackDirection(profile = "big") {
      const aim = GameRuntimeState.keyboardAttackAim[profile] || GameRuntimeState.keyboardAttackAim.big;
      return Number.isInteger(aim.direction) ? aim.direction : ownerDirection("player");
    }

    function keyboardAttackOptions(profile = "small", target = null) {
      if (!keyboardAttackUsesDirection(profile) || !GameRuntimeState.snake?.length) return {};
      const character = GameUI.characterFor("player");
      const direction = keyboardAttackDirection(profile);
      return {
        aimDirection: direction,
        aimOrigin: character.id === "moray" ? (target || opponentHeadTarget()) : GameRuntimeState.snake[0]
      };
    }

    function clearKeyboardAttackPreviewTimer() {
      if (!GameRuntimeState.keyboardAttackPreviewTimer) return;
      clearTimeout(GameRuntimeState.keyboardAttackPreviewTimer);
      GameRuntimeState.keyboardAttackPreviewTimer = null;
    }

    function keyboardAttackHintLabel(profile = "small") {
      if (keyboardAttackUsesDirection(profile)) {
        const direction = GameConfig.directions[keyboardAttackDirection(profile)];
        return direction ? direction.label : "目前方向";
      }
      return GameConfig.keyboardTargetModeLabels[keyboardTargetMode(profile)] || "目標頭部";
    }

    function currentKeyboardAimProfile() {
      return GameRuntimeState.selectedAttackProfile === "big" ? "big" : "small";
    }

    function targetModeCrosshairSvg(content) {
      return `
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <g fill="none" stroke="#fde68a" stroke-width="2.2" stroke-linecap="round">
            <circle cx="16" cy="16" r="11.2"></circle>
            <path d="M16 3.8v6.2M16 22v6.2M3.8 16h6.2M22 16h6.2"></path>
          </g>
          ${content}
        </svg>
      `;
    }

    function targetModeIconSvg(mode, directionAngle = 0) {
      if (mode === "food") {
        return targetModeCrosshairSvg(`
          <path d="M16 1.8 29.3 28.4H2.7Z" fill="#f8fafc" stroke="#e5e7eb" stroke-width="1.7" stroke-linejoin="round"></path>
          <path d="M9.2 15.2h13.6v13H9.2z" fill="#14532d" stroke="#052e16" stroke-width="0.85" stroke-linejoin="round"></path>
          <path d="M11.7 17.7h8.6v8.5h-8.6z" fill="#166534"></path>
          <circle cx="16" cy="12.8" r="2.9" fill="#facc15" stroke="#422006" stroke-width="0.85"></circle>
        `);
      }
      if (mode === "body") {
        return targetModeCrosshairSvg(`
          <path d="M2 23.8c6.5-10.4 20.8-9.5 20.8-1.1 0 7.4-15 6.8-15 0.7 0-5.4 11.2-5.5 11.2-0.8 0 3.7-7.2 3.5-7.2 0.5 0-2.3 3.6-2.7 6.4-1.8 3.9 1.3 5.2-4.1 8.4-4.9" fill="none" stroke="#052e16" stroke-width="9.2" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M2 23.8c6.5-10.4 20.8-9.5 20.8-1.1 0 7.4-15 6.8-15 0.7 0-5.4 11.2-5.5 11.2-0.8 0 3.7-7.2 3.5-7.2 0.5 0-2.3 3.6-2.7 6.4-1.8 3.9 1.3 5.2-4.1 8.4-4.9" fill="none" stroke="#34d399" stroke-width="7.1" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M2 23.8c6.5-10.4 20.8-9.5 20.8-1.1 0 7.4-15 6.8-15 0.7 0-5.4 11.2-5.5 11.2-0.8 0 3.7-7.2 3.5-7.2 0.5 0-2.3 3.6-2.7 6.4-1.8 3.9 1.3 5.2-4.1 8.4-4.9" fill="none" stroke="#a7f3d0" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"></path>
          <circle cx="27" cy="13.8" r="5.8" fill="#fca5a5" stroke="#fecaca" stroke-width="1.35"></circle>
          <circle cx="28.8" cy="12.2" r="1.15" fill="#111827"></circle>
          <path d="M23.7 8.9 21 5.6M24 18.5l-3.6 1.8" stroke="#fecaca" stroke-width="1.25" stroke-linecap="round"></path>
        `);
      }
      if (mode === "direction") {
        return `
          <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <g transform="rotate(${directionAngle} 16 16)" fill="none" stroke="#fde68a" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1.8 16H28.7" stroke-width="6.2"></path>
              <path d="M19.5 5.4 30.8 16 19.5 26.6" stroke-width="6.2"></path>
              <path d="M1.8 16H28.7" stroke="#f59e0b" stroke-width="2.3"></path>
              <path d="M19.5 5.4 30.8 16 19.5 26.6" stroke="#f59e0b" stroke-width="2.3"></path>
            </g>
          </svg>
        `;
      }
      return targetModeCrosshairSvg(`
        <path d="M0.8 25c4.9-7.7 9.1 6.8 13.6-0.7 1.8-3.2 3.1-4.7 5.1-5.8" fill="none" stroke="#34d399" stroke-width="6.4" stroke-linecap="round"></path>
        <path d="M0.8 25c4.9-7.7 9.1 6.8 13.6-0.7 1.8-3.2 3.1-4.7 5.1-5.8" fill="none" stroke="#a7f3d0" stroke-width="3.2" stroke-linecap="round"></path>
        <circle cx="16" cy="16" r="7.3" fill="#fca5a5" stroke="#fecaca" stroke-width="1.55"></circle>
        <circle cx="18.5" cy="14.1" r="1.25" fill="#111827"></circle>
        <path d="M12.4 10.6 9.5 7.2M12 20.1l-3.8 1.7" stroke="#fecaca" stroke-width="1.3" stroke-linecap="round"></path>
      `);
    }

    function updateTargetModeIndicatorFor(profile = "small", indicator = null, icon = null) {
      if (!indicator || !icon) return;
      const isDirection = keyboardAttackUsesDirection(profile);
      const mode = isDirection ? "direction" : keyboardTargetMode(profile);
      const iconMode = mode === "centroid" ? "body" : mode;
      icon.dataset.mode = iconMode;
      const directionAngle = isDirection ? directionScreenAngle(keyboardAttackDirection(profile)) : 0;
      if (isDirection) {
        icon.style.setProperty("--target-direction-angle", `${directionAngle}deg`);
      } else {
        icon.style.removeProperty("--target-direction-angle");
      }
      icon.innerHTML = targetModeIconSvg(iconMode, directionAngle);
      const label = `${profile === "big" ? "大招" : "小招"}：${keyboardAttackHintLabel(profile)}`;
      indicator.title = label;
      indicator.setAttribute("aria-label", `顯示${label}位置提示`);
    }

    function updateTargetModeIndicator() {
      updateTargetModeIndicatorFor("small", Dom.targetModeSmallIndicator, Dom.targetModeSmallIcon);
      updateTargetModeIndicatorFor("big", Dom.targetModeBigIndicator, Dom.targetModeBigIcon);
    }

    function showKeyboardAttackHint(profile = "small") {
      const target = keyboardAttackTarget(profile);
      const preview = {
        profile,
        target,
        startedAt: performance.now(),
        endAt: performance.now() + 900
      };
      if (keyboardAttackUsesDirection(profile)) {
        preview.direction = keyboardAttackDirection(profile);
        preview.origin = GameUI.characterFor("player").id === "moray" ? target : GameRuntimeState.snake?.[0];
      }
      GameRuntimeState.keyboardAttackPreview = preview;
      GameRuntimeState.targetCell = target;
      GameRuntimeState.targetActive = Boolean(target);
      GameRuntimeState.selectedAttackProfile = profile;
      updateTargetModeIndicator();
      GameRender.requestPreviewDraw();
      clearKeyboardAttackPreviewTimer();
      GameRuntimeState.keyboardAttackPreviewTimer = setTimeout(() => {
        GameRuntimeState.keyboardAttackPreviewTimer = null;
        if (GameRuntimeState.keyboardAttackPreview === preview) GameRuntimeState.keyboardAttackPreview = null;
        GameRuntimeState.targetActive = false;
        GameRender.requestPreviewDraw();
      }, 900);
      setStatus(`${profile === "big" ? "大招" : "小招"}按鍵目標：${keyboardAttackHintLabel(profile)}`);
    }

    function cycleKeyboardAttackAim(profile = "small") {
      if (!GameRuntimeState.running || GameRuntimeState.gameOver) {
        if (!autoStartGame()) return false;
      }
      const aim = GameRuntimeState.keyboardAttackAim[profile] || GameRuntimeState.keyboardAttackAim.small;
      if (keyboardAttackUsesDirection(profile)) {
        aim.direction = (keyboardAttackDirection(profile) + 1) % GameConfig.directions.length;
      } else {
        aim.targetModeIndex = (aim.targetModeIndex + 1) % GameConfig.keyboardTargetModes.length;
      }
      GameRuntimeState.keyboardAttackAim[profile] = aim;
      GameRuntimeState.selectedAttackProfile = profile;
      showKeyboardAttackHint(profile);
      return true;
    }

    function handleKeyboardAimKeyDown(event, profile = "small", key = "") {
      event.preventDefault();
      if (event.repeat) return true;
      const heldKeys = GameRuntimeState.keyboardAimHeldKeys;
      if (heldKeys.has(key)) {
        heldKeys.delete(key);
        setAttackButtonHighlight(null);
      }
      heldKeys.add(key);
      setAttackButtonHighlight(profile === "big" ? "bigAim" : "smallAim");
      triggerTouchFeedback(event, profile === "big" ? 12 : 8);
      cycleKeyboardAttackAim(profile);
      return true;
    }

    function handleKeyboardAimKeyUp(event, key = "") {
      const heldKeys = GameRuntimeState.keyboardAimHeldKeys;
      if (!heldKeys.has(key)) return false;
      event.preventDefault();
      heldKeys.delete(key);
      releaseAttackButtonHighlight();
      triggerTouchFeedback(event, 5);
      return true;
    }

    function clearKeyboardAimKeyLocks() {
      const heldKeys = GameRuntimeState.keyboardAimHeldKeys;
      if (!heldKeys.size) return;
      heldKeys.clear();
      setAttackButtonHighlight(null);
    }

    function launchKeyboardPlayerAttack(profile = "small") {
      const target = keyboardAttackTarget(profile);
      return launchPlayerAttack(target, profile, keyboardAttackOptions(profile, target));
    }

    function remindKeyboardAttackTarget(profile = currentKeyboardAimProfile(), event = null) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const indicator = profile === "big" ? Dom.targetModeBigIndicator : Dom.targetModeSmallIndicator;
      indicator.classList.add("is-active");
      triggerTouchFeedback(event, profile === "big" ? 12 : 8);
      showKeyboardAttackHint(profile);
      setTimeout(() => indicator.classList.remove("is-active"), 140);
    }

    function playerDirectAttackTarget(profile = "small", pointer = null) {
      const character = GameUI.characterFor("player");
      if (profile === "big" && pointer && character.id === "moray") {
        return pointer.currentCell || pointer.startCell || opponentHeadTarget();
      }
      if (profile === "big" && pointer && !GameAI.bigAttackUsesDrawnDirection(character.id)) {
        return pointer.currentCell || pointer.startCell || opponentHeadTarget();
      }
      return opponentHeadTarget();
    }

    function playerGestureAttackDirection(pointer, fallbackTarget) {
      if (pointer?.moved) {
        return directionFromSourceToTarget(pointer.startCell, pointer.currentCell, directionFromSourceToTarget(GameRuntimeState.snake[0], fallbackTarget, ownerDirection("player")));
      }
      return directionFromSourceToTarget(GameRuntimeState.snake[0], fallbackTarget, ownerDirection("player"));
    }

    function playerDirectAttackOptions(profile = "small", pointer = null) {
      const target = playerDirectAttackTarget(profile, pointer);
      const character = GameUI.characterFor("player");
      if (profile === "big" && GameAI.bigAttackUsesDrawnDirection(character.id) && GameRuntimeState.snake?.length) {
        return {
          aimDirection: playerGestureAttackDirection(pointer, target),
          aimOrigin: character.id === "moray" && pointer?.moved ? target : GameRuntimeState.snake[0]
        };
      }
      return {};
    }

    function previewDirectAttack(profile = "small", pointer = null) {
      GameRuntimeState.selectedAttackProfile = profile === "big" ? "big" : "small";
      GameRuntimeState.targetCell = playerDirectAttackTarget(profile, pointer);
      GameRuntimeState.targetActive = Boolean(GameRuntimeState.targetCell);
      GameRender.requestPreviewDraw();
    }

    function launchDirectPlayerAttack(profile = "small", pointer = null) {
      const target = playerDirectAttackTarget(profile, pointer);
      return launchPlayerAttack(target, profile, playerDirectAttackOptions(profile, pointer));
    }

    function playerAttackFailureReason(target, profile = GameRuntimeState.selectedAttackProfile, now = performance.now()) {
      const moveName = profile === "small" ? GameUI.characterFor("player").smallMove : GameUI.characterFor("player").bigMove;
      if (GameReplay.isPlaybackMode()) return "正在播放重播，不能施放招式。";
      if (!GameRuntimeState.running || GameRuntimeState.gameOver) return "尚未開局；開始後再點棋盤可施放招式。";
      if (GameRuntimeState.paused) return "遊戲暫停中，請先繼續再施放招式。";
      if (!target || !GameRuntimeState.snake?.length) return `${moveName} 施放失敗：沒有有效目標格。`;

      const stock = GameRuntimeState.playerStock;
      const foodCost = GameUI.attackFoodCost(profile);
      if (profile === "small") {
        const highestType = GameUI.highestStockFoodType(stock);
        const highestCount = highestType ? stock[highestType.id] || 0 : 0;
        if (highestCount < foodCost) return `${moveName} 施放失敗：最高庫存不足，需要任一食物庫存至少 ${foodCost}。`;
      } else {
        const missingFood = GameConfig.foodTypes
          .filter(type => stock[type.id] < foodCost)
          .map(type => type.label)
          .join("、");
        if (missingFood) return `${moveName} 施放失敗：${missingFood}庫存不足，需要四種庫存各 ${foodCost}。`;
      }

      const bombCost = GameUI.attackBombCost(profile);
      if (GameUI.ammoFor("player") < bombCost) return `${moveName} 施放失敗：炸彈不足，需要 ${bombCost} 枚，目前 ${GameUI.ammoFor("player")} 枚。`;

      const remainingMs = GameUI.attackCooldownRemainingMs("player", profile, now);
      if (remainingMs > 0) return `${moveName} 施放失敗：冷卻中，還需 ${(remainingMs / 1000).toFixed(1)} 秒。`;

      return `${moveName} 施放失敗：目前條件不允許施放。`;
    }

    function launchPlayerAttack(target, profile = GameRuntimeState.selectedAttackProfile, options = {}) {
      if (GameReplay.isPlaybackMode()) {
        setStatus(playerAttackFailureReason(target, profile));
        return false;
      }
      if (isNetworkGuestActive()) {
        const safeProfile = profile === "small" ? "small" : "big";
        const ownHeadKey = GameRuntimeState.computerSnake?.[0] ? keyOf(GameRuntimeState.computerSnake[0]) : "";
        const targetIsOwnHead = target && keyOf(target) === ownHeadKey;
        const networkTarget = target && !targetIsOwnHead ? target : GameRuntimeState.snake?.[0];
        const networkOptions = { ...options };
        if (networkOptions.aimOrigin && GameRuntimeState.snake?.[0] && keyOf(networkOptions.aimOrigin) === keyOf(GameRuntimeState.snake[0])) {
          networkOptions.aimOrigin = GameRuntimeState.computerSnake?.[0] ? { ...GameRuntimeState.computerSnake[0] } : networkOptions.aimOrigin;
        }
        sendNetworkInput({
          kind: "attack",
          profile: safeProfile,
          target: networkTarget ? { q: networkTarget.q, r: networkTarget.r } : null,
          options: networkOptions
        });
        flashAttackButton(safeProfile);
        setStatus(safeProfile === "small" ? "Sent P2 LAN attack." : "Sent P2 LAN big attack.");
        return true;
      }
      if (!GameRuntimeState.running || GameRuntimeState.gameOver) {
        if (!autoStartGame()) {
          setStatus(playerAttackFailureReason(target, profile));
          return false;
        }
      }
      if (GameRuntimeState.paused) {
        setStatus(playerAttackFailureReason(target, profile));
        return false;
      }
      const now = performance.now();
      if (launchAttack("player", target, now, profile, options)) {
        GameRuntimeState.keyboardAttackPreview = null;
        clearKeyboardAttackPreviewTimer();
        GameRuntimeState.targetCell = { ...target };
        GameRuntimeState.targetActive = true;
        flashAttackButton(profile);
        GameRender.draw();
        setTimeout(() => {
          GameRuntimeState.targetActive = false;
          GameRender.draw();
        }, 180);
        const moveName = profile === "small" ? GameUI.characterFor("player").smallMove : GameUI.characterFor("player").bigMove;
        setStatus(`${moveName} 發動。`);
        return true;
      }
      setStatus(playerAttackFailureReason(target, profile, now));
      return false;
    }

    function launchPlayerAttackDirection(direction, profile = GameRuntimeState.selectedAttackProfile) {
      if (isNetworkGuestActive()) {
        const safeDirection = safeNetworkDirection(direction);
        if (safeDirection === null) return false;
        const safeProfile = profile === "small" ? "small" : "big";
        sendNetworkInput({ kind: "attack-direction", profile: safeProfile, direction: safeDirection });
        flashAttackButton(safeProfile);
        return true;
      }
      if (!GameRuntimeState.running || GameRuntimeState.gameOver) {
        if (!autoStartGame()) return false;
      }
      return launchPlayerAttack(opponentHeadTarget(), profile, { aimDirection: direction, aimOrigin: GameRuntimeState.snake[0] });
    }

    function performModuleAttack() {
      const module = Dom.characterStage.querySelector('[data-module="player"]');
      if (module) module.classList.remove("is-charging");
      launchPlayerAttack(GameRuntimeState.targetCell || GameRuntimeState.snake[0]);
    }

    function clearModuleHold() {
      clearTimeout(HexSnakeState.game.moduleHoldTimer);
      HexSnakeState.game.moduleHoldTimer = null;
      const module = Dom.characterStage.querySelector('[data-module="player"]');
      if (module) module.classList.remove("is-charging");
    }

    function togglePause() {
      if (GameReplay.isPlaybackMode()) return;
      if (!HexSnakeState.game.running || HexSnakeState.game.gameOver) {
        beginStartLogoCountdown();
        return;
      }
      HexSnakeState.game.paused = !HexSnakeState.game.paused;
      setStatus(HexSnakeState.game.paused ? "已暫停" : "對戰中：吃食物累積能量，集滿可獲得炸彈。");
      Dom.overlayTitle.textContent = "暫停";
      Dom.overlayText.textContent = "按開始或快捷鍵繼續。";
      Dom.startButton.textContent = "繼續";
      HexSnakeUI.setOverlayChromeVisible(true);
      Dom.overlay.classList.toggle("show", HexSnakeState.game.paused);
      if (!HexSnakeState.game.paused) {
        HexSnakeState.game.lastPlayerStep = performance.now();
        HexSnakeState.game.lastComputerStep = HexSnakeState.game.lastPlayerStep;
        HexSnakeState.game.lastTimerFrame = HexSnakeState.game.lastPlayerStep;
      }
      updateAutoBattleControls();
    }

    function surrenderGame() {
      if (GameReplay.isPlaybackMode()) return;
      if (!HexSnakeState.game.running || HexSnakeState.game.gameOver) {
        if (HexSnakeState.game.computerBattleMode && HexSnakeState.game.relayMode) {
          setRelayMode(false, false, false);
          setStatus("接力賽已停止。");
        }
        return;
      }
      setStatus("你已投降。");
      setRelayMode(false, false, false);
      GameReplay.markSurrendered();
      endGame(true, false);
    }

    function boardCellFromPointer(event) {
      const rect = Dom.canvas.getBoundingClientRect();
      return nearestInsideCell(pixelToAxial(event.clientX - rect.left, event.clientY - rect.top));
    }

    function beginBoardAttackPointer(event) {
      if (GameReplay.isPlaybackMode()) return;
      if (event.target !== Dom.canvas) return;
      event.preventDefault();
      const cell = boardCellFromPointer(event);
      HexSnakeState.game.attackPointer = {
        pointerId: event.pointerId,
        startCell: { ...cell },
        currentCell: { ...cell },
        startedAt: performance.now(),
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        longPressed: false,
        previewProfile: "small"
      };
      previewDirectAttack("small", HexSnakeState.game.attackPointer);
      clearAttackPointerLongPressTimer();
      HexSnakeState.game.attackPointerLongPressTimer = setTimeout(() => {
        if (!HexSnakeState.game.attackPointer || HexSnakeState.game.attackPointer.pointerId !== event.pointerId) return;
        HexSnakeState.game.attackPointer.longPressed = true;
        HexSnakeState.game.attackPointer.previewProfile = "big";
        previewDirectAttack("big", HexSnakeState.game.attackPointer);
      }, 460);
      try {
        Dom.canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture is a convenience; window-level listeners still finish the drag.
      }
      GameRender.requestPreviewDraw();
    }

    function moveBoardAttackPointer(event) {
      if (!HexSnakeState.game.attackPointer || event.pointerId !== HexSnakeState.game.attackPointer.pointerId) return;
      event.preventDefault();
      const cell = boardCellFromPointer(event);
      HexSnakeState.game.attackPointer.currentCell = { ...cell };
      const dragDistance = Math.hypot(event.clientX - HexSnakeState.game.attackPointer.startX, event.clientY - HexSnakeState.game.attackPointer.startY);
      HexSnakeState.game.attackPointer.moved = HexSnakeState.game.attackPointer.moved || dragDistance > Math.max(8, HexSnakeState.game.cellSize * 0.28) || keyOf(cell) !== keyOf(HexSnakeState.game.attackPointer.startCell);
      if (HexSnakeState.game.attackPointer.moved) {
        clearAttackPointerLongPressTimer();
        HexSnakeState.game.attackPointer.previewProfile = "big";
        previewDirectAttack("big", HexSnakeState.game.attackPointer);
        return;
      }
      previewDirectAttack(HexSnakeState.game.attackPointer.previewProfile, HexSnakeState.game.attackPointer);
      GameRender.requestPreviewDraw();
    }

    function finishBoardAttackPointer(event) {
      if (!HexSnakeState.game.attackPointer || event.pointerId !== HexSnakeState.game.attackPointer.pointerId) return;
      event.preventDefault();
      const pointer = HexSnakeState.game.attackPointer;
      pointer.currentCell = boardCellFromPointer(event);
      HexSnakeState.game.attackPointer = null;
      clearAttackPointerLongPressTimer();
      if (Dom.canvas.hasPointerCapture?.(event.pointerId)) Dom.canvas.releasePointerCapture(event.pointerId);
      const heldLongEnough = performance.now() - pointer.startedAt >= 460;
      const profile = pointer.moved || pointer.longPressed || heldLongEnough ? "big" : "small";
      launchDirectPlayerAttack(profile, pointer);
    }

    function cancelBoardAttackPointer(event) {
      if (!HexSnakeState.game.attackPointer || event.pointerId !== HexSnakeState.game.attackPointer.pointerId) return;
      HexSnakeState.game.attackPointer = null;
      clearAttackPointerLongPressTimer();
      HexSnakeState.game.targetActive = false;
      if (Dom.canvas.hasPointerCapture?.(event.pointerId)) Dom.canvas.releasePointerCapture(event.pointerId);
      GameRender.requestPreviewDraw();
    }

    function currentSettingsPage() {
      if (!Dom.settingsContent.hidden) return "settings";
      if (!Dom.gmContent.hidden) return "gm";
      return "";
    }

    function setSettingsPageTransition(content, direction = "") {
      delete content.dataset.pageTransition;
      if (!direction) return;
      content.dataset.pageTransition = direction;
      window.setTimeout(() => {
        if (content.dataset.pageTransition === direction) delete content.dataset.pageTransition;
      }, 260);
    }

    function updateSettingsPageBars(activePage = currentSettingsPage()) {
      Dom.settingsPageButtons.forEach(button => {
        const active = button.dataset.settingsPageButton === activePage;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
    }

    function openSettingsPage(page) {
      const previousPage = currentSettingsPage();
      if (page === "gm") {
        setGmOpen(true, { direction: previousPage === "settings" ? "next" : "", focus: false });
        return;
      }
      setSettingsOpen(true, { direction: previousPage === "gm" ? "prev" : "", focus: false });
    }

    function updateSettingsPanelState() {
      const settingsPagesOpen = !Dom.settingsContent.hidden || !Dom.gmContent.hidden;
      Dom.settingsToggle.setAttribute("aria-expanded", String(settingsPagesOpen));
      Dom.networkToggle.setAttribute("aria-expanded", String(!Dom.networkContent.hidden));
      Dom.settingsToggle.closest(".settings-section").classList.toggle("open", settingsPagesOpen || !Dom.networkContent.hidden);
      updateSettingsPageBars();
      if (!HexSnakeState.game.running || HexSnakeState.game.gameOver || GameReplay.isPlaybackMode()) {
        Dom.networkToggle.classList.toggle("is-active", !Dom.networkContent.hidden);
      }
    }

    function closeRulesPanelForOverlay() {
      if (Dom.rulesModal.hidden) return;
      Dom.rulesModal.hidden = true;
      Dom.rulesButton.setAttribute("aria-expanded", "false");
    }

    function setSettingsOpen(open, options = {}) {
      const previousPage = currentSettingsPage();
      Dom.settingsContent.hidden = !open;
      if (!open) setPendingDirectionKeybind(null);
      if (open) {
        closeRulesPanelForOverlay();
        Dom.gmContent.hidden = true;
        Dom.networkContent.hidden = true;
        setSettingsPageTransition(Dom.settingsContent, options.direction || (previousPage === "gm" ? "prev" : ""));
        if (options.focus !== false) Dom.settingsCloseButton.focus();
      }
      updateSettingsPanelState();
    }

    function toggleSettings() {
      if (Dom.settingsToggle.disabled || HexSnakeState.game.running) return;
      const settingsPagesOpen = !Dom.settingsContent.hidden || !Dom.gmContent.hidden;
      if (settingsPagesOpen) {
        setSettingsOpen(false);
        setGmOpen(false);
        return;
      }
      setSettingsOpen(true);
    }

    function setGmOpen(open, options = {}) {
      const previousPage = currentSettingsPage();
      Dom.gmContent.hidden = !open;
      if (open && !HexSnakeState.game.running) {
        closeRulesPanelForOverlay();
        Dom.settingsContent.hidden = true;
        Dom.networkContent.hidden = true;
        setPendingDirectionKeybind(null);
        setGmMode(true);
        saveGmSettings();
        setSettingsPageTransition(Dom.gmContent, options.direction || (previousPage === "settings" ? "next" : ""));
        if (options.focus !== false) Dom.gmCloseButton.focus();
      }
      updateSettingsPanelState();
    }

    function setNetworkOpen(open) {
      Dom.networkContent.hidden = !open;
      if (open) {
        closeRulesPanelForOverlay();
        Dom.settingsContent.hidden = true;
        Dom.gmContent.hidden = true;
        setPendingDirectionKeybind(null);
        Dom.networkCloseButton.focus();
      }
      updateSettingsPanelState();
    }

    function toggleNetworkSettings() {
      if (HexSnakeState.game.running && !HexSnakeState.game.gameOver && !GameReplay.isPlaybackMode()) {
        if (HexSnakeState.game.computerBattleMode) setComputerBattleManualOverride(!HexSnakeState.game.computerBattleManualOverride);
        else setPlayerAutoMode(!HexSnakeState.game.playerAutoMode);
        return;
      }
      if (Dom.networkToggle.disabled || HexSnakeState.game.running) return;
      setNetworkOpen(Dom.networkToggle.getAttribute("aria-expanded") !== "true");
    }

    let settingsPageSwipe = null;
    let settingsPageSuppressClickUntil = 0;
    const settingsPageSwipeStartDistance = 12;
    const settingsPageSwipeDistance = 64;

    function isSettingsInteractiveTarget(target) {
      return Boolean(target?.closest?.(
        "a, button, input, label, select, textarea, [contenteditable='true'], [role='button'], [role='tab']"
      ));
    }

    function beginSettingsPageSwipe(event, page) {
      if (event.button !== undefined && event.button !== 0) return;
      settingsPageSwipe = {
        pointerId: event.pointerId,
        page,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false
      };
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture is best effort; the gesture still works without it.
      }
    }

    function moveSettingsPageSwipe(event) {
      if (!settingsPageSwipe || event.pointerId !== settingsPageSwipe.pointerId) return;
      const dx = event.clientX - settingsPageSwipe.startX;
      const dy = event.clientY - settingsPageSwipe.startY;
      if (!settingsPageSwipe.dragging) {
        const horizontal = Math.abs(dx) >= settingsPageSwipeStartDistance && Math.abs(dx) > Math.abs(dy) * 1.15;
        if (!horizontal) return;
        settingsPageSwipe.dragging = true;
      }
      settingsPageSuppressClickUntil = performance.now() + 450;
      event.preventDefault();
      event.stopPropagation();
    }

    function finishSettingsPageSwipe(event) {
      if (!settingsPageSwipe || event.pointerId !== settingsPageSwipe.pointerId) return;
      const swipe = settingsPageSwipe;
      settingsPageSwipe = null;
      const dx = event.clientX - swipe.startX;
      const dy = event.clientY - swipe.startY;
      const shouldSwitch = Math.abs(dx) >= settingsPageSwipeDistance && Math.abs(dx) > Math.abs(dy) * 1.25;
      if (!swipe.dragging && !shouldSwitch) return;
      settingsPageSuppressClickUntil = performance.now() + 450;
      event.preventDefault();
      event.stopPropagation();
      if (!shouldSwitch) return;
      if (swipe.page === "settings" && dx < 0) setGmOpen(true, { direction: "next", focus: false });
      if (swipe.page === "gm" && dx > 0) setSettingsOpen(true, { direction: "prev", focus: false });
    }

    function cancelSettingsPageSwipe(event) {
      if (!settingsPageSwipe || event.pointerId !== settingsPageSwipe.pointerId) return;
      if (settingsPageSwipe.dragging) settingsPageSuppressClickUntil = performance.now() + 450;
      settingsPageSwipe = null;
    }

    function suppressSettingsPageClickAfterDrag(event) {
      if (performance.now() > settingsPageSuppressClickUntil) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    function handlePlatformBackButton() {
      if (!Dom.rulesModal.hidden) {
        HexSnakeUI.closeRulesModal();
        return true;
      }
      if (HexSnakeUI.isTutorialOpen()) {
        HexSnakeUI.finishTutorial(true);
        return true;
      }
      if (!Dom.replayModal.hidden) {
        GameReplay.closeModal();
        return true;
      }
      if (!Dom.statsModal.hidden) {
        GameStats.closeModal();
        return true;
      }
      if (!Dom.versionModal.hidden) {
        GameAbout.closeModal();
        return true;
      }
      if (!Dom.portraitLightbox.hidden) {
        HexSnakeUI.closePortraitLightbox();
        return true;
      }
      if (!Dom.settingsContent.hidden || !Dom.gmContent.hidden || !Dom.networkContent.hidden) {
        setSettingsOpen(false);
        setGmOpen(false);
        setNetworkOpen(false);
        return true;
      }
      if (HexSnakeUI.isLogoTransitionActive()) {
        return Boolean(skipLogoTransition());
      }
      if (GameReplay.isPlaybackMode()) {
        GameReplay.exitPlayback();
        return true;
      }
      if (HexSnakeState.game.running && !HexSnakeState.game.gameOver) {
        if (!HexSnakeState.game.paused) {
          togglePause();
          return true;
        }
        return false;
      }
      return false;
    }

    const HexSnakeGame = Object.freeze({
      attackHitStunChances,
      attackStats,
      attackVisualType,
      axialToPixel,
      bandDistanceFromTotalWidth,
      bandShapeFromTotalWidth,
      boardLineThrough,
      bootstrapGame,
      buildCells,
      canOwnerTurn,
      cellsNearCells,
      characterForVisualType,
      circleDamageMultiplier,
      clearRelayRestartTimer,
      clampInitialBombs,
      clampInitialEnergy,
      clampInitialStock,
      createStartingSnake,
      damageSnake,
      directionFromSourceToTarget,
      directionScreenAngle,
      flashAttackButton,
      hexDistance,
      hexPath,
      isPlayerAutoControlActive,
      isOwnerDamageImmune,
      keyOf,
      launchAttack,
      lineBandDamageMultiplier,
      loadGameShell,
      loadSavedCharacterChoices,
      lobsterFistPath,
      nextWrappedCell,
      opponentHeadTarget,
      ownerDirection,
      pointAlongPath,
      returnToStartScreen,
      resize,
      sandwormUndergroundAlpha,
      saveCharacterChoices,
      setGmOpen,
      setSettingsLocked,
      setSettingsOpen,
      setStatus,
      stableVariantIndex,
      syncCharacterInputs,
      turnDistance,
      updateAutoBattleControls,
      updatePerfOverlay,
      updateHud,
      updateSettingsActionMode
    });

    let gameShellLoaded = false;
    let gameBootstrapPromise = null;
    const gameBootstrapContract = Object.freeze({
      mode: "game",
      entry: "src/game.js",
      bootstrapsGameplay: true
    });

    function loadGameShell() {
      if (gameShellLoaded) return HexSnakeGame;
      gameShellLoaded = true;

    document.addEventListener("pointerdown", GameAudio.unlock, { once: true, passive: true });
    document.addEventListener("keydown", GameAudio.unlock, { once: true });

    Dom.settingsToggle.addEventListener("click", toggleSettings);
    Dom.networkToggle.addEventListener("click", toggleNetworkSettings);
    Dom.settingsCloseButton.addEventListener("click", () => setSettingsOpen(false));
    Dom.gmCloseButton.addEventListener("click", () => setGmOpen(false));
    Dom.networkCloseButton.addEventListener("click", () => setNetworkOpen(false));
    Dom.settingsPageButtons.forEach(button => {
      button.addEventListener("click", () => openSettingsPage(button.dataset.settingsPageButton));
    });

    Dom.settingsToggle.addEventListener("pointerdown", event => {
      event.stopPropagation();
    });

    Dom.networkToggle.addEventListener("pointerdown", event => {
      event.stopPropagation();
    });

    Dom.settingsContent.addEventListener("pointerdown", event => {
      if (event.target === Dom.settingsContent) {
        setSettingsOpen(false);
        return;
      }
      if (isSettingsInteractiveTarget(event.target)) return;
      beginSettingsPageSwipe(event, "settings");
    }, { capture: true });
    Dom.settingsContent.addEventListener("pointermove", moveSettingsPageSwipe, { capture: true, passive: false });
    Dom.settingsContent.addEventListener("pointerup", finishSettingsPageSwipe, { capture: true });
    Dom.settingsContent.addEventListener("pointercancel", cancelSettingsPageSwipe, { capture: true });
    Dom.settingsContent.addEventListener("click", suppressSettingsPageClickAfterDrag, { capture: true });

    Dom.gmContent.addEventListener("pointerdown", event => {
      if (event.target === Dom.gmContent) {
        setGmOpen(false);
        return;
      }
      if (isSettingsInteractiveTarget(event.target)) return;
      beginSettingsPageSwipe(event, "gm");
    }, { capture: true });
    Dom.gmContent.addEventListener("pointermove", moveSettingsPageSwipe, { capture: true, passive: false });
    Dom.gmContent.addEventListener("pointerup", finishSettingsPageSwipe, { capture: true });
    Dom.gmContent.addEventListener("pointercancel", cancelSettingsPageSwipe, { capture: true });
    Dom.gmContent.addEventListener("click", suppressSettingsPageClickAfterDrag, { capture: true });

    Dom.networkContent.addEventListener("pointerdown", event => {
      if (event.target === Dom.networkContent) {
        setNetworkOpen(false);
        return;
      }
      event.stopPropagation();
    });

    Dom.characterStage.addEventListener("pointerdown", event => {
      if (GameReplay.isPlaybackMode()) return;
      const module = event.target.closest('[data-module="player"]');
      if (!module) return;
      event.preventDefault();
    });

    Dom.characterStage.addEventListener("pointerup", clearModuleHold);
    Dom.characterStage.addEventListener("pointercancel", clearModuleHold);
    Dom.characterStage.addEventListener("pointerleave", clearModuleHold);

    Dom.winnerPortrait.addEventListener("pointerdown", event => {
      const swipeZone = event.target.closest("[data-portrait-swipe-owner]");
      if (swipeZone && (event.target.closest("[data-portrait-select]") || event.target.closest(".intro-avatar-gate"))) {
        HexSnakeState.ui.portraitSwipeStartX = event.clientX;
        HexSnakeState.ui.portraitSwipeStartY = event.clientY;
        HexSnakeState.ui.portraitSwipeOwner = swipeZone.dataset.portraitSwipeOwner === "computer" ? "computer" : "player";
        HexSnakeState.ui.portraitIntroDidSwipe = false;
        return;
      }
      if (event.target.closest(".portrait-copy") && event.target.closest("[data-portrait-select]")) {
        HexSnakeState.ui.portraitInfoSwipeStartX = event.clientX;
        HexSnakeState.ui.portraitInfoSwipeStartY = event.clientY;
        HexSnakeState.ui.portraitIntroDidSwipe = false;
      }
    });

    Dom.winnerPortrait.addEventListener("click", event => {
      if (HexSnakeState.ui.portraitIntroDidSwipe) {
        HexSnakeState.ui.portraitIntroDidSwipe = false;
        return;
      }
      const portraitShift = event.target.closest("[data-portrait-shift][data-portrait-owner]");
      if (portraitShift) {
        HexSnakeUI.applyPortraitCharacter(portraitShift.dataset.portraitOwner, Number(portraitShift.dataset.portraitShift));
        return;
      }
      const resultPortrait = event.target.closest("[data-result-owner]");
      if (resultPortrait) {
        openGameOverCharacterSelect(resultPortrait.dataset.resultOwner);
        return;
      }
      const fullPortrait = event.target.closest("[data-full-portrait]");
      if (fullPortrait) {
        const owner = fullPortrait.dataset.fullPortrait === "computer" ? "computer" : "player";
        if (owner !== HexSnakeState.ui.selectedPortraitOwner) {
          HexSnakeUI.selectPortraitOwner(owner);
          return;
        }
        HexSnakeUI.openPortraitLightbox(owner);
        return;
      }
      const portraitOption = event.target.closest("[data-portrait-owner]");
      if (portraitOption) {
        HexSnakeUI.selectPortraitOwner(portraitOption.dataset.portraitOwner === "computer" ? "computer" : "player");
        return;
      }
      const introButton = event.target.closest("[data-open-intro]");
      if (!introButton) return;
      HexSnakeState.ui.selectedPortraitOwner = introButton.dataset.openIntro === "computer" ? "computer" : "player";
      Dom.overlayTitle.textContent = "角色選擇";
      Dom.overlayText.textContent = "點擊 P1 或 P2 立繪選擇要調整的角色，使用左右箭頭切換。";
      Dom.startButton.textContent = "開始";
      HexSnakeUI.renderIntroPortraits(true);
    });

    Dom.winnerPortrait.addEventListener("pointerup", event => {
      if (HexSnakeState.ui.portraitSwipeStartX !== null) {
        const deltaX = event.clientX - HexSnakeState.ui.portraitSwipeStartX;
        const deltaY = event.clientY - HexSnakeState.ui.portraitSwipeStartY;
        const owner = HexSnakeState.ui.portraitSwipeOwner;
        HexSnakeState.ui.portraitSwipeStartX = null;
        HexSnakeState.ui.portraitSwipeStartY = null;
        HexSnakeState.ui.portraitSwipeOwner = null;
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) >= 42) {
          HexSnakeState.ui.portraitIntroDidSwipe = true;
          setTimeout(() => {
            HexSnakeState.ui.portraitIntroDidSwipe = false;
          }, 160);
          HexSnakeUI.shiftPortraitVariantMode(deltaY < 0 ? -1 : 1);
          return;
        }
        if (Math.abs(deltaX) < 42) return;
        HexSnakeState.ui.portraitIntroDidSwipe = true;
        setTimeout(() => {
          HexSnakeState.ui.portraitIntroDidSwipe = false;
        }, 160);
        HexSnakeUI.applyPortraitCharacter(owner, deltaX < 0 ? 1 : -1);
        return;
      }
      if (HexSnakeState.ui.portraitInfoSwipeStartX !== null) {
        const deltaX = event.clientX - HexSnakeState.ui.portraitInfoSwipeStartX;
        const deltaY = event.clientY - HexSnakeState.ui.portraitInfoSwipeStartY;
        HexSnakeState.ui.portraitInfoSwipeStartX = null;
        HexSnakeState.ui.portraitInfoSwipeStartY = null;
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) >= 42) {
          HexSnakeState.ui.portraitIntroDidSwipe = true;
          setTimeout(() => {
            HexSnakeState.ui.portraitIntroDidSwipe = false;
          }, 160);
          HexSnakeUI.shiftPortraitVariantMode(deltaY < 0 ? -1 : 1);
          return;
        }
        if (Math.abs(deltaX) < 42) return;
        HexSnakeState.ui.portraitIntroDidSwipe = true;
        setTimeout(() => {
          HexSnakeState.ui.portraitIntroDidSwipe = false;
        }, 160);
        HexSnakeUI.applyPortraitCharacter(HexSnakeState.ui.selectedPortraitOwner, deltaX < 0 ? 1 : -1);
      }
    });

    Dom.winnerPortrait.addEventListener("pointercancel", () => {
      HexSnakeState.ui.portraitSwipeStartX = null;
      HexSnakeState.ui.portraitSwipeStartY = null;
      HexSnakeState.ui.portraitSwipeOwner = null;
      HexSnakeState.ui.portraitInfoSwipeStartX = null;
      HexSnakeState.ui.portraitInfoSwipeStartY = null;
    });

    Dom.portraitLightboxClose.addEventListener("click", HexSnakeUI.closePortraitLightbox);

    Dom.portraitLightboxShiftButtons.forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        HexSnakeUI.shiftPortraitLightbox(Number(button.dataset.portraitLightboxShift));
      });
    });

    Dom.portraitLightboxVariantButtons.forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        HexSnakeUI.shiftPortraitVariantMode(button.dataset.portraitLightboxDirection === "up" ? -1 : 1);
      });
    });

    Dom.portraitLightbox.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      HexSnakeState.ui.portraitSwipeStartX = event.clientX;
      HexSnakeState.ui.portraitSwipeStartY = event.clientY;
      HexSnakeState.ui.portraitLightboxDidSwipe = false;
    });

    Dom.portraitLightbox.addEventListener("pointerup", event => {
      if (HexSnakeState.ui.portraitSwipeStartX === null) return;
      const deltaX = event.clientX - HexSnakeState.ui.portraitSwipeStartX;
      const deltaY = event.clientY - HexSnakeState.ui.portraitSwipeStartY;
      HexSnakeState.ui.portraitSwipeStartX = null;
      HexSnakeState.ui.portraitSwipeStartY = null;
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) >= 42) {
        HexSnakeState.ui.portraitLightboxDidSwipe = true;
        HexSnakeUI.shiftPortraitVariantMode(deltaY < 0 ? -1 : 1);
        return;
      }
      if (Math.abs(deltaX) < 42) return;
      HexSnakeState.ui.portraitLightboxDidSwipe = true;
      HexSnakeUI.shiftPortraitLightbox(deltaX < 0 ? 1 : -1);
    });

    Dom.portraitLightbox.addEventListener("pointercancel", () => {
      HexSnakeState.ui.portraitSwipeStartX = null;
      HexSnakeState.ui.portraitSwipeStartY = null;
    });

    Dom.portraitLightbox.addEventListener("click", event => {
      if (HexSnakeState.ui.portraitLightboxDidSwipe) {
        HexSnakeState.ui.portraitLightboxDidSwipe = false;
        return;
      }
      if (event.target === Dom.portraitLightbox) HexSnakeUI.closePortraitLightbox();
    });

    Dom.gridSizeInput.addEventListener("change", () => {
      if (HexSnakeState.game.running) return;
      setGridSize(Dom.gridSizeInput.value);
      applyGmSettingsChanged();
      cancelAnimationFrame(HexSnakeState.game.rafId);
      resetGame();
      resize();
      Dom.overlayTitle.textContent = "棋盤已更新";
      Dom.overlayText.textContent = `棋盤半徑已設為 ${HexSnakeState.game.gridSize}。開始後設定會鎖定到下一局。`;
      Dom.startButton.textContent = "開始";
      HexSnakeUI.renderIntroPortraits(true);
      Dom.overlay.classList.add("show");
    });

    Dom.foodCountInput.addEventListener("change", () => {
      if (HexSnakeState.game.running) return;
      setFoodCount(Dom.foodCountInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
      Dom.overlayTitle.textContent = "食物數量已更新";
      Dom.overlayText.textContent = `場上會維持 ${HexSnakeState.game.foodCount} 個蛋白、脂肪、纖維、碳水隨機食物。`;
      Dom.startButton.textContent = "開始";
      HexSnakeUI.renderIntroPortraits(true);
      Dom.overlay.classList.add("show");
    });

    Dom.computerDifficultyInput.addEventListener("change", () => {
      if (HexSnakeState.game.running) return;
      setComputerDifficulty(Dom.computerDifficultyInput.value);
      saveGmSettings();
      resetGame();
      resize();
      Dom.overlayTitle.textContent = "難度已更新";
      Dom.overlayText.textContent = `電腦難度設為 ${computerDifficultyInput.selectedOptions[0].textContent}。`;
      Dom.startButton.textContent = "開始";
      HexSnakeUI.renderIntroPortraits(true);
      Dom.overlay.classList.add("show");
    });

    Dom.initialSpeedInput.addEventListener("change", () => {
      if (HexSnakeState.game.running) return;
      setInitialSpeed(Dom.initialSpeedInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
      Dom.overlayTitle.textContent = "初始速度已更新";
      Dom.overlayText.textContent = `初始速度已設為 ${HexSnakeState.game.initialSpeed}x。`;
      Dom.startButton.textContent = "開始";
      HexSnakeUI.renderIntroPortraits(true);
      Dom.overlay.classList.add("show");
    });

    Dom.initialLengthInput.addEventListener("change", () => {
      if (HexSnakeState.game.running) return;
      setInitialLength(Dom.initialLengthInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
    });

    Dom.initialEnergyInput.addEventListener("change", () => {
      if (HexSnakeState.game.running) return;
      setInitialEnergy(Dom.initialEnergyInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
    });

    Dom.initialBombsInput.addEventListener("change", () => {
      if (HexSnakeState.game.running) return;
      setInitialBombs(Dom.initialBombsInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
    });

    Dom.initialStockInputs.forEach(input => {
      input.addEventListener("change", () => {
        if (HexSnakeState.game.running) return;
        setInitialStock(input.dataset.initialStock, input.value);
        applyGmSettingsChanged();
        resetGame();
        resize();
      });
    });

    [Dom.playerCharacterInput, Dom.computerCharacterInput].forEach(input => {
      input.addEventListener("change", () => {
        if (HexSnakeState.game.running) return;
        const changedOwner = input === Dom.computerCharacterInput ? "computer" : "player";
        HexSnakeState.game.playerCharacterChoice = HexSnakeUI.isSelectableCharacterChoiceId(Dom.playerCharacterInput.value) ? Dom.playerCharacterInput.value : HexSnakeState.config.defaultSettings.playerCharacterId;
        HexSnakeState.game.computerCharacterChoice = HexSnakeUI.isSelectableCharacterChoiceId(Dom.computerCharacterInput.value) ? Dom.computerCharacterInput.value : HexSnakeState.config.defaultSettings.computerCharacterId;
        if (HexSnakeUI.hasCharacterId(HexSnakeState.game.playerCharacterChoice)) HexSnakeState.game.playerCharacterId = HexSnakeState.game.playerCharacterChoice;
        if (HexSnakeUI.hasCharacterId(HexSnakeState.game.computerCharacterChoice)) HexSnakeState.game.computerCharacterId = HexSnakeState.game.computerCharacterChoice;
        syncCharacterInputs();
        saveCharacterChoices();
        HexSnakeUI.preloadPortraitsFor("player");
        HexSnakeUI.preloadPortraitsFor("computer");
        HexSnakeUI.buildCharacterStage();
        resetGame();
        resize();
        Dom.overlayTitle.textContent = "角色已更新";
        Dom.overlayText.textContent = `P1 選擇 ${HexSnakeUI.selectedCharacterFor("player")?.name || "隨機選擇"}，P2 選擇 ${HexSnakeUI.selectedCharacterFor("computer")?.name || "隨機選擇"}。`;
        Dom.startButton.textContent = "開始";
        HexSnakeUI.renderIntroPortraits(true);
        Dom.overlay.classList.add("show");
        const selectedId = changedOwner === "computer" ? HexSnakeState.game.computerCharacterChoice : HexSnakeState.game.playerCharacterChoice;
        const selectedCharacter = HexSnakeUI.characterForId(selectedId);
        if (selectedCharacter) {
          GameAudio.playCharacter(changedOwner, "select", { character: selectedCharacter, unlock: true });
        }
      });
    });

    Dom.resetBestTimeButton.addEventListener("click", () => {
      HexSnakeState.game.bestTotalMs = 0;
      GameStorage.set("hexSnakeBestTotalMs", "0");
      updateHud();
    });

    Dom.realModeButton.addEventListener("click", () => {
      if (HexSnakeState.game.running) return;
      setGmMode(true);
      resetGmParameters();
      applyGmSettingsChanged({ presetMode: "real" });
      refreshGmPreview();
    });

    Dom.midGameModeButton.addEventListener("click", () => {
      if (HexSnakeState.game.running) return;
      applyMidGameModePreset();
      applyGmSettingsChanged({ presetMode: "mid" });
      refreshGmPreview();
    });

    Dom.ultimateModeButton.addEventListener("click", () => {
      if (HexSnakeState.game.running) return;
      applyUltimateModePreset();
      applyGmSettingsChanged({ presetMode: "battle" });
      refreshGmPreview();
    });

    Dom.lateGameModeButton.addEventListener("click", () => {
      if (HexSnakeState.game.running) return;
      applyLateGameModePreset();
      applyGmSettingsChanged({ presetMode: "late" });
      refreshGmPreview();
    });

    Dom.resetSettingsButton.addEventListener("click", () => {
      if (HexSnakeState.game.running) return;
      setComputerDifficulty(HexSnakeState.config.defaultSettings.computerDifficulty);
      setGmMode(HexSnakeState.config.defaultSettings.gmMode);
      resetGmParameters();
      applyGmSettingsChanged({ presetMode: "real" });
      HexSnakeState.game.playerCharacterId = HexSnakeState.config.defaultSettings.playerCharacterId;
      HexSnakeState.game.computerCharacterId = HexSnakeState.config.defaultSettings.computerCharacterId;
      HexSnakeState.game.playerCharacterChoice = HexSnakeState.game.playerCharacterId;
      HexSnakeState.game.computerCharacterChoice = HexSnakeState.game.computerCharacterId;
      syncCharacterInputs();
      saveCharacterChoices();
      HexSnakeState.game.keybinds = structuredClone(HexSnakeState.config.defaultKeybinds);
      saveKeybinds();
      applyKeybinds();
      setLeftHandMode(false);
      renderControlProfiles();
      GameAudio.setMuted(false);
      GamePlatform.display.clearLowPowerModePreference();
      syncLowPowerMode();
      setPerfStatsVisible(false);
      resetGame();
      resize();
      Dom.overlayTitle.textContent = "已回到預設值";
      Dom.overlayText.textContent = "一般設定已恢復預設，GM 設定維持不變。";
      Dom.startButton.textContent = "開始";
      HexSnakeUI.renderIntroPortraits(true);
      Dom.overlay.classList.add("show");
    });

    function defaultPlayerAttackTarget() {
      return HexSnakeState.game.targetCell || HexSnakeState.game.computerSnake[0] || HexSnakeState.game.snake[0];
    }

    function attackButtonPointerTarget(profile) {
      if (profile === "big" && GameAI.bigAttackUsesDrawnDirection(HexSnakeUI.characterFor("player").id)) {
        return directionalAttackTarget(ownerDirection("player"));
      }
      return defaultPlayerAttackTarget();
    }

    function attackButtonPointerOptions(profile) {
      if (profile === "big" && GameAI.bigAttackUsesDrawnDirection(HexSnakeUI.characterFor("player").id)) {
        return { aimDirection: ownerDirection("player"), aimOrigin: HexSnakeState.game.snake[0] };
      }
      return {};
    }

    function handleAttackButtonDown(event, profile) {
      event.preventDefault();
      event.stopPropagation();
      if (HexSnakeUI.isLogoTransitionActive()) return;
      HexSnakeState.game.attackButtonPointerId = event.pointerId;
      setAttackButtonHighlight(profile);
      triggerTouchFeedback(event, profile === "big" ? 12 : 8);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture keeps the visual press state paired with release/cancel.
      }
      previewDirectAttack(profile);
    }

    function handleAttackButtonUp(event, profile) {
      event.preventDefault();
      event.stopPropagation();
      if (HexSnakeUI.isLogoTransitionActive()) return;
      if (HexSnakeState.game.attackButtonPointerId !== null && event.pointerId !== HexSnakeState.game.attackButtonPointerId) return;
      HexSnakeState.game.attackButtonPointerId = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      releaseAttackButtonHighlight();
      triggerTouchFeedback(event, 5);
      launchDirectPlayerAttack(profile);
    }

    function handleAttackButtonCancel(event) {
      if (HexSnakeState.game.attackButtonPointerId !== null && event.pointerId !== HexSnakeState.game.attackButtonPointerId) return;
      HexSnakeState.game.attackButtonPointerId = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setAttackButtonHighlight(null);
    }

    function handleKeyboardAimButtonDown(event, profile) {
      event.preventDefault();
      event.stopPropagation();
      if (HexSnakeUI.isLogoTransitionActive()) return;
      HexSnakeState.game.attackButtonPointerId = event.pointerId;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture keeps the visual press state paired with release/cancel.
      }
      handleKeyboardAimKeyDown(event, profile, `button-${profile}`);
    }

    function handleKeyboardAimButtonUp(event, profile) {
      event.preventDefault();
      event.stopPropagation();
      if (HexSnakeState.game.attackButtonPointerId !== null && event.pointerId !== HexSnakeState.game.attackButtonPointerId) return;
      HexSnakeState.game.attackButtonPointerId = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      handleKeyboardAimKeyUp(event, `button-${profile}`);
    }

    function handleKeyboardAimButtonCancel(event) {
      if (HexSnakeState.game.attackButtonPointerId !== null && event.pointerId !== HexSnakeState.game.attackButtonPointerId) return;
      HexSnakeState.game.attackButtonPointerId = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      clearKeyboardAimKeyLocks();
    }

    Dom.smallAttackButton.addEventListener("pointerdown", event => handleAttackButtonDown(event, "small"));
    Dom.bigAttackButton.addEventListener("pointerdown", event => handleAttackButtonDown(event, "big"));
    Dom.keyboardSmallAimButton.addEventListener("pointerdown", event => handleKeyboardAimButtonDown(event, "small"));
    Dom.keyboardBigAimButton.addEventListener("pointerdown", event => handleKeyboardAimButtonDown(event, "big"));
    Dom.smallAttackButton.addEventListener("pointerup", event => handleAttackButtonUp(event, "small"));
    Dom.bigAttackButton.addEventListener("pointerup", event => handleAttackButtonUp(event, "big"));
    Dom.keyboardSmallAimButton.addEventListener("pointerup", event => handleKeyboardAimButtonUp(event, "small"));
    Dom.keyboardBigAimButton.addEventListener("pointerup", event => handleKeyboardAimButtonUp(event, "big"));
    Dom.smallAttackButton.addEventListener("pointercancel", handleAttackButtonCancel);
    Dom.bigAttackButton.addEventListener("pointercancel", handleAttackButtonCancel);
    Dom.keyboardSmallAimButton.addEventListener("pointercancel", handleKeyboardAimButtonCancel);
    Dom.keyboardBigAimButton.addEventListener("pointercancel", handleKeyboardAimButtonCancel);
    Dom.smallAttackButton.addEventListener("click", event => event.preventDefault());
    Dom.bigAttackButton.addEventListener("click", event => event.preventDefault());
    Dom.keyboardSmallAimButton.addEventListener("click", event => event.preventDefault());
    Dom.keyboardBigAimButton.addEventListener("click", event => event.preventDefault());
    Dom.targetModeSmallIndicator.addEventListener("pointerdown", event => remindKeyboardAttackTarget("small", event));
    Dom.targetModeBigIndicator.addEventListener("pointerdown", event => remindKeyboardAttackTarget("big", event));
    Dom.targetModeSmallIndicator.addEventListener("click", event => event.preventDefault());
    Dom.targetModeBigIndicator.addEventListener("click", event => event.preventDefault());
    Dom.controlRow.addEventListener("pointerdown", event => {
      if (Dom.joyZone.contains(event.target)) return;
      if (event.target.closest("#bigAttackButton")) previewDirectAttack("big");
    });
    Dom.leftHandModeInput.addEventListener("change", () => setLeftHandMode(Dom.leftHandModeInput.checked));
    Dom.sfxMuteToggle.addEventListener("change", () => GameAudio.setMuted(Dom.sfxMuteToggle.checked));
    Dom.lowPowerModeInput.addEventListener("change", () => setLowPowerPreference(Dom.lowPowerModeInput.checked));
    Dom.perfStatsToggle.addEventListener("change", () => setPerfStatsVisible(Dom.perfStatsToggle.checked));
    Dom.surrenderButton.addEventListener("click", surrenderGame);
    Dom.rulesButton.addEventListener("click", HexSnakeUI.openRulesModal);
    Dom.rulesCloseButton.addEventListener("click", HexSnakeUI.closeRulesModal);
    Dom.rulesContent.addEventListener("click", event => {
      if (event.target.closest("[data-open-tutorial]")) HexSnakeUI.showTutorial(0);
    });
    Dom.rulesContent.addEventListener("keydown", event => {
      const tutorialCard = event.target.closest("[data-open-tutorial]");
      if (!tutorialCard || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      HexSnakeUI.showTutorial(0);
    });
    Dom.replayArchiveButton.addEventListener("click", GameReplay.openModal);
    Dom.settingsReplayButton.addEventListener("click", GameReplay.openModal);
    Dom.overlayText.addEventListener("click", event => {
      if (!Dom.overlayText.classList.contains("is-copyable-result")) return;
      event.preventDefault();
      copyCurrentResult();
    });
    Dom.overlayText.addEventListener("keydown", event => {
      if (!Dom.overlayText.classList.contains("is-copyable-result")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      copyCurrentResult();
    });
    Dom.controlProfileSelect.addEventListener("change", () => {
      selectedControlProfileId = Dom.controlProfileSelect.value;
      saveSelectedControlProfileId();
      const profile = selectedControlProfile();
      if (profile) Dom.controlProfileNameInput.value = profile.name;
      renderControlProfiles();
    });
    Dom.controlProfileNameInput.addEventListener("input", () => setControlProfileStatus(""));
    Dom.controlProfileSaveButton.addEventListener("click", saveCurrentControlProfile);
    Dom.controlProfileApplyButton.addEventListener("click", applySelectedControlProfile);
    Dom.controlProfileDeleteButton.addEventListener("click", deleteSelectedControlProfile);
    Dom.statsButton.addEventListener("click", GameStats.openModal);
    Dom.statsModalClose.addEventListener("click", GameStats.closeModal);
    Dom.statsClearButton.addEventListener("click", GameStats.clear);
    Dom.statsModal.addEventListener("pointerdown", event => {
      if (event.target === Dom.statsModal) GameStats.closeModal();
    });
    Dom.statsModal.querySelector(".app-stats-dialog").addEventListener("pointerdown", event => event.stopPropagation());
    Dom.versionInfoButton.addEventListener("click", GameAbout.openModal);
    Dom.versionModalClose.addEventListener("click", GameAbout.closeModal);
    Dom.versionModal.addEventListener("pointerdown", event => {
      if (event.target === Dom.versionModal) GameAbout.closeModal();
    });
    Dom.versionModal.querySelector(".app-version-dialog").addEventListener("pointerdown", event => event.stopPropagation());
    Dom.replayModalClose.addEventListener("click", GameReplay.closeModal);
    Dom.replayModal.addEventListener("pointerdown", event => {
      if (event.target === Dom.replayModal) GameReplay.closeModal();
    });
    Dom.replayModal.querySelector(".replay-dialog").addEventListener("pointerdown", event => event.stopPropagation());
    Dom.replayModal.addEventListener("click", event => {
      const playButton = event.target.closest("[data-replay-play]");
      const favoriteButton = event.target.closest("[data-replay-favorite]");
      const deleteButton = event.target.closest("[data-replay-delete]");
      if (playButton) {
        const record = GameReplay.findRecord(playButton.dataset.replayPlay);
        if (record) GameReplay.startPlayback(record);
        return;
      }
      if (favoriteButton) {
        GameReplay.toggleFavorite(favoriteButton.dataset.replayFavorite);
        return;
      }
      if (deleteButton) {
        GameReplay.deleteRecord(deleteButton.dataset.replayDelete, deleteButton.dataset.replaySection);
      }
    });
    Dom.replayPlayButton.addEventListener("click", () => {
      GameReplay.togglePlaybackPaused();
    });
    Dom.replayReverseButton.addEventListener("click", () => {
      GameReplay.reversePlayback();
    });
    Dom.replayPrevButton.addEventListener("click", () => {
      GameReplay.switchPlayback(-1);
    });
    Dom.replayNextButton.addEventListener("click", () => {
      GameReplay.switchPlayback(1);
    });
    Dom.replaySpeedSelect.addEventListener("change", () => {
      GameReplay.setPlaybackSpeed(Dom.replaySpeedSelect.value);
    });
    Dom.replayTimeline.addEventListener("input", () => {
      GameReplay.seekPlayback(Dom.replayTimeline.value);
    });
    Dom.replayExitButton.addEventListener("click", GameReplay.exitPlayback);
    Dom.rulesModal.addEventListener("pointerdown", event => {
      if (event.target === Dom.rulesModal) HexSnakeUI.closeRulesModal();
    });
    Dom.rulesModal.querySelector(".rules-dialog").addEventListener("pointerdown", event => event.stopPropagation());

    Dom.keybindInputs.forEach(input => {
      input.addEventListener("keydown", event => {
        event.preventDefault();
        const value = event.key === " " ? " " : event.key;
        input.value = keyLabel(normalizeKey(value, input.value));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      input.addEventListener("change", () => {
        const normalized = normalizeKey(input.value, " ");
        if (input.id === "smallAttackKey") HexSnakeState.game.keybinds.smallAttack = normalized;
        else if (input.id === "bigAttackKey") HexSnakeState.game.keybinds.bigAttack = normalized;
        else if (input.id === "pauseKey") HexSnakeState.game.keybinds.pause = normalized;
        else if (input.id === "surrenderKey") HexSnakeState.game.keybinds.surrender = normalized;
        else if (input.dataset.keybindDir !== undefined) HexSnakeState.game.keybinds.directions[Number(input.dataset.keybindDir)] = normalized;
        saveKeybinds();
        applyKeybinds();
      });
    });

    Dom.settingsDirButtons.forEach(button => {
      button.addEventListener("click", () => {
        setPendingDirectionKeybind(Number(button.dataset.dir));
        button.focus();
      });
    });

    Dom.introCloseButton.addEventListener("click", () => {
      HexSnakeUI.renderIntroPortraits(false);
      Dom.overlay.classList.add("show");
    });

    const tutorialActionButtonFromEvent = (event) => {
      const path = event.composedPath?.() || [];
      for (const node of path) {
        if (node instanceof Element && typeof node.closest === "function") {
          const button = node.closest("[data-tutorial-action]");
          if (button) return button;
        }
      }
      return event.target?.closest?.("[data-tutorial-action]") || null;
    };

    Dom.winnerPortrait.addEventListener("click", event => {
      if (HexSnakeState.ui.tutorialSwipeDidMove) {
        HexSnakeState.ui.tutorialSwipeDidMove = false;
        event.preventDefault();
        return;
      }
      const button = tutorialActionButtonFromEvent(event);
      if (!button) return;
      const action = button.dataset.tutorialAction;
      if (action === "next") {
        HexSnakeUI.moveTutorial(1);
      } else if (action === "prev") {
        HexSnakeUI.moveTutorial(-1);
      } else if (action === "skip" || action === "done") {
        HexSnakeUI.finishTutorial(true);
      }
    });

    Dom.overlay.addEventListener("pointerdown", event => {
      if (!HexSnakeUI.isTutorialOpen() || event.button > 0) return;
      if (tutorialActionButtonFromEvent(event)) return;
      HexSnakeState.ui.tutorialSwipeStartX = event.clientX;
      HexSnakeState.ui.tutorialSwipeStartY = event.clientY;
      HexSnakeState.ui.tutorialSwipePointerId = event.pointerId;
      HexSnakeState.ui.tutorialSwipeDidMove = false;
      Dom.overlay.setPointerCapture?.(event.pointerId);
    }, true);

    Dom.overlay.addEventListener("pointermove", event => {
      if (!HexSnakeUI.isTutorialOpen() || HexSnakeState.ui.tutorialSwipeStartX === null) return;
      if (HexSnakeState.ui.tutorialSwipePointerId !== null && event.pointerId !== HexSnakeState.ui.tutorialSwipePointerId) return;
      const deltaX = event.clientX - HexSnakeState.ui.tutorialSwipeStartX;
      const deltaY = event.clientY - HexSnakeState.ui.tutorialSwipeStartY;
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) event.preventDefault();
    }, true);

    Dom.overlay.addEventListener("pointerup", event => {
      if (!HexSnakeUI.isTutorialOpen() || HexSnakeState.ui.tutorialSwipeStartX === null) return;
      if (HexSnakeState.ui.tutorialSwipePointerId !== null && event.pointerId !== HexSnakeState.ui.tutorialSwipePointerId) return;
      const deltaX = event.clientX - HexSnakeState.ui.tutorialSwipeStartX;
      const deltaY = event.clientY - HexSnakeState.ui.tutorialSwipeStartY;
      const pointerId = HexSnakeState.ui.tutorialSwipePointerId;
      HexSnakeState.ui.tutorialSwipeStartX = null;
      HexSnakeState.ui.tutorialSwipeStartY = null;
      HexSnakeState.ui.tutorialSwipePointerId = null;
      if (pointerId !== null && Dom.overlay.hasPointerCapture?.(pointerId)) Dom.overlay.releasePointerCapture(pointerId);
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 42) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      HexSnakeState.ui.tutorialSwipeDidMove = true;
      event.preventDefault();
      HexSnakeUI.moveTutorial(deltaX < 0 ? 1 : -1);
      setTimeout(() => {
        HexSnakeState.ui.tutorialSwipeDidMove = false;
      }, 160);
    }, true);

    Dom.overlay.addEventListener("pointercancel", event => {
      if (HexSnakeState.ui.tutorialSwipePointerId === null || event.pointerId !== HexSnakeState.ui.tutorialSwipePointerId) return;
      const pointerId = HexSnakeState.ui.tutorialSwipePointerId;
      HexSnakeState.ui.tutorialSwipeStartX = null;
      HexSnakeState.ui.tutorialSwipeStartY = null;
      HexSnakeState.ui.tutorialSwipePointerId = null;
      if (Dom.overlay.hasPointerCapture?.(pointerId)) Dom.overlay.releasePointerCapture(pointerId);
    }, true);

    Dom.startButton.addEventListener("click", () => {
      if (GameReplay.isPlaybackMode()) return;
      if (!HexSnakeUI.hasCharacterCatalog()) {
        window.location.reload();
        return;
      }
      if (HexSnakeState.game.paused && HexSnakeState.game.running && !HexSnakeState.game.gameOver) {
        HexSnakeState.game.paused = false;
        setStatus("對戰中：吃食物累積能量，集滿可獲得炸彈。");
        Dom.overlay.classList.remove("show");
        HexSnakeUI.showCharacterStage({ rebuild: false, "overlay": false });
        HexSnakeState.game.lastPlayerStep = performance.now();
        HexSnakeState.game.lastComputerStep = HexSnakeState.game.lastPlayerStep;
        HexSnakeState.game.lastTimerFrame = HexSnakeState.game.lastPlayerStep;
        updateAutoBattleControls();
        return;
      }
      if (HexSnakeState.game.gameOver) {
        if (!canRestartAfterGameOver()) return;
        returnToStartScreen();
        return;
      }
      Dom.overlayTitle.textContent = "準備開局";
      Dom.overlayText.textContent = `每吃 1 個食物獲得 2 點能量，集滿 ${HexSnakeState.config.attackNeedTotal} 點獲得 1 枚炸彈，最多 ${HexSnakeState.config.maxAmmo} 枚；HP 上限為（蛇長 + 1）× ${HexSnakeState.config.hpPerSnakeUnit}；能量與炸彈都滿時，施放消耗炸彈的招式會立刻把滿能量轉為 1 枚炸彈；小招消耗目前最高的食物庫存 ${HexSnakeState.config.smallAttackFoodCost} 點與 ${HexSnakeState.config.smallAttackBombCost} 枚炸彈，大招消耗 ${HexSnakeState.config.bigAttackBombCost} 枚炸彈與四種庫存各 2 點。`;
      Dom.startButton.textContent = "開始";
      HexSnakeUI.setOverlayChromeVisible(true);
      beginStartLogoCountdown();
    });

    Dom.computerBattleButton.addEventListener("click", () => {
      if (GameReplay.isPlaybackMode()) return;
      if (!HexSnakeUI.hasCharacterCatalog()) {
        window.location.reload();
        return;
      }
      if (HexSnakeState.game.gameOver && !canRestartAfterGameOver()) return;
      Dom.overlayTitle.textContent = "自動對弈";
      Dom.overlayText.textContent = "P1 / P2 皆自動操作，控制面板可調整對弈速度或暫停。";
      HexSnakeUI.setOverlayChromeVisible(true);
      startGame({ computerBattle: true, resetRelayScore: true });
    });

    function applyAutoBattleSpeedIndex(index) {
      const nextIndex = Math.max(0, Math.min(GameConfig.autoBattleSpeeds.length - 1, index));
      if (GameConfig.autoBattleSpeeds[nextIndex] === GameRuntimeState.computerBattleSpeed) return;
      setComputerBattleSpeed(GameConfig.autoBattleSpeeds[nextIndex]);
      resetAutoBattleStepTimers();
      updateAutoBattleControls();
    }

    function autoBattleSpeedIndex() {
      return GameConfig.autoBattleSpeeds.indexOf(GameRuntimeState.computerBattleSpeed);
    }

    function replayPlaybackSpeedIndex() {
      const options = replaySpeedOptions();
      const currentIndex = options.indexOf(GameReplay.playback?.speed ?? 1);
      return currentIndex >= 0 ? currentIndex : options.indexOf(1);
    }

    function applyReplayPlaybackSpeedIndex(index) {
      if (!GameReplay.playback) return;
      const options = replaySpeedOptions();
      const nextIndex = Math.max(0, Math.min(options.length - 1, index));
      if (options[nextIndex] === GameReplay.playback.speed) return;
      GameReplay.setPlaybackSpeed(options[nextIndex]);
      renderReplaySpeedMenu();
    }

    function bindSpeedScrubber({
      select,
      menu,
      isActive,
      currentIndex,
      applyIndex,
      setMenuOpen,
      menuButtonSelector,
      applyMenuButton
    }) {
      let drag = null;

      select.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        if (!isActive()) return;
        drag = {
          pointerId: event.pointerId,
          startY: event.clientY,
          startIndex: currentIndex(),
          moved: false
        };
        select.classList.add("is-dragging");
        select.setPointerCapture(event.pointerId);
      });

      select.addEventListener("pointermove", event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const dragDistance = event.clientY - drag.startY;
        if (Math.abs(dragDistance) > 6) {
          drag.moved = true;
          setMenuOpen(false);
        }
        const stepDelta = Math.round((event.clientY - drag.startY) / 28);
        applyIndex(drag.startIndex + stepDelta);
      });

      function endDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const shouldToggleMenu = !drag.moved && isActive();
        select.classList.remove("is-dragging");
        if (select.hasPointerCapture(event.pointerId)) {
          select.releasePointerCapture(event.pointerId);
        }
        drag = null;
        if (shouldToggleMenu) setMenuOpen(menu.hidden);
      }

      select.addEventListener("pointerup", endDrag);
      select.addEventListener("pointercancel", endDrag);

      select.addEventListener("wheel", event => {
        if (!isActive()) return;
        event.preventDefault();
        event.stopPropagation();
        applyIndex(currentIndex() + (event.deltaY > 0 ? 1 : -1));
      }, { passive: false });

      select.addEventListener("keydown", event => {
        if (!isActive() || !["ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Enter" || event.key === " ") {
          setMenuOpen(menu.hidden);
          return;
        }
        applyIndex(currentIndex() + (event.key === "ArrowDown" ? 1 : -1));
      });

      menu.addEventListener("click", event => {
        event.stopPropagation();
        const button = event.target.closest(menuButtonSelector);
        if (!button || !isActive()) return;
        applyMenuButton(button);
        setMenuOpen(false);
      });
    }

    bindSpeedScrubber({
      select: Dom.autoBattleSpeedSelect,
      menu: Dom.autoSpeedMenu,
      isActive: isPlayerAutoControlActive,
      currentIndex: autoBattleSpeedIndex,
      applyIndex: applyAutoBattleSpeedIndex,
      setMenuOpen: setAutoSpeedMenuOpen,
      menuButtonSelector: "[data-auto-speed]",
      applyMenuButton(button) {
        setComputerBattleSpeed(button.dataset.autoSpeed);
        resetAutoBattleStepTimers();
        updateAutoBattleControls();
      }
    });

    bindSpeedScrubber({
      select: Dom.replaySpeedSelect,
      menu: Dom.replaySpeedMenu,
      isActive: () => Boolean(GameReplay.playback),
      currentIndex: replayPlaybackSpeedIndex,
      applyIndex: applyReplayPlaybackSpeedIndex,
      setMenuOpen: setReplaySpeedMenuOpen,
      menuButtonSelector: "[data-replay-speed]",
      applyMenuButton(button) {
        GameReplay.setPlaybackSpeed(button.dataset.replaySpeed);
      }
    });

    let replayBoardGesture = null;
    let lastReplayBoardTap = { at: 0, x: 0, y: 0 };
    const replayBoardLongPressMs = 360;
    const replayBoardTapMs = 320;
    const replayBoardTapPx = 26;
    const replayBoardSwipePx = 48;

    function clearReplayBoardLongPressTimer() {
      if (!replayBoardGesture?.longPressTimer) return;
      clearTimeout(replayBoardGesture.longPressTimer);
      replayBoardGesture.longPressTimer = null;
    }

    function beginReplayBoardGesture(event) {
      if (!GameReplay.isPlaybackMode() || !GameReplay.playback) return false;
      if (event.button > 0 || event.target.closest(".overlay")) return false;
      event.preventDefault();
      event.stopPropagation();
      setReplaySpeedMenuOpen(false);
      replayBoardGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now(),
        startReplayTime: GameReplay.playback.time,
        startSpeedIndex: replayPlaybackSpeedIndex(),
        activated: false,
        moved: false,
        mode: null,
        longPressTimer: setTimeout(() => {
          if (!replayBoardGesture || replayBoardGesture.pointerId !== event.pointerId || !GameReplay.playback) return;
          replayBoardGesture.activated = true;
          replayBoardGesture.startReplayTime = GameReplay.playback.time;
          replayBoardGesture.startSpeedIndex = replayPlaybackSpeedIndex();
        }, replayBoardLongPressMs)
      };
      Dom.playArea.setPointerCapture?.(event.pointerId);
      return true;
    }

    function moveReplayBoardGesture(event) {
      if (!replayBoardGesture || event.pointerId !== replayBoardGesture.pointerId) return false;
      if (!GameReplay.playback) {
        clearReplayBoardLongPressTimer();
        replayBoardGesture = null;
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      const dx = event.clientX - replayBoardGesture.startX;
      const dy = event.clientY - replayBoardGesture.startY;
      if (Math.hypot(dx, dy) > 8) replayBoardGesture.moved = true;
      if (!replayBoardGesture.activated && Math.hypot(dx, dy) > 14) {
        clearReplayBoardLongPressTimer();
      }
      if (!replayBoardGesture.activated) return true;

      if (!replayBoardGesture.mode && Math.max(Math.abs(dx), Math.abs(dy)) > 12) {
        replayBoardGesture.mode = Math.abs(dx) >= Math.abs(dy) ? "seek" : "speed";
      }
      if (replayBoardGesture.mode === "seek") {
        const width = Math.max(1, Dom.playArea.getBoundingClientRect().width);
        const nextTime = replayBoardGesture.startReplayTime + GameReplay.playback.duration * (dx / width);
        GameReplay.seekPlayback(nextTime);
      } else if (replayBoardGesture.mode === "speed") {
        const stepDelta = Math.round(dy / 28);
        applyReplayPlaybackSpeedIndex(replayBoardGesture.startSpeedIndex + stepDelta);
      }
      return true;
    }

    function endReplayBoardGesture(event) {
      if (!replayBoardGesture || event.pointerId !== replayBoardGesture.pointerId) return false;
      event.preventDefault();
      event.stopPropagation();
      const gesture = replayBoardGesture;
      const dx = event.clientX - gesture.startX;
      const dy = event.clientY - gesture.startY;
      clearReplayBoardLongPressTimer();
      if (Dom.playArea.hasPointerCapture?.(event.pointerId)) Dom.playArea.releasePointerCapture(event.pointerId);
      replayBoardGesture = null;

      if (gesture.activated) return true;
      if (Math.abs(dx) >= replayBoardSwipePx && Math.abs(dx) > Math.abs(dy) * 1.25) {
        lastReplayBoardTap = { at: 0, x: 0, y: 0 };
        GameReplay.switchPlayback(dx < 0 ? 1 : -1);
        return true;
      }
      if (Math.hypot(dx, dy) <= 12) {
        const now = performance.now();
        const tapDistance = Math.hypot(event.clientX - lastReplayBoardTap.x, event.clientY - lastReplayBoardTap.y);
        if (now - lastReplayBoardTap.at <= replayBoardTapMs && tapDistance <= replayBoardTapPx) {
          lastReplayBoardTap = { at: 0, x: 0, y: 0 };
          GameReplay.togglePlaybackPaused();
        } else {
          lastReplayBoardTap = { at: now, x: event.clientX, y: event.clientY };
        }
      }
      return true;
    }

    function cancelReplayBoardGesture(event) {
      if (!replayBoardGesture || event.pointerId !== replayBoardGesture.pointerId) return false;
      event.preventDefault();
      event.stopPropagation();
      clearReplayBoardLongPressTimer();
      if (Dom.playArea.hasPointerCapture?.(event.pointerId)) Dom.playArea.releasePointerCapture(event.pointerId);
      replayBoardGesture = null;
      return true;
    }

    document.addEventListener("pointerdown", event => {
      if (!Dom.autoSpeedMenu.hidden && !Dom.autoBattlePanel.contains(event.target)) {
        setAutoSpeedMenuOpen(false);
      }
      if (!Dom.replaySpeedMenu.hidden && !Dom.replayControls.contains(event.target)) {
        setReplaySpeedMenuOpen(false);
      }
    });

    Dom.relayModeInput.addEventListener("change", event => {
      event.stopPropagation();
      if (!isRelayModeAvailable()) {
        Dom.relayModeInput.checked = false;
        return;
      }
      setRelayMode(Dom.relayModeInput.checked, Dom.relayModeInput.checked);
    });

    Dom.autoPauseButton.addEventListener("click", event => {
      event.stopPropagation();
      if (!isPlayerAutoControlActive() || !HexSnakeState.game.running || HexSnakeState.game.gameOver) return;
      HexSnakeState.game.paused = !HexSnakeState.game.paused;
      if (!HexSnakeState.game.paused) {
        HexSnakeState.game.lastPlayerStep = performance.now();
        HexSnakeState.game.lastComputerStep = HexSnakeState.game.lastPlayerStep;
        HexSnakeState.game.lastTimerFrame = HexSnakeState.game.lastPlayerStep;
      }
      updateAutoBattleControls();
    });

    Dom.joyZone.addEventListener("pointerdown", event => {
      const dirButton = event.target.closest("[data-dir-button]");
      if (dirButton) {
        event.preventDefault();
        triggerTouchFeedback(event, 7);
        setDirection(Number(dirButton.dataset.dir), { feedbackEvent: event, feedbackStrength: 5 });
        return;
      }
      if (!pointerNearMoveCenter(event)) {
        return;
      }
      triggerTouchFeedback(event, 5);
      HexSnakeState.game.movePointerId = event.pointerId;
      HexSnakeState.game.movePointerStartedAt = performance.now();
      HexSnakeState.game.movePointerStartX = event.clientX;
      HexSnakeState.game.movePointerStartY = event.clientY;
      HexSnakeState.game.movePointerMoved = false;
      HexSnakeState.game.moveStickEngaged = false;
      Dom.joyZone.setPointerCapture(HexSnakeState.game.movePointerId);
      clearMoveStickHoldTimer();
      HexSnakeState.game.moveStickHoldTimer = setTimeout(() => engageMoveStick(event), 80);
    });

    Dom.joyZone.addEventListener("pointermove", event => {
      if (HexSnakeState.game.controlAttackPointer && event.pointerId === HexSnakeState.game.controlAttackPointer.pointerId) {
        moveControlPadAttackPointer(event);
        return;
      }
      if (event.pointerId === HexSnakeState.game.movePointerId && !HexSnakeState.game.moveStickEngaged) {
        const dragDistance = Math.hypot(event.clientX - HexSnakeState.game.movePointerStartX, event.clientY - HexSnakeState.game.movePointerStartY);
        if (dragDistance > 5) engageMoveStick(event);
      }
      if (event.pointerId === HexSnakeState.game.movePointerId && HexSnakeState.game.moveStickEngaged) moveStick(event);
    });

    Dom.joyZone.addEventListener("pointerup", event => {
      if (HexSnakeState.game.controlAttackPointer && event.pointerId === HexSnakeState.game.controlAttackPointer.pointerId) {
        finishControlPadAttackPointer(event);
        return;
      }
      releaseMoveStick(event);
    });
    Dom.joyZone.addEventListener("pointercancel", event => {
      if (HexSnakeState.game.controlAttackPointer && event.pointerId === HexSnakeState.game.controlAttackPointer.pointerId) {
        cancelControlPadAttackPointer(event);
        return;
      }
      releaseMoveStick(event);
    });

    window.addEventListener("pointermove", event => {
      if (HexSnakeState.game.controlAttackPointer && event.pointerId === HexSnakeState.game.controlAttackPointer.pointerId) {
        moveControlPadAttackPointer(event);
        return;
      }
      if (!HexSnakeState.game.moveStickLocked && !HexSnakeState.game.moveStickEngaged) return;
      if (event.pointerId === HexSnakeState.game.movePointerId || event.pointerType === "mouse") {
        moveStick(event);
      }
    });
    window.addEventListener("pointerup", finishControlPadAttackPointer);
    window.addEventListener("pointercancel", cancelControlPadAttackPointer);

    Dom.playArea.addEventListener("pointerdown", event => {
      if (event.target.closest(".overlay")) return;
      if (beginReplayBoardGesture(event)) return;
      beginBoardAttackPointer(event);
    });
    Dom.playArea.addEventListener("pointermove", event => {
      if (moveReplayBoardGesture(event)) return;
      moveBoardAttackPointer(event);
    });
    Dom.playArea.addEventListener("pointerup", event => {
      if (endReplayBoardGesture(event)) return;
      finishBoardAttackPointer(event);
    });
    Dom.playArea.addEventListener("pointercancel", event => {
      if (cancelReplayBoardGesture(event)) return;
      cancelBoardAttackPointer(event);
    });
    window.addEventListener("pointermove", event => {
      if (moveReplayBoardGesture(event)) return;
      moveBoardAttackPointer(event);
    });
    window.addEventListener("pointerup", event => {
      if (endReplayBoardGesture(event)) return;
      finishBoardAttackPointer(event);
    });
    window.addEventListener("pointercancel", event => {
      if (cancelReplayBoardGesture(event)) return;
      cancelBoardAttackPointer(event);
    });
    window.addEventListener("click", event => {
      const skipButton = event.target?.closest?.("[data-logo-skip]");
      if (!skipButton) return;
      if (skipLogoTransition()) {
        event.preventDefault();
        event.stopPropagation();
      }
    });

    window.addEventListener("keydown", event => {
      if (HexSnakeState.game.pendingDirectionKeybind !== null) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape" || event.key === "Esc") setPendingDirectionKeybind(null);
        else commitPendingDirectionKeybind(event.key === " " ? " " : event.key);
        return;
      }
      if (GameReplay.isPlaybackMode()) {
        if (event.key === "Escape" || event.key === "Esc") GameReplay.exitPlayback();
        if (event.key === " " && GameReplay.playback) {
          event.preventDefault();
          GameReplay.togglePlaybackPaused();
        }
        if (event.key === "ArrowLeft" && GameReplay.playback) {
          event.preventDefault();
          GameReplay.switchPlayback(-1);
        }
        if (event.key === "ArrowRight" && GameReplay.playback) {
          event.preventDefault();
          GameReplay.switchPlayback(1);
        }
        return;
      }
      if (!Dom.versionModal.hidden) {
        if (event.key === "Escape" || event.key === "Esc") GameAbout.closeModal();
        return;
      }
      if (!Dom.settingsContent.hidden || !Dom.gmContent.hidden || !Dom.networkContent.hidden) {
        if (event.key === "Escape" || event.key === "Esc") {
          setSettingsOpen(false);
          setGmOpen(false);
          setNetworkOpen(false);
        }
        if (!Dom.settingsContent.hidden && event.key === "ArrowRight") {
          event.preventDefault();
          setGmOpen(true, { direction: "next", focus: false });
        }
        if (!Dom.gmContent.hidden && event.key === "ArrowLeft") {
          event.preventDefault();
          setSettingsOpen(true, { direction: "prev", focus: false });
        }
        return;
      }
      if (!Dom.rulesModal.hidden) {
        if (event.key === "Escape" || event.key === "Esc") HexSnakeUI.closeRulesModal();
        return;
      }
      if (HexSnakeUI.isTutorialOpen()) {
        if (event.key === "Escape" || event.key === "Esc") {
          event.preventDefault();
          HexSnakeUI.finishTutorial(true);
          return;
        }
        if (event.key === "PageDown" || event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          HexSnakeUI.moveTutorial(1);
          return;
        }
        if (event.key === "PageUp" || event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          HexSnakeUI.moveTutorial(-1);
          return;
        }
      }
      if (!Dom.replayModal.hidden) {
        if (event.key === "Escape" || event.key === "Esc") GameReplay.closeModal();
        return;
      }
      if (!Dom.statsModal.hidden) {
        if (event.key === "Escape" || event.key === "Esc") GameStats.closeModal();
        return;
      }
      if (HexSnakeUI.isLogoTransitionActive()) {
        if ((event.key === "Enter" || event.key === " ") && skipLogoTransition()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!Dom.portraitLightbox.hidden) {
        if (event.key === "Escape" || event.key === "Esc") HexSnakeUI.closePortraitLightbox();
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          HexSnakeUI.shiftPortraitLightbox(-1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          HexSnakeUI.shiftPortraitLightbox(1);
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          HexSnakeUI.shiftPortraitVariantMode(-1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          HexSnakeUI.shiftPortraitVariantMode(1);
        }
        return;
      }
      if (Dom.mobileInputQuery.matches) return;
      if (event.target && ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;

      const pressedKey = event.key === " " ? " " : event.key.toLowerCase();
      if (pressedKey === HexSnakeState.game.keybinds.pause) {
        event.preventDefault();
        togglePause();
        return;
      }
      if (pressedKey === HexSnakeState.game.keybinds.surrender) {
        event.preventDefault();
        surrenderGame();
        return;
      }
      if (pressedKey === "x" || pressedKey === "y") {
        handleKeyboardAimKeyDown(event, pressedKey === "x" ? "small" : "big", pressedKey);
        return;
      }
      if (pressedKey === HexSnakeState.game.keybinds.smallAttack || pressedKey === HexSnakeState.game.keybinds.bigAttack) {
        event.preventDefault();
        const profile = pressedKey === HexSnakeState.game.keybinds.smallAttack ? "small" : "big";
        launchKeyboardPlayerAttack(profile);
        return;
      }
      if (HexSnakeState.game.keyToDir.has(pressedKey)) {
        event.preventDefault();
        setDirection(HexSnakeState.game.keyToDir.get(pressedKey));
        return;
      }
      if ((pressedKey === " " && HexSnakeState.game.keybinds.pause !== " ") || (pressedKey === "q" && HexSnakeState.game.keybinds.smallAttack !== "q" && HexSnakeState.game.keybinds.bigAttack !== "q")) {
        event.preventDefault();
        return;
      }

      const key = event.key.toLowerCase();
      if (key === " ") {
        if (!HexSnakeState.game.running || HexSnakeState.game.gameOver) {
          beginStartLogoCountdown();
          return;
        }
        HexSnakeState.game.paused = !HexSnakeState.game.paused;
        setStatus(HexSnakeState.game.paused ? "已暫停" : "對戰中：吃食物累積能量，集滿可獲得炸彈。");
        Dom.overlayTitle.textContent = "暫停";
        Dom.overlayText.textContent = "按繼續回到對戰。";
        Dom.startButton.textContent = "繼續";
        HexSnakeUI.setOverlayChromeVisible(true);
        Dom.overlay.classList.toggle("show", HexSnakeState.game.paused);
        if (!HexSnakeState.game.paused) {
          HexSnakeState.game.lastPlayerStep = performance.now();
          HexSnakeState.game.lastComputerStep = HexSnakeState.game.lastPlayerStep;
          HexSnakeState.game.lastTimerFrame = HexSnakeState.game.lastPlayerStep;
        }
        updateAutoBattleControls();
        return;
      }

      if (key === "q") {
        if (!HexSnakeState.game.running || HexSnakeState.game.gameOver) {
          if (!autoStartGame()) return;
        }
        if (launchAttack("player", HexSnakeState.game.targetCell || HexSnakeState.game.snake[0], performance.now())) {
          setStatus("P1 施放炸彈，2 秒後落地。");
        } else {
          setStatus(`大招需要 ${HexSnakeState.config.bigAttackBombCost} 枚炸彈，且四種庫存各至少 2。`);
        }
        return;
      }

      if (HexSnakeState.game.keyToDir.has(key)) {
        event.preventDefault();
        setDirection(HexSnakeState.game.keyToDir.get(key));
        return;
      }
    });

    window.addEventListener("keyup", event => {
      const pressedKey = event.key === " " ? " " : event.key.toLowerCase();
      if (pressedKey === "x" || pressedKey === "y") {
        handleKeyboardAimKeyUp(event, pressedKey);
      }
    });
    window.addEventListener("blur", clearKeyboardAimKeyLocks);
    GamePlatform.lifecycle.onPause(() => {
      clearKeyboardAimKeyLocks();
      if (GameRuntimeState.rafId) {
        cancelAnimationFrame(GameRuntimeState.rafId);
        GameRuntimeState.rafId = 0;
      }
    });
    GamePlatform.lifecycle.onResume(() => {
      if (GameRuntimeState.rafId) return;
      const now = performance.now();
      if (GameRuntimeState.running && !GameRuntimeState.gameOver) {
        GameRuntimeState.lastPlayerStep = now;
        GameRuntimeState.lastComputerStep = now;
        GameRuntimeState.lastTimerFrame = now;
      }
      if (GameRuntimeState.running || GameRuntimeState.gameOverSettlementPending) {
        GameRuntimeState.rafId = requestAnimationFrame(loop);
      } else if (GameRender.isEffectComparisonMode()) {
        GameRuntimeState.rafId = requestAnimationFrame(GameRender.comparisonLoop);
      }
    });
    GamePlatform.lifecycle.onBackButton?.(handlePlatformBackButton);

    Object.assign(GameRenderGame, {
      attackStats,
      attackVisualType,
      axialToPixel,
      bandDistanceFromTotalWidth,
      boardLineThrough,
      cellsNearCells,
      characterForVisualType,
      directionFromSourceToTarget,
      directionScreenAngle,
      hexPath,
      keyOf,
      lobsterFistPath,
      nextWrappedCell,
      opponentHeadTarget,
      ownerDirection,
      pointAlongPath,
      sandwormUndergroundAlpha,
      stableVariantIndex,
      updatePerfOverlay
    });

    Object.assign(GameUI.aiGame, {
      attackHitStunChances,
      attackStats,
      bandShapeFromTotalWidth,
      boardLineThrough,
      canOwnerTurn,
      circleDamageMultiplier,
      damageSnake,
      directionFromSourceToTarget,
      flashAttackButton,
      hexDistance,
      isOwnerDamageImmune,
      isPlayerAutoControlActive,
      keyOf,
      launchAttack,
      lineBandDamageMultiplier,
      nextWrappedCell,
      ownerDirection,
      setStatus,
      stableVariantIndex,
      turnDistance
    });

    Object.assign(GameUI.uiGame, {
      attackVisualType,
      axialToPixel,
      clampInitialBombs,
      clampInitialEnergy,
      clampInitialStock,
      createStartingSnake,
      isPlayerAutoControlActive,
      nextWrappedCell,
      resize,
      setGmOpen,
      setSettingsOpen
    });

    Object.assign(GameUI.replayGame, {
      buildCells,
      clearRelayRestartTimer,
      returnToStartScreen,
      setSettingsLocked,
      setStatus,
      updateAutoBattleControls,
      updateHud,
      updateSettingsActionMode
    });

    Object.assign(GameUI, {
      clearRelayRestartTimer,
      loadSavedCharacterChoices,
      saveCharacterChoices,
      syncCharacterInputs
    });

    window.addEventListener("resize", resize);
      return HexSnakeGame;
    }

    async function runGameBootstrap() {
      await GameUI.loadBalanceConfig();
      await GameAI.loadHighAiStrategyConfig();
      try {
        await GameUI.loadCharacterDatabase();
      } catch (error) {
        GameUI.showCharacterDatabaseError(error);
        return gameBootstrapContract;
      }
      GameUI.buildCharacterOptions();
      GameUI.buildCharacterStage();
      GameUI.buildResourceHud();
      GameUI.buildRulesContent();
      loadSavedGmSettings();
      setGridSize(Dom.gridSizeInput.value);
      setFoodCount(Dom.foodCountInput.value);
      setComputerDifficulty(Dom.computerDifficultyInput.value);
      setInitialSpeed(Dom.initialSpeedInput.value);
      setGmMode(GameRuntimeState.gmMode);
      setInitialLength(Dom.initialLengthInput.value);
      setInitialEnergy(Dom.initialEnergyInput.value);
      setInitialBombs(Dom.initialBombsInput.value);
      Dom.initialStockInputs.forEach(input => setInitialStock(input.dataset.initialStock, input.value));
      updateGmPresetHighlight();
      setSettingsLocked(false);
      applyKeybinds();
      setLeftHandMode(GameStorage.get("hexSnakeLeftHandMode") === "1");
      renderControlProfiles();
      Dom.sfxMuteToggle.checked = GameAudio.muted;
      syncLowPowerMode();
      setPerfStatsVisible(GamePresentationState.perfStatsVisible);
      updateAttackButtons();
      resetGame();
      resize();
      GameUI.renderIntroPortraits(false);
      Dom.overlay.classList.add("show");
      if (GameUI.shouldShowTutorial()) GameUI.showTutorial(0);
      GameUI.preloadPortraitsFor("player");
      GameUI.preloadPortraitsFor("computer");
      if (GameRender.isEffectComparisonMode()) {
        Dom.overlay.classList.remove("show");
        Dom.characterStage.hidden = true;
        GameUI.setCharacterStageOverlayMode(false);
        setStatus("Skill effect comparison mode.");
        cancelAnimationFrame(GameRuntimeState.rafId);
        GameRuntimeState.rafId = requestAnimationFrame(GameRender.comparisonLoop);
      }
      if ("requestIdleCallback" in window) {
        requestIdleCallback(GameUI.preloadAllPortraits, { timeout: 1500 });
      } else {
        setTimeout(GameUI.preloadAllPortraits, 250);
      }
      return gameBootstrapContract;
    }

    function bootstrapGame() {
      if (!gameBootstrapPromise) {
        loadGameShell();
        gameBootstrapPromise = runGameBootstrap();
      }
      return gameBootstrapPromise;
    }

    function shouldAutoBootstrapGame() {
      if (window.__HEX_SNAKE_BUNDLED_LEGACY__) return true;
      const params = new URLSearchParams(window.location.search);
      return (params.get("hexSnakeLoader") || "legacy").trim().toLowerCase() === "legacy";
    }

    if (shouldAutoBootstrapGame()) {
      bootstrapGame();
    }

    export {
      HexSnakeGame,
      HexSnakeGame as gameShell,
      bootstrapGame,
      loadGameShell
    };
