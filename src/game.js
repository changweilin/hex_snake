    function normalizeKey(value, fallback) {
      if (value === " " || value === "Space") return " ";
      const trimmed = String(value || "").trim();
      if (!trimmed) return fallback;
      return trimmed.slice(0, 1).toLowerCase();
    }

    function keyLabel(key) {
      return key === " " ? "Space" : key.toUpperCase();
    }

    function loadKeybinds() {
      try {
        const saved = JSON.parse(localStorage.getItem("hexSnakeKeybinds") || "null");
        if (!saved || !Array.isArray(saved.directions)) return structuredClone(defaultKeybinds);
        return {
          smallAttack: normalizeKey(saved.smallAttack, defaultKeybinds.smallAttack),
          bigAttack: normalizeKey(saved.bigAttack, defaultKeybinds.bigAttack),
          pause: normalizeKey(saved.pause, defaultKeybinds.pause),
          surrender: normalizeKey(saved.surrender, defaultKeybinds.surrender),
          directions: defaultKeybinds.directions.map((fallback, index) => normalizeKey(saved.directions[index], fallback))
        };
      } catch {
        return structuredClone(defaultKeybinds);
      }
    }

    function saveKeybinds() {
      localStorage.setItem("hexSnakeKeybinds", JSON.stringify(keybinds));
    }

    function loadSavedCharacterChoices() {
      const savedPlayer = localStorage.getItem("hexSnakePlayerCharacterId");
      const savedComputer = localStorage.getItem("hexSnakeComputerCharacterId");
      if (savedPlayer === randomCharacterChoiceId || characterById.has(savedPlayer)) playerCharacterChoice = savedPlayer;
      if (savedComputer === randomCharacterChoiceId || characterById.has(savedComputer)) computerCharacterChoice = savedComputer;
      playerCharacterId = characterById.has(playerCharacterChoice) ? playerCharacterChoice : characters[0].id;
      computerCharacterId = characterById.has(computerCharacterChoice) ? computerCharacterChoice : characters[Math.min(1, characters.length - 1)].id;
    }

    function saveCharacterChoices() {
      localStorage.setItem("hexSnakePlayerCharacterId", playerCharacterChoice);
      localStorage.setItem("hexSnakeComputerCharacterId", computerCharacterChoice);
    }

    function syncCharacterInputs() {
      playerCharacterInput.value = playerCharacterChoice;
      computerCharacterInput.value = computerCharacterChoice;
    }

    function resolveCharacterChoice(owner, choice) {
      const fallback = owner === "player" ? characters[0] : characters[Math.min(1, characters.length - 1)];
      if (choice === randomCharacterChoiceId) return consumeStartLogoRandomCharacterId(owner) || randomCharacter().id;
      return characterById.has(choice) ? choice : fallback.id;
    }

    function resolveCharacterChoicesForStart() {
      playerCharacterChoice = playerCharacterInput.value === randomCharacterChoiceId || characterById.has(playerCharacterInput.value)
        ? playerCharacterInput.value
        : defaultSettings.playerCharacterId;
      computerCharacterChoice = computerCharacterInput.value === randomCharacterChoiceId || characterById.has(computerCharacterInput.value)
        ? computerCharacterInput.value
        : defaultSettings.computerCharacterId;
      playerCharacterId = resolveCharacterChoice("player", playerCharacterChoice);
      computerCharacterId = resolveCharacterChoice("computer", computerCharacterChoice);
      syncCharacterInputs();
      saveCharacterChoices();
    }

    function applyKeybinds() {
      directions.forEach((direction, index) => {
        direction.key = keybinds.directions[index];
      });
      keyToDir = new Map(directions.map((direction, index) => [direction.key, index]));
      keyEls.forEach(el => {
        const direction = directions[Number(el.dataset.dir)];
        if (direction) el.textContent = keyLabel(direction.key);
      });
      hexDirButtons.forEach(button => {
        const direction = directions[Number(button.dataset.dir)];
        const label = button.querySelector("span") || button;
        if (direction) label.textContent = keyLabel(direction.key);
      });
      settingsDirButtons.forEach(button => {
        const direction = directions[Number(button.dataset.dir)];
        const label = button.querySelector("span") || button;
        if (direction) label.textContent = keyLabel(direction.key);
        button.classList.toggle("is-awaiting-key", Number(button.dataset.dir) === pendingDirectionKeybind);
        button.setAttribute("aria-pressed", String(Number(button.dataset.dir) === pendingDirectionKeybind));
      });
      document.querySelector("#smallAttackKey").value = keyLabel(keybinds.smallAttack);
      document.querySelector("#bigAttackKey").value = keyLabel(keybinds.bigAttack);
      document.querySelector("#pauseKey").value = keyLabel(keybinds.pause);
      document.querySelector("#surrenderKey").value = keyLabel(keybinds.surrender);
      document.querySelectorAll("[data-keybind-dir]").forEach(input => {
        input.value = keyLabel(keybinds.directions[Number(input.dataset.keybindDir)]);
      });
    }

    function setPendingDirectionKeybind(direction) {
      pendingDirectionKeybind = Number.isInteger(direction) && direction >= 0 && direction < directions.length ? direction : null;
      settingsDirHint.textContent = pendingDirectionKeybind === null
        ? "點一個方向後按鍵盤設定快捷鍵"
        : `按鍵盤設定 ${directions[pendingDirectionKeybind].label} 快捷鍵`;
      applyKeybinds();
    }

    function commitPendingDirectionKeybind(key) {
      if (pendingDirectionKeybind === null) return false;
      keybinds.directions[pendingDirectionKeybind] = normalizeKey(key, keybinds.directions[pendingDirectionKeybind]);
      saveKeybinds();
      setPendingDirectionKeybind(null);
      return true;
    }

    function triggerTouchFeedback(event, strength = 8) {
      if (event?.pointerType === "mouse") return;
      if (!navigator.vibrate) return;
      navigator.vibrate(strength);
    }

    function setAttackButtonHighlight(profile = null) {
      if (attackHighlightReleaseTimer) {
        clearTimeout(attackHighlightReleaseTimer);
        attackHighlightReleaseTimer = null;
      }
      highlightedAttackProfile = ["small", "big", "smallAim", "bigAim"].includes(profile) ? profile : null;
      updateAttackButtons();
    }

    function releaseAttackButtonHighlight(delayMs = 90) {
      if (attackHighlightReleaseTimer) clearTimeout(attackHighlightReleaseTimer);
      attackHighlightReleaseTimer = setTimeout(() => {
        attackHighlightReleaseTimer = null;
        highlightedAttackProfile = null;
        updateAttackButtons();
      }, delayMs);
    }

    function flashAttackButton(profile, delayMs = 120) {
      setAttackButtonHighlight(profile);
      releaseAttackButtonHighlight(delayMs);
    }

    function updateAttackButtons() {
      smallAttackButton.classList.toggle("is-selected", highlightedAttackProfile === "small");
      bigAttackButton.classList.toggle("is-selected", highlightedAttackProfile === "big");
      keyboardSmallAimButton.classList.toggle("is-selected", highlightedAttackProfile === "smallAim");
      keyboardBigAimButton.classList.toggle("is-selected", highlightedAttackProfile === "bigAim");
      targetModeSmallIndicator.classList.toggle("is-active", highlightedAttackProfile === "smallAim");
      targetModeBigIndicator.classList.toggle("is-active", highlightedAttackProfile === "bigAim");
      smallAttackButton.classList.toggle("secondary", highlightedAttackProfile !== "small");
      bigAttackButton.classList.toggle("secondary", highlightedAttackProfile !== "big");
      updateTargetModeIndicator();
    }

    function selectAttackProfile(profile) {
      selectedAttackProfile = profile === "big" ? "big" : "small";
      updateAttackButtons();
      const moveName = selectedAttackProfile === "big" ? characterFor("player").bigMove : characterFor("player").smallMove;
      setStatus(`已選擇 ${moveName}。點棋盤即可攻擊。`);
    }

    function setLeftHandMode(enabled) {
      const active = Boolean(enabled);
      controlRow.classList.toggle("left-handed", active);
      leftHandModeInput.checked = active;
      localStorage.setItem("hexSnakeLeftHandMode", active ? "1" : "0");
    }

    function clampGridSize(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return gridSize;
      return Math.min(maxGridSize, Math.max(minGridSize, parsed));
    }

    function clampFoodCount(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return foodCount;
      return Math.min(maxFoodCount, Math.max(minFoodCount, parsed));
    }

    function clampInitialSpeed(value) {
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed)) return initialSpeed;
      return Math.min(maxInitialSpeed, Math.max(minInitialSpeed, parsed));
    }

    function clampInitialLength(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return initialLength;
      return Math.min(maxInitialLength, Math.max(minInitialLength, parsed));
    }

    function clampInitialStock(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return 0;
      return Math.min(maxFoodStock, Math.max(0, parsed));
    }

    function clampInitialEnergy(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return 0;
      return Math.min(attackNeedTotal, Math.max(0, parsed));
    }

    function clampInitialBombs(value) {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return 0;
      return Math.min(maxAmmo, Math.max(0, parsed));
    }

    function buildCells() {
      cells = [];
      for (let q = -radius; q <= radius; q += 1) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r += 1) {
          cells.push({ q, r });
        }
      }
    }

    function setGridSize(value) {
      gridSize = clampGridSize(value);
      radius = gridSize - 1;
      gridSizeInput.value = gridSize;
      buildCells();
    }

    function setFoodCount(value) {
      foodCount = clampFoodCount(value);
      foodCountInput.value = foodCount;
    }

    function setComputerDifficulty(value) {
      computerDifficulty = ["novice", "low", "medium", "high", "extreme"].includes(value) ? value : "medium";
      computerDifficultyInput.value = computerDifficulty;
    }

    function setInitialSpeed(value) {
      initialSpeed = clampInitialSpeed(value);
      initialSpeedInput.value = initialSpeed;
    }

    function setInitialLength(value) {
      initialLength = clampInitialLength(value);
      initialLengthInput.value = initialLength;
    }

    function setInitialEnergy(value) {
      initialEnergy = clampInitialEnergy(value);
      initialEnergyInput.value = initialEnergy;
    }

    function setInitialBombs(value) {
      initialBombs = clampInitialBombs(value);
      initialBombsInput.value = initialBombs;
    }

    function setInitialStock(typeId, value) {
      if (!Object.prototype.hasOwnProperty.call(initialStock, typeId)) return;
      initialStock[typeId] = clampInitialStock(value);
      const input = initialStockInputs.find(stockInput => stockInput.dataset.initialStock === typeId);
      if (input) input.value = initialStock[typeId];
    }

    function updateGmPresetHighlight() {
      Object.entries(gmPresetButtons).forEach(([mode, button]) => {
        const selected = gmPresetMode === mode;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
      });
    }

    function saveGmSettings() {
      localStorage.setItem("hexSnakeGmSettings", JSON.stringify({
        gridSize,
        foodCount,
        computerDifficulty,
        initialSpeed,
        gmMode,
        initialLength,
        initialEnergy,
        initialBombs,
        initialStock,
        gmPresetMode
      }));
    }

    function applyGmSettingsChanged(options = {}) {
      gmPresetMode = options.presetMode ?? null;
      updateGmPresetHighlight();
      saveGmSettings();
    }

    function loadSavedGmSettings() {
      try {
        const saved = JSON.parse(localStorage.getItem("hexSnakeGmSettings") || "null");
        if (!saved || typeof saved !== "object") {
          updateGmPresetHighlight();
          return;
        }
        setGridSize(saved.gridSize ?? defaultSettings.gridSize);
        setFoodCount(saved.foodCount ?? defaultSettings.foodCount);
        setComputerDifficulty(saved.computerDifficulty ?? defaultSettings.computerDifficulty);
        setInitialSpeed(saved.initialSpeed ?? defaultSettings.initialSpeed);
        setGmMode(saved.gmMode ?? defaultSettings.gmMode);
        setInitialLength(saved.initialLength ?? defaultSettings.initialLength);
        setInitialEnergy(saved.initialEnergy ?? defaultSettings.initialEnergy);
        setInitialBombs(saved.initialBombs ?? defaultSettings.initialBombs);
        foodTypes.forEach(type => setInitialStock(type.id, saved.initialStock?.[type.id] ?? defaultSettings.initialStock[type.id]));
        gmPresetMode = Object.prototype.hasOwnProperty.call(gmPresetButtons, saved.gmPresetMode) ? saved.gmPresetMode : null;
        updateGmPresetHighlight();
      } catch {
        gmPresetMode = "real";
        updateGmPresetHighlight();
      }
    }

    function setGmMode(active) {
      gmMode = Boolean(active);
      gmToggle.classList.toggle("is-active", gmMode);
      updateSettingsActionMode();
      updateGmControlState();
    }

    function updateGmControlState() {
      const disabled = running;
      initialLengthInput.disabled = disabled;
      initialEnergyInput.disabled = disabled;
      initialBombsInput.disabled = disabled;
      initialStockInputs.forEach(input => {
        input.disabled = disabled;
      });
    }

    function resetGmParameters() {
      setGridSize(defaultSettings.gridSize);
      setFoodCount(defaultSettings.foodCount);
      setInitialSpeed(defaultSettings.initialSpeed);
      setInitialLength(defaultSettings.initialLength);
      setInitialEnergy(defaultSettings.initialEnergy);
      setInitialBombs(defaultSettings.initialBombs);
      foodTypes.forEach(type => setInitialStock(type.id, defaultSettings.initialStock[type.id]));
    }

    function refreshGmPreview() {
      resetGame();
      resize();
      if (overlay.classList.contains("show")) {
        renderIntroPortraits(false);
      }
    }

    function applyUltimateModePreset() {
      setGmMode(true);
      const presetStock = 4;
      setInitialBombs(maxAmmo);
      setInitialEnergy(attackNeedTotal);
      setInitialLength(presetStock);
      foodTypes.forEach(type => setInitialStock(type.id, presetStock));
    }

    function applyMidGameModePreset() {
      setGmMode(true);
      const presetStock = Math.floor(maxFoodStock / 2);
      setInitialBombs(maxAmmo);
      setInitialEnergy(attackNeedTotal);
      setInitialLength(presetStock);
      foodTypes.forEach(type => setInitialStock(type.id, presetStock));
    }

    function applyLateGameModePreset() {
      setGmMode(true);
      const presetStock = maxFoodStock;
      setInitialBombs(maxAmmo);
      setInitialEnergy(attackNeedTotal);
      setInitialLength(presetStock);
      foodTypes.forEach(type => setInitialStock(type.id, presetStock));
    }

    function setGmSettingsLocked(locked) {
      gridSizeInput.disabled = locked;
      foodCountInput.disabled = locked;
      initialSpeedInput.disabled = locked;
      initialLengthInput.disabled = locked;
      initialEnergyInput.disabled = locked;
      initialBombsInput.disabled = locked;
      initialStockInputs.forEach(input => {
        input.disabled = locked;
      });
      gmToggle.disabled = locked;
      realModeButton.disabled = locked;
      midGameModeButton.disabled = locked;
      ultimateModeButton.disabled = locked;
      lateGameModeButton.disabled = locked;
    }

    function updateSettingsActionMode() {
      const showSurrender = running && !gameOver && !HexSnakeReplay.isPlaybackMode();
      if (showSurrender) setSettingsOpen(false);
      settingsToggle.hidden = showSurrender;
      surrenderButton.hidden = !showSurrender;
      surrenderButton.disabled = !showSurrender;
      gmToggle.classList.toggle("is-auto", showSurrender);
      gmToggle.classList.toggle("is-active", showSurrender ? isPlayerAutoControlActive() : gmMode);
      gmLetter.textContent = showSurrender ? "Auto" : "G";
      gmToggle.title = showSurrender ? "Auto 操作" : "GM 設定";
      gmToggle.setAttribute("aria-label", showSurrender ? "Auto 操作" : "GM 設定");
      gmToggle.setAttribute("aria-expanded", showSurrender ? "false" : gmToggle.getAttribute("aria-expanded"));
      gmToggle.disabled = showSurrender ? false : gmToggle.disabled;
    }

    function setSettingsLocked(locked) {
      if (locked) {
        setSettingsOpen(false);
        setGmOpen(false);
      }
      settingsToggle.disabled = locked;
      settingsReplayButton.disabled = locked;
      computerDifficultyInput.disabled = locked;
      playerCharacterInput.disabled = locked;
      computerCharacterInput.disabled = locked;
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
      return Math.max(Math.abs(cell.q), Math.abs(cell.r), Math.abs(s)) <= radius;
    }

    function axialToPixel(cell) {
      return {
        x: center.x + cellSize * Math.sqrt(3) * (cell.q + cell.r / 2),
        y: center.y + cellSize * 1.5 * cell.r
      };
    }

    function pixelToAxial(x, y) {
      const px = x - center.x;
      const py = y - center.y;
      const q = (Math.sqrt(3) / 3 * px - 1 / 3 * py) / cellSize;
      const r = (2 / 3 * py) / cellSize;
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
      return cells.reduce((bestCell, candidate) => {
        return hexDistance(candidate, cell) < hexDistance(bestCell, cell) ? candidate : bestCell;
      }, cells[0]);
    }

    function hexPath(x, y, size) {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.PI / 180 * (60 * i - 30);
        const px = x + size * Math.cos(angle);
        const py = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    function resize() {
      const rect = playArea.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      center = { x: rect.width / 2, y: rect.height / 2 };
      const boardWidth = Math.sqrt(3) * (radius * 2 + 1);
      const boardHeight = radius * 3 + 2;
      cellSize = Math.min(rect.width / (boardWidth + 0.8), rect.height / (boardHeight + 0.8));
      draw();
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
      renderWinnerPortrait(null);
      Object.values(portraitPoseTimers).forEach(clearTimeout);
      portraitPoseTimers = {};
      Object.values(attackCalloutTimers).forEach(clearTimeout);
      attackCalloutTimers = {};
      lockedFighterCallouts.clear();
      preloadPortraitsFor("player");
      preloadPortraitsFor("computer");
      buildCharacterStage();
      const offset = Math.min(2, Math.max(1, radius - 3));
      dir = 0;
      nextDir = 0;
      computerDir = 3;
      const startLength = gmMode ? initialLength : defaultSettings.initialLength;
      snake = createStartingSnake({ q: -offset, r: offset }, dir, startLength);
      computerSnake = createStartingSnake({ q: offset, r: -offset }, computerDir, startLength);
      score = 0;
      computerScore = 0;
      playerHp = maxHpForSnake(snake);
      computerHp = maxHpForSnake(computerSnake);
      playerStock = startingStock();
      computerStock = startingStock();
      playerAmmo = startingBombs();
      computerAmmo = startingBombs();
      playerAmmoCharge = startingEnergy();
      computerAmmoCharge = startingEnergy();
      playerEnergyFlashUntil = 0;
      computerEnergyFlashUntil = 0;
      playerBombFlashUntil = 0;
      computerBombFlashUntil = 0;
      foods = [];
      projectiles = [];
      blasts = [];
      hazards = [];
      boardShakeUntil = 0;
      boardShakeStartedAt = 0;
      boardShakeStrength = 0;
      keyboardAttackAim.small = { targetModeIndex: 0, direction: dir };
      keyboardAttackAim.big = { targetModeIndex: 0, direction: dir };
      keyboardAttackPreview = null;
      keyboardAimHeldKeys.clear();
      if (keyboardAttackPreviewTimer) {
        clearTimeout(keyboardAttackPreviewTimer);
        keyboardAttackPreviewTimer = null;
      }
      updateTargetModeIndicator();
      targetCell = { ...snake[0] };
      targetActive = false;
      totalElapsedMs = 0;
      lastFeedElapsedMs = 0;
      lastTimerFrame = 0;
      lastHudFrameAt = -Infinity;
      lastReplayRecordCheckAt = -Infinity;
      lastPlayerStep = 0;
      lastComputerStep = 0;
      playerStunUntil = 0;
      playerSlowUntil = 0;
      playerCollisionParalysisMs = 0;
      playerVulnerable = false;
      computerStunUntil = 0;
      computerSlowUntil = 0;
      computerCollisionParalysisMs = 0;
      computerVulnerable = false;
      playerUndergroundFrom = 0;
      playerUndergroundUntil = 0;
      computerUndergroundFrom = 0;
      computerUndergroundUntil = 0;
      playerSandwormArmorFrom = 0;
      playerSandwormArmorUntil = 0;
      computerSandwormArmorFrom = 0;
      computerSandwormArmorUntil = 0;
      lastVisiblePlayerSnake = snake.map(segment => ({ ...segment }));
      lastVisibleComputerSnake = computerSnake.map(segment => ({ ...segment }));
      lastVisiblePlayerDir = dir;
      lastVisibleComputerDir = computerDir;
      playerFoodTargetKey = null;
      computerFoodTargetKey = null;
      playerFoodTargetAt = 0;
      computerFoodTargetAt = 0;
      lastPlayerFoodAt = 0;
      lastComputerFoodAt = 0;
      lastPlayerAttackMs = resetAttackCooldownTracker();
      lastComputerAttackMs = resetAttackCooldownTracker();
      HexSnakeReplay.resetSurrendered();
      gameOver = false;
      paused = false;
      placeFoods();
      updateHud();
      setStatus("準備就緒。右搖桿移動，左搖桿瞄準攻擊。");
    }

    function canRestartAfterGameOver() {
      return !gameOverSettlementPending && performance.now() >= restartUnlockAt;
    }

    function beginStartLogoCountdown() {
      if (HexSnakeReplay.isPlaybackMode() || running || startLogoCountdownPending || isLogoTransitionActive()) return false;
      if (gameOver) {
        if (!canRestartAfterGameOver()) return false;
        returnToStartScreen();
      }
      startLogoCountdownPending = true;
      setSettingsLocked(true);
      setStatus("開局倒數中：3 秒後開始。");
      playStartLogoCountdown().then(ready => {
        startLogoCountdownPending = false;
        if (!ready || running || gameOver || HexSnakeReplay.isPlaybackMode()) {
          if (!running && !gameOver) setSettingsLocked(false);
          return;
        }
        startGame();
      });
      return true;
    }

    function skipLogoTransition() {
      if (logoTransitionDirection() !== "in" || gameOverLogoTransitionEndsAt <= 0) return false;
      gameOverLogoTransitionEndsAt = 0;
      showGameOverSettlement();
      return true;
    }

    function startGame(options = {}) {
      if (HexSnakeReplay.isPlaybackMode()) return false;
      if (gameOver && !canRestartAfterGameOver()) return false;
      clearGameOverSettlementTimer();
      clearRelayRestartTimer();
      computerBattleMode = Boolean(options.computerBattle);
      playerAutoMode = Boolean(options.playerAuto) && !computerBattleMode;
      computerBattleManualOverride = false;
      if (computerBattleMode || playerAutoMode) setRelayMode(relayModePreference, Boolean(options.resetRelayScore), false);
      if (!computerBattleMode && !playerAutoMode) setRelayMode(false, false, false);
      if (computerBattleMode || playerAutoMode) setComputerBattleSpeed(localStorage.getItem("hexSnakeAutoBattleSpeed"), false);
      setFoodCount(foodCountInput.value);
      setComputerDifficulty(computerDifficultyInput.value);
      setInitialSpeed(initialSpeedInput.value);
      setGmMode(gmMode);
      setInitialLength(initialLengthInput.value);
      setInitialEnergy(initialEnergyInput.value);
      setInitialBombs(initialBombsInput.value);
      initialStockInputs.forEach(input => setInitialStock(input.dataset.initialStock, input.value));
      saveGmSettings();
      resolveCharacterChoicesForStart();
      resetGame();
      HexSnakeAudio.warmup([characterFor("player"), characterFor("computer")]);
      HexSnakeAudio.playCharacter("player", "start", { unlock: true });
      HexSnakeAudio.playCharacter("computer", "start", { delay: 0.08, gainScale: 0.75 });
      running = true;
      setSettingsLocked(true);
      setStatus("對戰中：吃食物累積能量，集滿可獲得炸彈。");
      overlay.classList.remove("show");
      characterStage.hidden = false;
      updateAutoBattleControls();
      lastPlayerStep = performance.now();
      lastComputerStep = lastPlayerStep;
      lastTimerFrame = lastPlayerStep;
      HexSnakeReplay.startRecording();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
      return true;
    }

    function autoStartGame() {
      if (running && !gameOver) return true;
      if (gameOver) return false;
      beginStartLogoCountdown();
      return false;
    }

    function returnToStartScreen() {
      clearGameOverSettlementTimer();
      clearRelayRestartTimer();
      computerBattleMode = false;
      playerAutoMode = false;
      computerBattleManualOverride = false;
      setRelayMode(false, false, false);
      updateSettingsActionMode();
      updateAutoBattleControls();
      resetGame();
      overlayTitle.textContent = "準備開局";
      overlayText.textContent = "重新選擇角色後按開始。";
      startButton.textContent = "開始";
      computerBattleButton.hidden = false;
      replayArchiveButton.hidden = false;
      renderIntroPortraits(false);
      overlay.classList.add("show");
    }

    function openGameOverCharacterSelect(owner) {
      if (!gameOver) return;
      const nextOwner = owner === "computer" ? "computer" : "player";
      returnToStartScreen();
      selectedPortraitOwner = nextOwner;
      overlayTitle.textContent = "角色選擇";
      overlayText.textContent = "選好角色後關閉選擇畫面，會回到開始畫面。";
      renderIntroPortraits(true);
      overlay.classList.add("show");
    }

    function randomFoodType(preferredFoodId = null) {
      if (!preferredFoodId || preferredFoodId === "balanced") {
        return foodTypes[Math.floor(Math.random() * foodTypes.length)];
      }
      let roll = Math.random();
      for (const type of foodTypes) {
        const weight = type.id === preferredFoodId ? preferredFoodWeight : otherFoodWeight;
        if (roll < weight) return type;
        roll -= weight;
      }
      return foodTypes[foodTypes.length - 1];
    }

    function randomFoodTypeIds(preferredFoodId = null, dualColor = false) {
      const firstType = randomFoodType(preferredFoodId);
      if (!dualColor) return [firstType.id];
      const secondOptions = foodTypes.filter(type => type.id !== firstType.id);
      const secondType = secondOptions[Math.floor(Math.random() * secondOptions.length)];
      return [firstType.id, secondType.id];
    }

    function randomFoodTypeIdsForCharacter(character) {
      if (character?.specialFood === "black" && Math.random() < blackSpecialChance) {
        return ["black"];
      }
      if (character?.specialFood === "black") {
        return randomFoodTypeIds(null, false);
      }
      const preferredFoodId = character ? character.food : null;
      const dualColor = character?.food === "balanced" && Math.random() < balancedDualChance;
      return randomFoodTypeIds(preferredFoodId, dualColor);
    }

    function placeFoods(preferredOwners = []) {
      const occupied = new Set([
        ...snake.map(keyOf),
        ...computerSnake.map(keyOf),
        ...foods.map(keyOf)
      ]);
      let generated = 0;
      while (foods.length < foodCount) {
        const openCells = cells.filter(cell => !occupied.has(keyOf(cell)));
        if (!openCells.length) return;
        const cell = openCells[Math.floor(Math.random() * openCells.length)];
        const owner = preferredOwners[generated];
        const character = owner ? characterFor(owner) : null;
        foods.push({ q: cell.q, r: cell.r, types: randomFoodTypeIdsForCharacter(character) });
        occupied.add(keyOf(cell));
        generated += 1;
      }
    }

    function updateStockHud(owner, stock, ammo, ammoCharge) {
      const totalEl = resourceEls.get(owner);
      if (totalEl) {
        const now = performance.now();
        const energyFlashing = now < (owner === "player" ? playerEnergyFlashUntil : computerEnergyFlashUntil);
        const bombFlashing = now < (owner === "player" ? playerBombFlashUntil : computerBombFlashUntil);
        const energyRatio = Math.max(0, Math.min(1, ammoCharge / Math.max(1, attackNeedTotal)));
        const bombRatio = Math.max(0, Math.min(1, ammo / Math.max(1, maxAmmo)));
        totalEl.innerHTML = `
          <span class="resource-chip${energyFlashing ? " is-flashing" : ""}" title="能量">
            <span class="resource-icon energy-icon" aria-hidden="true"></span>
            <span class="resource-chip-track" role="meter" aria-label="能量" aria-valuemin="0" aria-valuenow="${ammoCharge}" aria-valuemax="${attackNeedTotal}" aria-valuetext="${ammoCharge}/${attackNeedTotal}">
              <span class="resource-chip-fill" style="--resource-ratio: ${energyRatio.toFixed(4)}"></span>
            </span>
            <span class="resource-chip-value">${ammoCharge}/${attackNeedTotal}</span>
          </span>
          <span class="resource-chip${bombFlashing ? " is-flashing" : ""}" title="炸彈">
            <span class="resource-icon missile-icon" aria-hidden="true"></span>
            <span class="resource-chip-track" role="meter" aria-label="炸彈" aria-valuemin="0" aria-valuenow="${ammo}" aria-valuemax="${maxAmmo}" aria-valuetext="${ammo}/${maxAmmo}">
              <span class="resource-chip-fill" style="--resource-ratio: ${bombRatio.toFixed(4)}"></span>
            </span>
            <span class="resource-chip-value">${ammo}/${maxAmmo}</span>
          </span>
        `;
      }
      const now = performance.now();
      const energyFlashing = now < (owner === "player" ? playerEnergyFlashUntil : computerEnergyFlashUntil);
      const bombFlashing = now < (owner === "player" ? playerBombFlashUntil : computerBombFlashUntil);
      const energyRatio = Math.max(0, Math.min(1, ammoCharge / Math.max(1, attackNeedTotal)));
      const bombRatio = Math.max(0, Math.min(1, ammo / Math.max(1, maxAmmo)));
      const energyChip = resourceEls.get(`${owner}-energyChip`);
      const energyTrack = resourceEls.get(`${owner}-energyTrack`);
      const energyFill = resourceEls.get(`${owner}-energyFill`);
      const energyValue = resourceEls.get(`${owner}-energyValue`);
      const bombChip = resourceEls.get(`${owner}-bombChip`);
      const bombTrack = resourceEls.get(`${owner}-bombTrack`);
      const bombFill = resourceEls.get(`${owner}-bombFill`);
      const bombValue = resourceEls.get(`${owner}-bombValue`);
      energyChip?.classList.toggle("is-flashing", energyFlashing);
      bombChip?.classList.toggle("is-flashing", bombFlashing);
      if (energyTrack) {
        energyTrack.setAttribute("aria-valuenow", String(ammoCharge));
        energyTrack.setAttribute("aria-valuemax", String(attackNeedTotal));
        energyTrack.setAttribute("aria-valuetext", `${ammoCharge}/${attackNeedTotal}`);
      }
      if (bombTrack) {
        bombTrack.setAttribute("aria-valuenow", String(ammo));
        bombTrack.setAttribute("aria-valuemax", String(maxAmmo));
        bombTrack.setAttribute("aria-valuetext", `${ammo}/${maxAmmo}`);
      }
      if (energyFill) energyFill.style.setProperty("--resource-ratio", energyRatio.toFixed(4));
      if (bombFill) bombFill.style.setProperty("--resource-ratio", bombRatio.toFixed(4));
      if (energyValue) energyValue.textContent = `${ammoCharge}/${attackNeedTotal}`;
      if (bombValue) bombValue.textContent = `${ammo}/${maxAmmo}`;
      foodTypes.forEach(type => {
        const count = Math.max(0, Math.min(maxFoodStock, Math.round(stock[type.id] || 0)));
        const countEl = resourceEls.get(`${owner}-${type.id}-count`);
        const fill = resourceEls.get(`${owner}-${type.id}-fill`);
        if (countEl) countEl.textContent = count;
        if (fill) fill.style.width = `${Math.min(100, count / maxFoodStock * 100)}%`;
      });
    }

    function updateHealthBar(owner, hp, maxHp) {
      const bar = owner === "player" ? playerHealthBar : computerHealthBar;
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
      const remainingMs = attackCooldownRemainingMs("player", profile, now);
      const cooling = remainingMs > 0;
      const available = canAttack("player", profile);
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
      updateCooldownIndicator("small", cooldownSmallIndicator, cooldownSmallValue, now);
      updateCooldownIndicator("big", cooldownBigIndicator, cooldownBigValue, now);
    }

    function updateHud() {
      lastHudFrameAt = performance.now();
      const playerMaxHp = maxHpForSnake(snake);
      const computerMaxHp = maxHpForSnake(computerSnake);
      scoreEl.textContent = `HP ${Math.max(0, Math.ceil(playerHp))}/${playerMaxHp}`;
      computerScoreEl.textContent = `HP ${Math.max(0, Math.ceil(computerHp))}/${computerMaxHp}`;
      updateHealthBar("player", playerHp, playerMaxHp);
      updateHealthBar("computer", computerHp, computerMaxHp);
      bestEl.textContent = best;
      totalTimeEl.textContent = formatTime(totalElapsedMs);
      lastFeedTimeEl.textContent = formatTime(lastFeedElapsedMs);
      bestTimeEl.textContent = formatTime(bestTotalMs);
      const now = performance.now();
      const playerSpeedValue = isMovementStunned("player", now) ? 0 : movementSpeed(playerStock) / (now < playerSlowUntil ? 2 : 1);
      const computerSpeedValue = isMovementStunned("computer", now) ? 0 : movementSpeed(computerStock) / (now < computerSlowUntil ? 2 : 1);
      const playerSpeed = Math.round(playerSpeedValue * 10) / 10;
      const computerSpeed = Math.round(computerSpeedValue * 10) / 10;
      playerSpeedEl.textContent = `${playerSpeed}x`;
      computerSpeedEl.textContent = `${computerSpeed}x`;
      keyEls.forEach(el => el.classList.toggle("active", Number(el.dataset.dir) === nextDir));
      updateStockHud("player", playerStock, playerAmmo, playerAmmoCharge);
      updateStockHud("computer", computerStock, computerAmmo, computerAmmoCharge);
      updateCooldownHud(now);
    }

    function updateHudThrottled(now = performance.now()) {
      if (now - lastHudFrameAt < hudFrameIntervalMs) return;
      updateHud();
    }

    function recordReplaySnapshotThrottled(now) {
      if (now - lastReplayRecordCheckAt < replayRecordCheckIntervalMs) return;
      lastReplayRecordCheckAt = now;
      HexSnakeReplay.recordSnapshot(now);
    }

    function setStatus(text) {
      statusEl.textContent = text;
    }

    function normalizeAutoBattleSpeed(value) {
      const parsed = Number(value);
      return autoBattleSpeeds.includes(parsed) ? parsed : 1;
    }

    function autoBattleSpeedLabel(value) {
      return `x${Number(value).toString()}`;
    }

    function renderAutoSpeedMenu() {
      autoSpeedMenu.innerHTML = autoBattleSpeeds.map(speed => `
        <button class="${speed === computerBattleSpeed ? "is-selected" : ""}" type="button" data-auto-speed="${speed}">${autoBattleSpeedLabel(speed)}</button>
      `).join("");
    }

    function setAutoSpeedMenuOpen(open) {
      autoSpeedMenu.hidden = !open;
      autoBattleSpeedSelect.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) renderAutoSpeedMenu();
    }

    function replaySpeedOptions() {
      return [...HexSnakeReplay.playbackSpeeds].sort((a, b) => b - a);
    }

    function replaySpeedLabel(value) {
      return `x${Number(value).toString()}`;
    }

    function renderReplaySpeedMenu() {
      const playback = HexSnakeReplay.playback;
      const selectedSpeed = playback?.speed ?? 1;
      replaySpeedMenu.innerHTML = replaySpeedOptions().map(speed => `
        <button class="${speed === selectedSpeed ? "is-selected" : ""}" type="button" data-replay-speed="${speed}">${replaySpeedLabel(speed)}</button>
      `).join("");
    }

    function setReplaySpeedMenuOpen(open) {
      replaySpeedMenu.hidden = !open;
      replaySpeedSelect.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) renderReplaySpeedMenu();
    }

    function setComputerBattleSpeed(value, persist = true) {
      computerBattleSpeed = normalizeAutoBattleSpeed(value);
      autoBattleSpeedSelect.textContent = autoBattleSpeedLabel(computerBattleSpeed);
      autoBattleSpeedSelect.dataset.value = String(computerBattleSpeed);
      autoBattleSpeedSelect.setAttribute("aria-valuenow", String(computerBattleSpeed));
      autoBattleSpeedSelect.setAttribute("aria-valuetext", autoBattleSpeedLabel(computerBattleSpeed));
      renderAutoSpeedMenu();
      if (persist) {
        localStorage.setItem("hexSnakeAutoBattleSpeed", String(computerBattleSpeed));
      }
    }

    function resetAutoBattleStepTimers() {
      lastPlayerStep = performance.now();
      lastComputerStep = lastPlayerStep;
      lastTimerFrame = lastPlayerStep;
    }

    function isPlayerAutoControlActive() {
      return (computerBattleMode && !computerBattleManualOverride) || playerAutoMode;
    }

    function isRelayModeAvailable() {
      return computerBattleMode ? !computerBattleManualOverride : playerAutoMode;
    }

    function clearRelayRestartTimer() {
      if (!relayRestartTimer) return;
      clearTimeout(relayRestartTimer);
      relayRestartTimer = null;
    }

    function clearGameOverSettlementTimer() {
      gameOverSettlementPending = false;
      gameOverRelayStartOptions = null;
      gameOverContinuousVisualDeadlineAt = 0;
      gameOverLogoTransitionEndsAt = 0;
      gameOverResultOwner = null;
      gameOverPlayerLost = false;
      gameOverComputerLost = false;
      clearLogoTransition();
    }

    function resetRelayScore() {
      relayPlayerWins = 0;
      relayComputerWins = 0;
      relayDraws = 0;
    }

    function setRelayMode(enabled, resetScore = false, persist = true) {
      if (persist) relayModePreference = Boolean(enabled);
      const requestedRelayMode = persist ? relayModePreference : Boolean(enabled);
      relayMode = requestedRelayMode && isRelayModeAvailable();
      relayModeInput.checked = relayMode;
      if (persist) localStorage.setItem("hexSnakeRelayMode", relayModePreference ? "1" : "0");
      if (resetScore) resetRelayScore();
      if (!relayMode) clearRelayRestartTimer();
      updateRelayControls();
    }

    function updateRelayControls() {
      const visible = !HexSnakeReplay.isPlaybackMode() && (relayMode || (running && !gameOver && isRelayModeAvailable()));
      relayPanel.hidden = !visible;
      relayModeInput.checked = relayMode;
      relayScore.innerHTML = `<span class="owner-name is-p1">P1</span> ${relayPlayerWins} 勝 / <span class="owner-name is-p2">P2</span> ${relayComputerWins} 勝 / 平手 ${relayDraws}`;
    }

    function updateAutoBattleControls() {
      const visible = isPlayerAutoControlActive() && running && !gameOver && !HexSnakeReplay.isPlaybackMode();
      autoBattlePanel.hidden = !visible;
      autoBattleSpeedSelect.textContent = autoBattleSpeedLabel(computerBattleSpeed);
      autoBattleSpeedSelect.dataset.value = String(computerBattleSpeed);
      autoBattleSpeedSelect.setAttribute("aria-valuenow", String(computerBattleSpeed));
      autoBattleSpeedSelect.setAttribute("aria-valuetext", autoBattleSpeedLabel(computerBattleSpeed));
      if (!visible) setAutoSpeedMenuOpen(false);
      autoPauseButton.textContent = paused ? "▶" : "⏸";
      autoPauseButton.setAttribute("aria-label", paused ? "播放" : "暫停");
      autoPauseButton.title = paused ? "播放" : "暫停";
      updateRelayControls();
    }

    function setPlayerAutoMode(active, announce = true) {
      const nextActive = Boolean(active) && running && !gameOver && !HexSnakeReplay.isPlaybackMode();
      if (playerAutoMode === nextActive) return;
      playerAutoMode = nextActive;
      if (playerAutoMode) {
        setComputerBattleSpeed(localStorage.getItem("hexSnakeAutoBattleSpeed"), false);
        setRelayMode(relayModePreference, false, false);
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
      if (!computerBattleMode || !running || gameOver || HexSnakeReplay.isPlaybackMode()) return;
      computerBattleManualOverride = Boolean(active);
      if (!computerBattleManualOverride) {
        setComputerBattleSpeed(localStorage.getItem("hexSnakeAutoBattleSpeed"), false);
        setRelayMode(relayModePreference, false, false);
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

    function sandwormUndergroundAlpha(owner, now) {
      if (characterFor(owner).id !== "sandworm") return 1;
      const armorFrom = owner === "player" ? playerSandwormArmorFrom : computerSandwormArmorFrom;
      const armorUntil = owner === "player" ? playerSandwormArmorUntil : computerSandwormArmorUntil;
      const from = owner === "player" ? playerUndergroundFrom : computerUndergroundFrom;
      const until = owner === "player" ? playerUndergroundUntil : computerUndergroundUntil;
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
      if (characterFor(owner).id !== "sandworm") return false;
      const from = owner === "player" ? playerSandwormArmorFrom : computerSandwormArmorFrom;
      const until = owner === "player" ? playerSandwormArmorUntil : computerSandwormArmorUntil;
      return Boolean(from && now >= from && now <= until);
    }

    function isOwnerDamageImmune(owner, now) {
      return isOwnerUnderground(owner, now);
    }

    function clearOwnerAbnormalStatus(owner, now) {
      if (owner === "player") {
        playerStunUntil = Math.min(playerStunUntil, now);
        playerSlowUntil = Math.min(playerSlowUntil, now);
        playerCollisionParalysisMs = 0;
        playerVulnerable = false;
      } else {
        computerStunUntil = Math.min(computerStunUntil, now);
        computerSlowUntil = Math.min(computerSlowUntil, now);
        computerCollisionParalysisMs = 0;
        computerVulnerable = false;
      }
    }

    function refreshSandwormProtections(now) {
      ["player", "computer"].forEach(owner => {
        if (isOwnerSandwormArmored(owner, now)) clearOwnerAbnormalStatus(owner, now);
      });
    }

    function canTurn(newDir) {
      return snake.length < 2 || (newDir + 3) % 6 !== dir;
    }

    function canComputerTurn(newDir) {
      return computerSnake.length < 2 || (newDir + 3) % 6 !== computerDir;
    }

    function canOwnerTurn(owner, newDir) {
      if (owner === "player") return snake.length < 2 || (newDir + 3) % 6 !== dir;
      return canComputerTurn(newDir);
    }

    function hexDistance(a, b) {
      const as = -a.q - a.r;
      const bs = -b.q - b.r;
      return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(as - bs)) / 2;
    }

    function nextCell(head, direction) {
      const delta = directions[direction];
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
      let target = { ...snake[0] };
      for (let step = 0; step < targetMaxHex; step += 1) {
        const next = nextWrappedCell(target, direction);
        target = next;
      }
      return target;
    }

    function setDirectionButtonHighlight(direction = null) {
      hexDirButtons.forEach(button => button.classList.toggle("active", Number(button.dataset.dir) === direction));
    }

    function setDirection(newDir, options = {}) {
      if (!Number.isInteger(newDir) || newDir < 0 || newDir > 5) return;
      if (canTurn(newDir)) {
        const changed = nextDir !== newDir;
        nextDir = newDir;
        setDirectionButtonHighlight(newDir);
        if (changed) triggerTouchFeedback(options.feedbackEvent, options.feedbackStrength ?? 6);
        updateHud();
      }
    }

    function attackStats(stock, profile = "big") {
      const isSmall = profile === "small";
      return {
        delay: attackDelay(stock) * (isSmall ? smallAttackDelayScale : 1),
        radius: Math.max(1, blastRadius(stock) + (isSmall ? -1 : 0)),
        damage: attackDamage(stock, profile)
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
      return owner === "player" ? nextDir : computerDir;
    }

    function directionVector(direction) {
      const delta = directions[direction];
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
      directions.forEach((direction, index) => {
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
      const clockwise = (right - left + directions.length) % directions.length;
      return Math.min(clockwise, directions.length - clockwise);
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
      const candidates = [direction, (direction + 1) % directions.length, (direction + 5) % directions.length];
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
      const maxSteps = Math.max(1, Math.ceil((radius * 2 + 1) / 2));
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
      return cells.filter(cell => !excluded.has(keyOf(cell)) && effectCells.some(effectCell => {
        const distance = hexDistance(cell, effectCell);
        return distance >= minDistance && distance <= width;
      }));
    }

    function attackVisualType(owner, profile = "big", characterId = null) {
      const character = characterFor(owner);
      return `${characterId || character.id}-${profile}`;
    }

    function characterForVisualType(owner, visualType = null) {
      const visualCharacterId = typeof visualType === "string" ? visualType.split("-")[0] : null;
      return characterById.get(visualCharacterId) || characterFor(owner);
    }

    function burstVisualType(projectile) {
      const type = projectile.visualType || attackVisualType(projectile.owner, projectile.profile);
      return type.endsWith("-big") ? type.replace(/-big$/, "-burst") : type;
    }

    function triggerSmallHitShake(projectile, playerDamage, computerDamage, now) {
      if (projectile.profile !== "small") return;
      if (playerDamage <= 0 && computerDamage <= 0) return;
      triggerBoardShake(projectile.visualType || attackVisualType(projectile.owner, projectile.profile), now, { profile: "smallHit" });
    }

    function pushCircleAttack({ owner, profile, source = null, target, createdAt, impactAt, delay, radius, damage, stunChance, hidden = false, flat = false, visualType = null, ...extra }) {
      projectiles.push({
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
      return directions
        .map((_, direction) => nextWrappedCell(currentTarget, direction))
        .reduce((best, candidate) => {
          const next = {
            target: candidate,
            damage: damageSnake(targetSnake, candidate, radius, damage),
            headDistance: head ? hexDistance(candidate, head) : 0
          };
          if (next.damage > best.damage) return next;
          if (next.damage === best.damage && keyOf(best.target) !== keyOf(current.target) && next.headDistance < best.headDistance) return next;
          return best;
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
      projectiles.push({
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
        projectiles.push({
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
      return attackStunChance(stock, ultimateSetting("lobster", "vulnerabilityChance", 0.3));
    }

    function attackHitStunChances(stock) {
      return {
        body: Math.min(1, bodyHitStunChance + foodBonus(stock, "carb", bodyHitStunChanceBonusPerPoint, bodyHitMaxStunChanceBonus)),
        head: Math.min(1, headHitStunChance + foodBonus(stock, "carb", headHitStunChanceBonusPerPoint, headHitMaxStunChanceBonus))
      };
    }

    function scheduleCharacterBigAttack(owner, character, source, target, now, stock, stunChance, options = {}) {
      const small = attackStats(stock, "small");
      const bigDamage = attackDamage(stock, "big");
      const direction = Number.isInteger(options.aimDirection)
        ? options.aimDirection
        : directionFromSourceToTarget(source, target, ownerDirection(owner));

      if (character.id === "lobster") {
        const fistStepMs = ultimateSetting(character.id, "fistStepMs", 36);
        const volleys = Math.max(1, Math.round(ultimateSetting(character.id, "volleyCount", 2)));
        const contactDamage = bigDamage * ultimateSetting(character.id, "contactDamageMultiplier", 0.6);
        const contactRadius = Math.max(0.25, ultimateSetting(character.id, "contactRadius", 1));
        const burstRadius = small.radius * ultimateSetting(character.id, "burstRadiusMultiplier", 1.6);
        const burstDamage = bigDamage * ultimateSetting(character.id, "burstDamageMultiplier", 1.6);
        const palmVulnerabilityChance = Number.isFinite(options.vulnerabilityChance)
          ? options.vulnerabilityChance
          : lobsterPalmVulnerabilityChance(stock);
        const visualType = "lobster-palm-big";
        const volleyIntervalMs = attackDelay(stock);
        let maxTravelDelay = 0;
        for (let volley = 0; volley < volleys; volley += 1) {
          const volleyDelay = volley * volleyIntervalMs;
          const hand = volley % 2 === 0 ? "right" : "left";
          if (volley === 0) {
            maxTravelDelay = Math.max(maxTravelDelay, scheduleLobsterPalmVolley({
              owner,
              source,
              direction,
              targetSnake: owner === "player" ? computerSnake : snake,
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
            const maxSteps = Math.max(1, Math.ceil((radius * 2 + 1) / 2));
            maxTravelDelay = Math.max(maxTravelDelay, small.delay + maxSteps * fistStepMs);
            projectiles.push({
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
        const excludedCells = (owner === "player" ? snake : computerSnake).map(segment => ({ q: segment.q, r: segment.r }));
        const durationMs = baseAttackDelayMs * smallAttackDelayScale * Math.max(1, ultimateSetting(character.id, "durationBaseTicks", 4));
        const tickMs = Math.max(1, small.delay);
        const damage = bigDamage * ultimateSetting(character.id, "damageMultiplier", 0.24);
        projectiles.push({
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
        const trail = (owner === "player" ? snake : computerSnake).map(segment => ({ q: segment.q, r: segment.r }));
        const duration = 3000;
        const extensionDamageMultiplier = Math.max(0, Math.min(1, (stock.protein || 0) / maxFoodStock));
        const outwardWidth = extensionDamageMultiplier > 0 ? 1 : 0;
        const tickMs = ultimateSetting(character.id, "tickMs", baseStepMs);
        const slowDurationMs = ultimateSetting(character.id, "slowDurationMs", 2000);
        hazards.push({
          kind: "swamp",
          owner,
          cells: trail,
          damageExcludedCells: trail,
          visualExcludedCells: [],
          width: outwardWidth,
          minDistance: 0,
          outerDamageMultiplier: extensionDamageMultiplier,
          visualType: attackVisualType(owner, "big"),
          damage: bigDamage * ultimateDamageMultiplier(character.id),
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
        const armorFrom = now + small.delay * ultimateSetting(character.id, "superArmorDelayMultiplier", 1);
        const armorUntil = armorFrom + ultimateSetting(character.id, "superArmorDurationMs", 3000);
        const undergroundFrom = now + small.delay * ultimateSetting(character.id, "invisibleDelayMultiplier", 2);
        const undergroundUntil = undergroundFrom + ultimateSetting(character.id, "invisibleDurationMs", 1500);
        const delay = small.delay * ultimateSetting(character.id, "impactDelayMultiplier", 3);
        if (owner === "player") {
          playerSandwormArmorFrom = armorFrom;
          playerSandwormArmorUntil = Math.max(playerSandwormArmorUntil, armorUntil);
          playerUndergroundFrom = undergroundFrom;
          playerUndergroundUntil = Math.max(playerUndergroundUntil, undergroundUntil);
        } else {
          computerSandwormArmorFrom = armorFrom;
          computerSandwormArmorUntil = Math.max(computerSandwormArmorUntil, armorUntil);
          computerUndergroundFrom = undergroundFrom;
          computerUndergroundUntil = Math.max(computerUndergroundUntil, undergroundUntil);
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
          damage: bigDamage * ultimateSetting(character.id, "damageMultiplier", 7),
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
        const spiritRadius = small.radius * ultimateSetting(character.id, "radiusMultiplier", 2);
        const impactDamage = bigDamage * ultimateSetting(character.id, "impactDamageMultiplier", 1.08);
        const radiationTotalDamage = bigDamage * ultimateSetting(character.id, "radiationDamageMultiplier", 2);
        const radiationDurationMs = ultimateSetting(character.id, "radiationDurationMs", 4000);
        const radiationTickMs = ultimateSetting(character.id, "radiationTickMs", 500);
        const firstImpactDelay = small.delay * ultimateSetting(character.id, "firstImpactDelayMultiplier", 2);
        const visualType = "dragon-spirit-big";
        const volleys = 1;
        for (let index = 0; index < volleys; index += 1) {
          const impactDelay = firstImpactDelay + index * 2000;
          projectiles.push({
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
        const targetSnake = owner === "player" ? computerSnake : snake;
        const damage = bigDamage * ultimateSetting(character.id, "damageMultiplier", 1.414);
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
      pushCircleAttack({ owner, profile: "big", target, createdAt: now, impactAt: now + big.delay, delay: big.delay, radius: big.radius, damage: big.damage * ultimateDamageMultiplier(character.id), stunChance, headStunChance: options.hitStunChances?.head ?? stunChance });
      return big.delay;
    }

    function launchAttack(owner, target, now, profile = "big", options = {}) {
      const stock = owner === "player" ? playerStock : computerStock;
      const lastAttack = lastAttackMsFor(owner, profile);
      const source = owner === "player" ? snake[0] : computerSnake[0];
      const character = characterFor(owner);
      const isSmall = profile === "small";
      if (!canAttack(owner, profile)) return false;
      if (now - lastAttack < attackProfileCooldown(stock, profile, character.id)) return false;
      const stats = attackStats(stock, profile);
      const hitStunChances = attackHitStunChances(stock);
      const stunChance = hitStunChances.body;
      const vulnerabilityChance = !isSmall && character.id === "lobster"
        ? lobsterPalmVulnerabilityChance(stock)
        : 0;
      consumeAttackCost(owner, stock, profile);
      if (owner === "player") {
        setLastAttackMsFor(owner, profile, now);
        playerBombFlashUntil = now + 1200;
      } else {
        setLastAttackMsFor(owner, profile, now);
        computerBombFlashUntil = now + 1200;
      }
      HexSnakeAudio.playCharacter(owner, isSmall ? "small" : "big");
      const poseDuration = isSmall
        ? stats.delay
        : scheduleCharacterBigAttack(owner, character, source, target, now, stock, stunChance, { ...options, vulnerabilityChance, hitStunChances });
      if (isSmall) {
        projectiles.push({
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
      setFighterPose(owner, "attack", Math.max(180, Math.min(poseDuration, 520)));
      showAttackCallout(owner, profile);
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
        const bestMultiplier = effectCells.reduce((best, cell) => {
          const distance = hexDistance(segment, cell);
          if (distance < minDistance || distance > width) return best;
          return Math.max(best, lineBandDamageMultiplier(distance, { width, fullDamageWidth, outerDamageMultiplier }));
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
      return owner === "player" ? playerVulnerable : computerVulnerable;
    }

    function setOwnerVulnerable(owner, vulnerable) {
      if (owner === "player") playerVulnerable = vulnerable;
      else computerVulnerable = vulnerable;
    }

    function applyBlastDamage(owner, damage, now = performance.now()) {
      if (damage <= 0) return;
      if (isOwnerDamageImmune(owner, now)) return;
      const finalDamage = isOwnerVulnerable(owner) ? damage * 2 : damage;
      if (isOwnerVulnerable(owner)) setOwnerVulnerable(owner, false);
      if (owner === "player") {
        playerHp = Math.max(0, playerHp - finalDamage);
      } else {
        computerHp = Math.max(0, computerHp - finalDamage);
      }
    }

    function interruptCasting(owner) {
      const beforeCount = projectiles.length;
      projectiles = projectiles.filter(projectile => projectile.owner !== owner || projectile.ignoreCasterInterrupt);
      return projectiles.length !== beforeCount;
    }

    function applyAttackStun(owner, chance = baseAttackStunChance, now = performance.now(), options = {}) {
      if (Math.random() >= chance) return false;
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      const interrupted = options.interrupt !== false && interruptCasting(owner);
      const currentStunUntil = owner === "player" ? playerStunUntil : computerStunUntil;
      const stunBase = options.stack ? Math.max(now, currentStunUntil) : now;
      const stunUntil = stunBase + attackStunMs;
      const slowUntil = stunUntil + attackSlowMs;
      if (owner === "player") {
        playerStunUntil = Math.max(playerStunUntil, stunUntil);
        playerSlowUntil = Math.max(playerSlowUntil, slowUntil);
      } else {
        computerStunUntil = Math.max(computerStunUntil, stunUntil);
        computerSlowUntil = Math.max(computerSlowUntil, slowUntil);
      }
      showStatusCallout(owner, interrupted ? "暈眩！招式中斷" : "暈眩！", { interrupted });
      return true;
    }

    function applyAttackSlow(owner, chance = 1, durationMs = 2000, now = performance.now(), options = {}) {
      if (Math.random() >= chance) return false;
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      const currentSlowUntil = owner === "player" ? playerSlowUntil : computerSlowUntil;
      const slowUntil = options.stack === false && currentSlowUntil > now
        ? currentSlowUntil
        : Math.max(currentSlowUntil, now + durationMs);
      if (owner === "player") {
        playerSlowUntil = slowUntil;
      } else {
        computerSlowUntil = slowUntil;
      }
      return true;
    }

    function applyVulnerability(owner, chance = baseAttackStunChance, now = performance.now()) {
      if (Math.random() >= chance) return false;
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      setOwnerVulnerable(owner, true);
      showStatusCallout(owner, "易傷");
      return true;
    }

    function applyCollisionPenalty(owner, severity = 1, now = performance.now()) {
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      const interrupted = interruptCasting(owner);
      const stunUntil = now + collisionStunMs * severity;
      const slowUntil = stunUntil + collisionSlowMs * severity;
      if (owner === "player") {
        playerStunUntil = Math.max(playerStunUntil, stunUntil);
        playerSlowUntil = Math.max(playerSlowUntil, slowUntil);
        playerCollisionParalysisMs += collisionStunMs * severity;
        if (interrupted) showStatusCallout(owner, severity > 1 ? "重度麻痺！招式中斷" : "麻痺！招式中斷", { interrupted });
        return playerCollisionParalysisMs > maxCollisionParalysisMs;
      } else {
        computerStunUntil = Math.max(computerStunUntil, stunUntil);
        computerSlowUntil = Math.max(computerSlowUntil, slowUntil);
        computerCollisionParalysisMs += collisionStunMs * severity;
        if (interrupted) showStatusCallout(owner, severity > 1 ? "重度麻痺！招式中斷" : "麻痺！招式中斷", { interrupted });
        return computerCollisionParalysisMs > maxCollisionParalysisMs;
      }
    }

    function applyCollisionParalysis(owner, now = performance.now()) {
      if (isOwnerSandwormArmored(owner, now)) {
        clearOwnerAbnormalStatus(owner, now);
        return false;
      }
      const interrupted = interruptCasting(owner);
      const stunUntil = now + collisionStunMs;
      const slowUntil = stunUntil + collisionSlowMs;
      if (owner === "player") {
        playerStunUntil = Math.max(playerStunUntil, stunUntil);
        playerSlowUntil = Math.max(playerSlowUntil, slowUntil);
      } else {
        computerStunUntil = Math.max(computerStunUntil, stunUntil);
        computerSlowUntil = Math.max(computerSlowUntil, slowUntil);
      }
      if (interrupted) showStatusCallout(owner, "麻痺！招式中斷", { interrupted });
      return true;
    }

    function collisionSeverity(selfHit, opponentHit) {
      if (selfHit) return 2;
      if (opponentHit) return 1;
      return 0;
    }

    function resolveProjectiles(now) {
      const landed = projectiles.filter(projectile => now >= projectile.impactAt);
      if (!landed.length) return;
      projectiles = projectiles.filter(projectile => now < projectile.impactAt);

      landed.forEach(projectile => {
        let playerDamage = 0;
        let computerDamage = 0;
        let playerStunChance = projectile.stunChance;
        let computerStunChance = projectile.stunChance;
        if (projectile.kind === "lineHazardSetup") {
          hazards.push({
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
          const source = ownerHead(projectile.owner);
          if (source) {
            scheduleLobsterPalmVolley({
              owner: projectile.owner,
              source,
              direction: Number.isInteger(projectile.direction) ? projectile.direction : ownerDirection(projectile.owner),
              targetSnake: projectile.owner === "player" ? computerSnake : snake,
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
          const defenderSnake = defenderOwner === "player" ? snake : computerSnake;
          const contactDamage = damageSnake(defenderSnake, projectile.target, projectile.radius, projectile.damage);
          if (defenderOwner === "player") playerDamage += contactDamage;
          else computerDamage += contactDamage;
          playerDamage += damageSnake(snake, projectile.target, projectile.burstRadius, projectile.burstDamage);
          computerDamage += damageSnake(computerSnake, projectile.target, projectile.burstRadius, projectile.burstDamage);
          const playerHeadHit = (defenderOwner === "player" && projectile.damage > 0 && circleAttackHitsHead(snake, projectile.target, projectile.radius))
            || (projectile.burstDamage > 0 && circleAttackHitsHead(snake, projectile.target, projectile.burstRadius));
          const computerHeadHit = (defenderOwner === "computer" && projectile.damage > 0 && circleAttackHitsHead(computerSnake, projectile.target, projectile.radius))
            || (projectile.burstDamage > 0 && circleAttackHitsHead(computerSnake, projectile.target, projectile.burstRadius));
          playerStunChance = stunChanceForHeadHit(playerHeadHit, projectile);
          computerStunChance = stunChanceForHeadHit(computerHeadHit, projectile);
          addProjectileBlastVisual(projectile, now);
        } else if (projectile.kind === "line") {
          playerDamage = damageSnakeCells(snake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells, 0, projectile.outerDamageMultiplier ?? 1, projectile.fullDamageWidth ?? 0);
          computerDamage = damageSnakeCells(computerSnake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells, 0, projectile.outerDamageMultiplier ?? 1, projectile.fullDamageWidth ?? 0);
          playerStunChance = lineProjectileStunChance(snake, projectile);
          computerStunChance = lineProjectileStunChance(computerSnake, projectile);
          addProjectileBlastVisual(projectile, now);
        } else {
          const radiationDamage = projectile.kind === "headCircle" && projectile.radiationDurationMs
            ? projectile.radiationTotalDamage / Math.max(1, Math.ceil(projectile.radiationDurationMs / projectile.radiationTickMs))
            : 0;
          const { explosionTarget, radius } = addProjectileBlastVisual(projectile, now, { radiationDamage });
          const damage = projectile.damage || 1;
          playerDamage = damageSnake(snake, explosionTarget, radius, damage);
          computerDamage = damageSnake(computerSnake, explosionTarget, radius, damage);
          playerStunChance = stunChanceForHeadHit(circleAttackHitsHead(snake, explosionTarget, radius), projectile);
          computerStunChance = stunChanceForHeadHit(circleAttackHitsHead(computerSnake, explosionTarget, radius), projectile);
          if (projectile.sandwormParalyzeOnBody || projectile.sandwormKillOnHead) {
            if (projectile.owner !== "player") {
              if (projectile.sandwormKillOnHead && snakeHeadHitAtCenter(snake, explosionTarget)) playerDamage = Math.max(playerDamage, playerHp);
              else if (projectile.sandwormParalyzeOnBody && snakeBodyHitAtCenter(snake, explosionTarget)) applyCollisionParalysis("player", now);
            }
            if (projectile.owner !== "computer") {
              if (projectile.sandwormKillOnHead && snakeHeadHitAtCenter(computerSnake, explosionTarget)) computerDamage = Math.max(computerDamage, computerHp);
              else if (projectile.sandwormParalyzeOnBody && snakeBodyHitAtCenter(computerSnake, explosionTarget)) applyCollisionParalysis("computer", now);
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
      blasts = blasts.filter(blast => now <= blast.endAt);
      if (playerHp <= 0 || computerHp <= 0) endGame(playerHp <= 0, computerHp <= 0);
    }

    function addProjectileBlastVisual(projectile, now, options = {}) {
      if (projectile.kind === "lobsterPalmSetup") return {};
      if (projectile.kind === "lobsterPalm") return {};
      if (projectile.kind === "lobsterPalmBurst") {
        const visualType = burstVisualType(projectile);
        blasts.push({
          kind: "circle",
          target: projectile.target,
          owner: projectile.owner,
          radius: projectile.burstRadius,
          visualType,
          hand: projectile.hand,
          startedAt: now,
          endAt: now + blastDurationMs * 1.25
        });
        triggerBoardShake(visualType, now);
        return { visualType };
      }
      if (projectile.kind === "lineHazardSetup") {
        const visualType = projectile.visualType || attackVisualType(projectile.owner, projectile.profile);
        blasts.push({
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
          endAt: now + blastDurationMs
        });
        triggerBoardShake(visualType, now);
        return { visualType };
      }
      if (projectile.kind === "line") {
        const visualType = projectile.visualType || attackVisualType(projectile.owner, projectile.profile);
        blasts.push({
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
          endAt: now + blastDurationMs
        });
        triggerBoardShake(visualType, now);
        return { visualType };
      }
      if (projectile.kind === "headCircle" && projectile.followHead) {
        const head = ownerHead(projectile.owner);
        projectile.explosionTarget = { q: head.q, r: head.r };
        projectile.target = { q: projectile.explosionTarget.q, r: projectile.explosionTarget.r };
      }
      const explosionTarget = projectile.explosionTarget || projectile.target;
      const radius = projectile.radius || baseBlastHexRadius;
      const visualType = projectile.visualType || attackVisualType(projectile.owner, projectile.profile);
      blasts.push({
        kind: "circle",
        target: explosionTarget,
        owner: projectile.owner,
        radius,
        visualType,
        hand: projectile.hand,
        startedAt: now,
        endAt: now + blastDurationMs
      });
      triggerBoardShake(visualType, now);
      if (projectile.kind === "headCircle" && projectile.radiationDurationMs) {
        hazards.push({
          kind: "radiation",
          owner: projectile.owner,
          target: { q: explosionTarget.q, r: explosionTarget.r },
          radius,
          width: radius,
          visualType: projectile.visualType === "dragon-spirit-big" ? "dragon-spirit-radiation" : "lobster-radiation",
          damage: options.radiationDamage ?? 0,
          stunChance: 0,
          startedAt: now,
          nextTickAt: now + projectile.radiationTickMs,
          tickMs: projectile.radiationTickMs,
          endAt: now + projectile.radiationDurationMs
        });
      }
      return { explosionTarget, radius, visualType };
    }

    function addProjectileImpactVisual(projectile, now) {
      addProjectileBlastVisual(projectile, now);
    }

    function advanceGameOverVisuals(now) {
      const landed = projectiles.filter(projectile => now >= projectile.impactAt);
      if (landed.length) {
        projectiles = projectiles.filter(projectile => now < projectile.impactAt);
        landed.forEach(projectile => addProjectileImpactVisual(projectile, now));
      }
      blasts = blasts.filter(blast => now <= blast.endAt);
      hazards = hazards.filter(hazard => now <= hazard.endAt);
      hazards.forEach(hazard => {
        if (now < hazard.startedAt || hazard.shaken) return;
        triggerBoardShake(hazard.visualType || attackVisualType(hazard.owner, "big"), now);
        hazard.shaken = true;
      });
      const projectilesActive = projectiles.some(projectile => now < projectile.impactAt);
      const blastsActive = blasts.some(blast => now <= blast.endAt);
      const continuousSkillVisualsActive = hazards.some(hazard => now <= hazard.endAt);
      const boardShakeActive = now < boardShakeUntil;
      if (
        continuousSkillVisualsActive
        && gameOverContinuousVisualDeadlineAt
        && now >= gameOverContinuousVisualDeadlineAt
        && !projectilesActive
        && !blastsActive
        && !boardShakeActive
      ) {
        return false;
      }
      return projectilesActive || blastsActive || continuousSkillVisualsActive || boardShakeActive;
    }

    function showGameOverSettlement() {
      gameOverSettlementPending = false;
      gameOverLogoTransitionEndsAt = 0;
      if (!gameOver || running || HexSnakeReplay.isPlaybackMode()) return;
      clearLogoTransition();
      renderWinnerPortrait(gameOverResultOwner, gameOverPlayerLost, gameOverComputerLost);
      overlay.classList.add("show");
      if (gameOverRelayStartOptions) {
        const nextOptions = gameOverRelayStartOptions;
        gameOverRelayStartOptions = null;
        relayRestartTimer = setTimeout(() => {
          relayRestartTimer = null;
          if (!relayMode) return;
          startGame(nextOptions);
        }, Math.max(900, gameOverRestartDelayMs + 80));
      }
    }

    function resolveHazards(now) {
      const activeHazards = hazards.filter(hazard => now <= hazard.endAt);
      hazards = activeHazards;
      activeHazards.forEach(hazard => {
        if (now < hazard.startedAt || now < hazard.nextTickAt) return;
        if (!hazard.shaken) {
          triggerBoardShake(hazard.visualType || attackVisualType(hazard.owner, "big"), now);
          hazard.shaken = true;
        }
        hazard.nextTickAt = now + hazard.tickMs;
        const damageExcludedCells = hazard.damageExcludedCells || hazard.excludedCells || [];
        let playerDamage = hazard.kind === "radiation"
          ? damageSnake(snake, hazard.target, hazard.radius, hazard.damage)
          : damageSnakeCells(snake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "player" ? damageExcludedCells : [], hazard.minDistance || 0, hazard.outerDamageMultiplier ?? 1, hazard.fullDamageWidth || 0);
        let computerDamage = hazard.kind === "radiation"
          ? damageSnake(computerSnake, hazard.target, hazard.radius, hazard.damage)
          : damageSnakeCells(computerSnake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "computer" ? damageExcludedCells : [], hazard.minDistance || 0, hazard.outerDamageMultiplier ?? 1, hazard.fullDamageWidth || 0);
        const playerStunChance = stunChanceForHeadHit(
          hazardHitsHead(snake, hazard, hazard.owner === "player" ? damageExcludedCells : []),
          hazard
        );
        const computerStunChance = stunChanceForHeadHit(
          hazardHitsHead(computerSnake, hazard, hazard.owner === "computer" ? damageExcludedCells : []),
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
      if (playerHp <= 0 || computerHp <= 0) endGame(playerHp <= 0, computerHp <= 0);
    }

    function advanceOwnerMovement(owner, next, eatenFood) {
      const parts = owner === "player" ? snake : computerSnake;
      const ate = Boolean(eatenFood);
      parts.unshift(next);
      if (!ate) {
        parts.pop();
        return null;
      }

      if (owner === "player") {
        score += 1;
        collectFood("player", eatenFood);
        best = Math.max(best, score);
        localStorage.setItem("hexSnakeBest", String(best));
        lastFeedElapsedMs = 0;
        lastPlayerFoodAt = performance.now();
        playerFoodTargetKey = null;
        playerFoodTargetAt = 0;
        playerHp = Math.min(maxHpForSnake(snake), playerHp + foodHealAmount());
      } else {
        computerScore += 1;
        lastComputerFoodAt = performance.now();
        computerFoodTargetKey = null;
        computerFoodTargetAt = 0;
        if (computerCanGrow()) {
          collectFood("computer", eatenFood);
          computerHp = Math.min(maxHpForSnake(computerSnake), computerHp + foodHealAmount());
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
      if (eatenKeys.size) foods = foods.filter(food => !eatenKeys.has(keyOf(food)));
      placeFoods(consumed.map(food => food.owner));
    }

    function step(headCollisionOrder = "simultaneous", now = performance.now()) {
      if (isPlayerAutoControlActive()) {
        nextDir = chooseAutoDirection("player");
        setDirectionButtonHighlight(nextDir);
      }
      dir = nextDir;
      computerDir = chooseComputerDirection();

      const next = nextWrappedCell(snake[0], dir);
      const computerNext = nextWrappedCell(computerSnake[0], computerDir);
      const nextKey = keyOf(next);
      const computerNextKey = keyOf(computerNext);
      const eatenFood = foods.find(food => next.q === food.q && next.r === food.r);
      const computerEatenFood = foods.find(food => computerNext.q === food.q && computerNext.r === food.r);
      const eating = Boolean(eatenFood);
      const computerEating = Boolean(computerEatenFood);
      const body = eating ? snake : snake.slice(0, -1);
      const computerBody = computerEating ? computerSnake : computerSnake.slice(0, -1);
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
      if (nextKey === keyOf(computerSnake[0]) && computerNextKey === keyOf(snake[0])) {
        playerOpponentHit = true;
        computerOpponentHit = true;
      }

      let playerCollision = collisionSeverity(playerSelfHit, playerOpponentHit);
      let computerCollision = collisionSeverity(computerSelfHit, computerOpponentHit);
      if (computerCollision && !playerCollision && computerSnake.some(segment => keyOf(segment) === nextKey)) {
        playerOpponentHit = true;
        playerCollision = collisionSeverity(playerSelfHit, playerOpponentHit);
      }
      if (playerCollision && !computerCollision && snake.some(segment => keyOf(segment) === computerNextKey)) {
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

      if (!playerCollision && running && !paused) maybeAutoBattlePlayerAttack(now);
      if (!computerCollision && running && !paused) maybeComputerAttack(now);
      updateHud();
    }

    function stepPlayerOnly(now = performance.now()) {
      if (isPlayerAutoControlActive()) {
        nextDir = chooseAutoDirection("player");
        setDirectionButtonHighlight(nextDir);
      }
      dir = nextDir;
      const next = nextWrappedCell(snake[0], dir);
      const nextKey = keyOf(next);
      const eatenFood = foods.find(food => next.q === food.q && next.r === food.r);
      const eating = Boolean(eatenFood);
      const body = eating ? snake : snake.slice(0, -1);
      const playerSelfHit = body.some(segment => keyOf(segment) === nextKey);
      const playerOpponentHit = computerSnake.some(segment => keyOf(segment) === nextKey);
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
      if (running && !paused) maybeAutoBattlePlayerAttack(now);
      updateHud();
    }

    function stepComputerOnly(now = performance.now()) {
      computerDir = chooseComputerDirection();
      const computerNext = nextWrappedCell(computerSnake[0], computerDir);
      const computerNextKey = keyOf(computerNext);
      const computerEatenFood = foods.find(food => computerNext.q === food.q && computerNext.r === food.r);
      const computerEating = Boolean(computerEatenFood);
      const computerBody = computerEating ? computerSnake : computerSnake.slice(0, -1);
      const computerSelfHit = computerBody.some(segment => keyOf(segment) === computerNextKey);
      const computerOpponentHit = snake.some(segment => keyOf(segment) === computerNextKey);
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
      if (running && !paused) maybeComputerAttack(now);
      updateHud();
    }

    function endGame(playerLost = true, computerLost = false) {
      if (gameOver) return;
      clearGameOverSettlementTimer();
      const shouldContinueRelay = relayMode && (computerBattleMode || playerAutoMode);
      const endedInAutoMode = isPlayerAutoControlActive();
      const shouldUseGameOverLogo = !endedInAutoMode && !shouldContinueRelay && !HexSnakeReplay.isPlaybackMode();
      const nextRelayStartOptions = computerBattleMode
        ? { computerBattle: true }
        : { playerAuto: true };
      const gameOverAt = performance.now();
      HexSnakeReplay.finishRecording(playerLost, computerLost);
      running = false;
      playerAutoMode = false;
      computerBattleManualOverride = false;
      gameOver = true;
      gameOverContinuousVisualDeadlineAt = gameOverAt + gameOverContinuousVisualMaxWaitMs;
      gameOverLogoTransitionEndsAt = shouldUseGameOverLogo ? gameOverAt + logoTransitionDurationMs : 0;
      updateAutoBattleControls();
      restartUnlockAt = gameOverAt + (shouldUseGameOverLogo ? logoTransitionDurationMs : gameOverRestartDelayMs);
      setSettingsLocked(false);
      if (totalElapsedMs > bestTotalMs) {
        bestTotalMs = totalElapsedMs;
        localStorage.setItem("hexSnakeBestTotalMs", String(Math.floor(bestTotalMs)));
      }
      updateHud();
      const winnerOwner = (!playerLost && computerLost) || (playerLost && computerLost && score > computerScore)
        ? "player"
        : (playerLost && !computerLost) || (playerLost && computerLost && computerScore > score)
          ? "computer"
          : null;
      const plainResultText = winnerOwner === "player" ? "P1 勝利" : winnerOwner === "computer" ? "P2 勝利" : "平手";
      const resultTitleHtml = winnerOwner === "player"
        ? `本局結果：<span class="owner-name is-p1">P1</span> 勝利`
        : winnerOwner === "computer"
          ? `本局結果：<span class="owner-name is-p2">P2</span> 勝利`
          : "本局結果：平手";
      const scoreText = `比分：P1 ${score}：${computerScore} P2`;
      const resultReason = playerLost && computerLost
        ? score === computerScore
          ? "雙方同時結束，分數相同。"
          : "雙方同時結束，以分數較高者勝出。"
        : winnerOwner === "player"
          ? "P2 淘汰，P1 獲勝。"
          : winnerOwner === "computer"
            ? "P1 淘汰，P2 獲勝。"
            : "雙方分數相同。";
      setStatus(`對戰結束：${plainResultText}`);
      overlayTitle.innerHTML = resultTitleHtml;
      HexSnakeAudio.playCharacter("player", winnerOwner === "player" ? "victory" : "defeat", { gainScale: winnerOwner ? 1 : 0.82 });
      HexSnakeAudio.playCharacter("computer", winnerOwner === "computer" ? "victory" : "defeat", { delay: winnerOwner ? 0.08 : 0.12, gainScale: winnerOwner ? 1 : 0.82 });
      gameOverResultOwner = winnerOwner;
      gameOverPlayerLost = playerLost;
      gameOverComputerLost = computerLost;
      showResultCallout("player", winnerOwner === "player" ? "victory" : "defeat");
      showResultCallout("computer", winnerOwner === "computer" ? "victory" : "defeat");
      if (shouldContinueRelay) {
        if (winnerOwner === "player") relayPlayerWins += 1;
        else if (winnerOwner === "computer") relayComputerWins += 1;
        else relayDraws += 1;
        updateRelayControls();
      }
      startButton.textContent = "重新開始";
      gameOverSettlementPending = true;
      gameOverRelayStartOptions = shouldContinueRelay ? nextRelayStartOptions : null;
      overlayText.textContent = shouldContinueRelay
        ? `${scoreText}。${resultReason} 接力賽：P1 ${relayPlayerWins} 勝，P2 ${relayComputerWins} 勝，平手 ${relayDraws}。`
        : `${scoreText}。${resultReason}`;
      overlayText.hidden = true;
      if (shouldUseGameOverLogo) {
        const winnerLabel = winnerOwner === "player" ? "P1" : winnerOwner === "computer" ? "P2" : null;
        const winnerCharacter = winnerOwner ? characterFor(winnerOwner) : null;
        const winnerMessage = winnerOwner
          ? `\u606d\u559c ${winnerLabel}\uff08${winnerCharacter?.name || "\u96a8\u6a5f\u9078\u64c7"}\uff09\u7372\u52dd`
          : "\u672c\u5c40\u5e73\u624b";
        showLogoTransition("in", { message: winnerMessage });
      }
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    }

    function loop(now) {
      if (!running) {
        const frameNow = now || performance.now();
        const visualsActive = gameOverSettlementPending && advanceGameOverVisuals(frameNow);
        draw();
        if (gameOverSettlementPending && gameOverLogoTransitionEndsAt) {
          if (frameNow < gameOverLogoTransitionEndsAt) {
            rafId = requestAnimationFrame(loop);
          } else {
            showGameOverSettlement();
          }
        } else if (visualsActive) {
          rafId = requestAnimationFrame(loop);
        } else if (gameOverSettlementPending) {
          showGameOverSettlement();
        }
        return;
      }
      if (!paused) {
        const delta = lastTimerFrame ? now - lastTimerFrame : 0;
        const timeScale = isPlayerAutoControlActive() ? computerBattleSpeed : 1;
        totalElapsedMs += delta * timeScale;
        lastFeedElapsedMs += delta * timeScale;
        lastTimerFrame = now;
        if (totalElapsedMs >= maxMatchMs) {
          totalElapsedMs = maxMatchMs;
          endGame(true, true);
          return;
        }
      } else {
        lastTimerFrame = now;
      }
      if (!paused) {
        refreshSandwormProtections(now);
        resolveProjectiles(now);
        resolveHazards(now);
        refreshSandwormProtections(now);
        updateAiVisibilityMemory(now);
      }
      if (running && !paused) {
        const playerDue = !isMovementStunned("player", now) && now - lastPlayerStep >= moveIntervalFor("player", now);
        const computerDue = !isMovementStunned("computer", now) && now - lastComputerStep >= moveIntervalFor("computer", now);
        if (playerDue && computerDue) {
          const playerDueAt = lastPlayerStep + moveIntervalFor("player", now);
          const computerDueAt = lastComputerStep + moveIntervalFor("computer", now);
          const headCollisionOrder = Math.abs(playerDueAt - computerDueAt) < 0.001
            ? "simultaneous"
            : playerDueAt < computerDueAt ? "playerFirst" : "computerFirst";
          step(headCollisionOrder, now);
          lastPlayerStep = now;
          lastComputerStep = now;
        } else if (playerDue) {
          stepPlayerOnly(now);
          lastPlayerStep = now;
        } else if (computerDue) {
          stepComputerOnly(now);
          lastComputerStep = now;
        }
      }
      blasts = blasts.filter(blast => now <= blast.endAt);
      hazards = hazards.filter(hazard => now <= hazard.endAt);
      updateHudThrottled(now);
      recordReplaySnapshotThrottled(now);
      updateAutoBattleControls();
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function pointerToDirection(event, rect) {
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(x, y);
      if (distance < Math.max(4, rect.width * 0.035)) return null;
      let bestDirection = 0;
      let bestDot = -Infinity;
      directions.forEach((_, direction) => {
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
      const rect = joyZone.contains(event.target) ? joyZone.getBoundingClientRect() : controlRow.getBoundingClientRect();
      return pointerToDirection(event, rect);
    }

    function beginControlPadAttackPointer(event) {
      if (isLogoTransitionActive()) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      if (!shouldUseControlPadAttackDirection()) return false;
      if (!running || gameOver) {
        if (!autoStartGame()) return true;
      }
      event.preventDefault();
      event.stopPropagation();
      const dirButton = event.target.closest("[data-dir-button]");
      const direction = dirButton ? Number(dirButton.dataset.dir) : controlPadDirectionFromEvent(event);
      controlAttackPointer = {
        pointerId: event.pointerId,
        direction: Number.isInteger(direction) ? direction : ownerDirection("player")
      };
      triggerTouchFeedback(event, 10);
      targetCell = directionalAttackTarget(controlAttackPointer.direction);
      targetActive = true;
      try {
        controlRow.setPointerCapture(event.pointerId);
      } catch (error) {
        // Window-level pointer listeners still finish the attack gesture.
      }
      requestPreviewDraw();
      return true;
    }

    function moveControlPadAttackPointer(event) {
      if (!controlAttackPointer || event.pointerId !== controlAttackPointer.pointerId) return;
      event.preventDefault();
      const direction = controlPadDirectionFromEvent(event);
      const previousDirection = controlAttackPointer.direction;
      if (direction !== null) controlAttackPointer.direction = direction;
      targetCell = directionalAttackTarget(controlAttackPointer.direction);
      targetActive = true;
      if (controlAttackPointer.direction !== previousDirection) triggerTouchFeedback(event, 5);
      requestPreviewDraw();
    }

    function finishControlPadAttackPointer(event) {
      if (!controlAttackPointer || event.pointerId !== controlAttackPointer.pointerId) return;
      event.preventDefault();
      const direction = controlAttackPointer.direction;
      controlAttackPointer = null;
      if (controlRow.hasPointerCapture?.(event.pointerId)) controlRow.releasePointerCapture(event.pointerId);
      triggerTouchFeedback(event, 6);
      launchPlayerAttackDirection(direction, "big");
    }

    function cancelControlPadAttackPointer(event) {
      if (!controlAttackPointer || event.pointerId !== controlAttackPointer.pointerId) return;
      controlAttackPointer = null;
      targetActive = false;
      if (controlRow.hasPointerCapture?.(event.pointerId)) controlRow.releasePointerCapture(event.pointerId);
      requestPreviewDraw();
    }

    function moveStick(event) {
      clearMoveStickRebound();
      const rect = joyZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const distance = Math.min(54, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      stick.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
      const newDir = pointerToDirection(event, rect);
      if (newDir !== null) {
        movePointerMoved = true;
        setDirection(newDir, { feedbackEvent: event, feedbackStrength: 5 });
      }
    }

    function setMoveStickLocked(locked) {
      moveStickLocked = locked;
      moveStickEngaged = locked;
      joyZone.querySelector(".joystick").classList.toggle("locked", locked);
      if (!locked) {
        movePointerId = null;
        moveStickEngaged = false;
        clearMoveStickRebound();
        stick.style.transform = "translate(0, 0)";
      }
    }

    function clearMoveStickHoldTimer() {
      if (!moveStickHoldTimer) return;
      clearTimeout(moveStickHoldTimer);
      moveStickHoldTimer = null;
    }

    function clearMoveStickRebound() {
      if (moveStickReboundTimer) {
        clearTimeout(moveStickReboundTimer);
        moveStickReboundTimer = null;
      }
      stick.classList.remove("is-rebounding");
    }

    function clearAttackPointerLongPressTimer() {
      if (!attackPointerLongPressTimer) return;
      clearTimeout(attackPointerLongPressTimer);
      attackPointerLongPressTimer = null;
    }

    function pointerNearMoveCenter(event) {
      const rect = joyZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return Math.hypot(event.clientX - cx, event.clientY - cy) < Math.min(46, rect.width * 0.36);
    }

    function engageMoveStick(event) {
      clearMoveStickHoldTimer();
      if (movePointerId !== event.pointerId || moveStickEngaged) return;
      moveStickEngaged = true;
      joyZone.querySelector(".joystick").classList.add("locked");
      moveStick(event);
    }

    function releaseMoveStick(event) {
      clearMoveStickHoldTimer();
      if (moveStickLocked) return;
      movePointerId = null;
      moveStickEngaged = false;
      joyZone.querySelector(".joystick").classList.remove("locked");
      setDirectionButtonHighlight(null);
      stick.classList.add("is-rebounding");
      stick.style.transform = "translate(0, 0)";
      if (moveStickReboundTimer) clearTimeout(moveStickReboundTimer);
      moveStickReboundTimer = setTimeout(() => {
        moveStickReboundTimer = null;
        stick.classList.remove("is-rebounding");
      }, 180);
    }

    function moveTargetStick(event) {
      if (HexSnakeReplay.isPlaybackMode()) return;
      if (isLogoTransitionActive()) return;
      if (!running || gameOver) {
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
      const playerPixel = axialToPixel(snake[0]);
      const maxPixelRange = targetMaxHex * cellSize;
      const ratio = Math.min(1, rawDistance / Math.max(1, rect.width * 0.44));
      const targetPixel = {
        x: playerPixel.x + Math.cos(angle) * maxPixelRange * ratio,
        y: playerPixel.y + Math.sin(angle) * maxPixelRange * ratio
      };
      targetCell = nearestInsideCell(pixelToAxial(targetPixel.x, targetPixel.y));
      targetActive = true;
      requestPreviewDraw();
    }

    function releaseTargetStick() {
      targetPointerId = null;
      targetStick.style.transform = "translate(0, 0)";
      if (targetActive && running && !paused && !gameOver) {
        if (launchAttack("player", targetCell || snake[0], performance.now())) {
          setStatus("P1 施放炸彈，2 秒後落地。");
        } else {
          setStatus(`大招需要 ${bigAttackBombCost} 枚炸彈，且四種庫存各至少 2。`);
        }
      }
      targetActive = false;
    }

    function opponentHeadTarget() {
      return computerSnake?.[0] || snake?.[0] || targetCell;
    }

    function opponentCentroidTarget() {
      if (!computerSnake?.length) return opponentHeadTarget();
      const average = computerSnake.reduce((total, segment) => ({
        q: total.q + segment.q / computerSnake.length,
        r: total.r + segment.r / computerSnake.length
      }), { q: 0, r: 0 });
      return nearestInsideCell(roundAxial(average.q, average.r));
    }

    function opponentNearestFoodTarget() {
      const head = opponentHeadTarget();
      if (!foods.length || !head) return head;
      return [...foods].sort((a, b) => hexDistance(head, a) - hexDistance(head, b))[0] || head;
    }

    function keyboardTargetMode(profile = "small") {
      const aim = keyboardAttackAim[profile] || keyboardAttackAim.small;
      return keyboardTargetModes[aim.targetModeIndex % keyboardTargetModes.length] || "head";
    }

    function keyboardAttackTarget(profile = "small") {
      if (keyboardAttackUsesDirection(profile)) return opponentHeadTarget();
      const mode = keyboardTargetMode(profile);
      if (mode === "centroid") return opponentCentroidTarget();
      if (mode === "food") return opponentNearestFoodTarget();
      return opponentHeadTarget();
    }

    function keyboardAttackUsesDirection(profile = "small") {
      return profile === "big" && bigAttackUsesDrawnDirection(characterFor("player").id);
    }

    function keyboardAttackDirection(profile = "big") {
      const aim = keyboardAttackAim[profile] || keyboardAttackAim.big;
      return Number.isInteger(aim.direction) ? aim.direction : ownerDirection("player");
    }

    function keyboardAttackOptions(profile = "small", target = null) {
      if (!keyboardAttackUsesDirection(profile) || !snake?.length) return {};
      const character = characterFor("player");
      const direction = keyboardAttackDirection(profile);
      return {
        aimDirection: direction,
        aimOrigin: character.id === "moray" ? (target || opponentHeadTarget()) : snake[0]
      };
    }

    function clearKeyboardAttackPreviewTimer() {
      if (!keyboardAttackPreviewTimer) return;
      clearTimeout(keyboardAttackPreviewTimer);
      keyboardAttackPreviewTimer = null;
    }

    function keyboardAttackHintLabel(profile = "small") {
      if (keyboardAttackUsesDirection(profile)) {
        const direction = directions[keyboardAttackDirection(profile)];
        return direction ? direction.label : "目前方向";
      }
      return keyboardTargetModeLabels[keyboardTargetMode(profile)] || "目標頭部";
    }

    function currentKeyboardAimProfile() {
      return selectedAttackProfile === "big" ? "big" : "small";
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
      updateTargetModeIndicatorFor("small", targetModeSmallIndicator, targetModeSmallIcon);
      updateTargetModeIndicatorFor("big", targetModeBigIndicator, targetModeBigIcon);
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
        preview.origin = characterFor("player").id === "moray" ? target : snake?.[0];
      }
      keyboardAttackPreview = preview;
      targetCell = target;
      targetActive = Boolean(target);
      selectedAttackProfile = profile;
      updateTargetModeIndicator();
      requestPreviewDraw();
      clearKeyboardAttackPreviewTimer();
      keyboardAttackPreviewTimer = setTimeout(() => {
        keyboardAttackPreviewTimer = null;
        if (keyboardAttackPreview === preview) keyboardAttackPreview = null;
        targetActive = false;
        requestPreviewDraw();
      }, 900);
      setStatus(`${profile === "big" ? "大招" : "小招"}按鍵目標：${keyboardAttackHintLabel(profile)}`);
    }

    function cycleKeyboardAttackAim(profile = "small") {
      if (!running || gameOver) {
        if (!autoStartGame()) return false;
      }
      const aim = keyboardAttackAim[profile] || keyboardAttackAim.small;
      if (keyboardAttackUsesDirection(profile)) {
        aim.direction = (keyboardAttackDirection(profile) + 1) % directions.length;
      } else {
        aim.targetModeIndex = (aim.targetModeIndex + 1) % keyboardTargetModes.length;
      }
      keyboardAttackAim[profile] = aim;
      selectedAttackProfile = profile;
      showKeyboardAttackHint(profile);
      return true;
    }

    function handleKeyboardAimKeyDown(event, profile = "small", key = "") {
      event.preventDefault();
      if (event.repeat) return true;
      if (keyboardAimHeldKeys.has(key)) {
        keyboardAimHeldKeys.delete(key);
        setAttackButtonHighlight(null);
      }
      keyboardAimHeldKeys.add(key);
      setAttackButtonHighlight(profile === "big" ? "bigAim" : "smallAim");
      triggerTouchFeedback(event, profile === "big" ? 12 : 8);
      cycleKeyboardAttackAim(profile);
      return true;
    }

    function handleKeyboardAimKeyUp(event, key = "") {
      if (!keyboardAimHeldKeys.has(key)) return false;
      event.preventDefault();
      keyboardAimHeldKeys.delete(key);
      releaseAttackButtonHighlight();
      triggerTouchFeedback(event, 5);
      return true;
    }

    function clearKeyboardAimKeyLocks() {
      if (!keyboardAimHeldKeys.size) return;
      keyboardAimHeldKeys.clear();
      setAttackButtonHighlight(null);
    }

    function launchKeyboardPlayerAttack(profile = "small") {
      const target = keyboardAttackTarget(profile);
      return launchPlayerAttack(target, profile, keyboardAttackOptions(profile, target));
    }

    function remindKeyboardAttackTarget(profile = currentKeyboardAimProfile(), event = null) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const indicator = profile === "big" ? targetModeBigIndicator : targetModeSmallIndicator;
      indicator.classList.add("is-active");
      triggerTouchFeedback(event, profile === "big" ? 12 : 8);
      showKeyboardAttackHint(profile);
      setTimeout(() => indicator.classList.remove("is-active"), 140);
    }

    function playerDirectAttackTarget(profile = "small", pointer = null) {
      const character = characterFor("player");
      if (profile === "big" && pointer && character.id === "moray") {
        return pointer.currentCell || pointer.startCell || opponentHeadTarget();
      }
      if (profile === "big" && pointer && !bigAttackUsesDrawnDirection(character.id)) {
        return pointer.currentCell || pointer.startCell || opponentHeadTarget();
      }
      return opponentHeadTarget();
    }

    function playerGestureAttackDirection(pointer, fallbackTarget) {
      if (pointer?.moved) {
        return directionFromSourceToTarget(pointer.startCell, pointer.currentCell, directionFromSourceToTarget(snake[0], fallbackTarget, ownerDirection("player")));
      }
      return directionFromSourceToTarget(snake[0], fallbackTarget, ownerDirection("player"));
    }

    function playerDirectAttackOptions(profile = "small", pointer = null) {
      const target = playerDirectAttackTarget(profile, pointer);
      const character = characterFor("player");
      if (profile === "big" && bigAttackUsesDrawnDirection(character.id) && snake?.length) {
        return {
          aimDirection: playerGestureAttackDirection(pointer, target),
          aimOrigin: character.id === "moray" && pointer?.moved ? target : snake[0]
        };
      }
      return {};
    }

    function previewDirectAttack(profile = "small", pointer = null) {
      selectedAttackProfile = profile === "big" ? "big" : "small";
      targetCell = playerDirectAttackTarget(profile, pointer);
      targetActive = Boolean(targetCell);
      requestPreviewDraw();
    }

    function launchDirectPlayerAttack(profile = "small", pointer = null) {
      const target = playerDirectAttackTarget(profile, pointer);
      return launchPlayerAttack(target, profile, playerDirectAttackOptions(profile, pointer));
    }

    function playerAttackFailureReason(target, profile = selectedAttackProfile, now = performance.now()) {
      const moveName = profile === "small" ? characterFor("player").smallMove : characterFor("player").bigMove;
      if (HexSnakeReplay.isPlaybackMode()) return "正在播放重播，不能施放招式。";
      if (!running || gameOver) return "尚未開局；開始後再點棋盤可施放招式。";
      if (paused) return "遊戲暫停中，請先繼續再施放招式。";
      if (!target || !snake?.length) return `${moveName} 施放失敗：沒有有效目標格。`;

      const stock = playerStock;
      const foodCost = attackFoodCost(profile);
      if (profile === "small") {
        const highestType = highestStockFoodType(stock);
        const highestCount = highestType ? stock[highestType.id] || 0 : 0;
        if (highestCount < foodCost) return `${moveName} 施放失敗：最高庫存不足，需要任一食物庫存至少 ${foodCost}。`;
      } else {
        const missingFood = foodTypes
          .filter(type => stock[type.id] < foodCost)
          .map(type => type.label)
          .join("、");
        if (missingFood) return `${moveName} 施放失敗：${missingFood}庫存不足，需要四種庫存各 ${foodCost}。`;
      }

      const bombCost = attackBombCost(profile);
      if (ammoFor("player") < bombCost) return `${moveName} 施放失敗：炸彈不足，需要 ${bombCost} 枚，目前 ${ammoFor("player")} 枚。`;

      const remainingMs = attackCooldownRemainingMs("player", profile, now);
      if (remainingMs > 0) return `${moveName} 施放失敗：冷卻中，還需 ${(remainingMs / 1000).toFixed(1)} 秒。`;

      return `${moveName} 施放失敗：目前條件不允許施放。`;
    }

    function launchPlayerAttack(target, profile = selectedAttackProfile, options = {}) {
      if (HexSnakeReplay.isPlaybackMode()) {
        setStatus(playerAttackFailureReason(target, profile));
        return false;
      }
      if (!running || gameOver) {
        if (!autoStartGame()) {
          setStatus(playerAttackFailureReason(target, profile));
          return false;
        }
      }
      if (paused) {
        setStatus(playerAttackFailureReason(target, profile));
        return false;
      }
      const now = performance.now();
      if (launchAttack("player", target, now, profile, options)) {
        keyboardAttackPreview = null;
        clearKeyboardAttackPreviewTimer();
        targetCell = { ...target };
        targetActive = true;
        flashAttackButton(profile);
        draw();
        setTimeout(() => {
          targetActive = false;
          draw();
        }, 180);
        const moveName = profile === "small" ? characterFor("player").smallMove : characterFor("player").bigMove;
        setStatus(`${moveName} 發動。`);
        return true;
      }
      setStatus(playerAttackFailureReason(target, profile, now));
      return false;
    }

    function launchPlayerAttackDirection(direction, profile = selectedAttackProfile) {
      if (!running || gameOver) {
        if (!autoStartGame()) return false;
      }
      return launchPlayerAttack(opponentHeadTarget(), profile, { aimDirection: direction, aimOrigin: snake[0] });
    }

    function performModuleAttack() {
      const module = characterStage.querySelector('[data-module="player"]');
      if (module) module.classList.remove("is-charging");
      launchPlayerAttack(targetCell || snake[0]);
    }

    function clearModuleHold() {
      clearTimeout(moduleHoldTimer);
      moduleHoldTimer = null;
      const module = characterStage.querySelector('[data-module="player"]');
      if (module) module.classList.remove("is-charging");
    }

    function togglePause() {
      if (HexSnakeReplay.isPlaybackMode()) return;
      if (!running || gameOver) {
        beginStartLogoCountdown();
        return;
      }
      paused = !paused;
      setStatus(paused ? "已暫停" : "對戰中：吃食物累積能量，集滿可獲得炸彈。");
      overlayTitle.textContent = "暫停";
      overlayText.textContent = "按開始或快捷鍵繼續。";
      startButton.textContent = "繼續";
      setOverlayChromeVisible(true);
      overlay.classList.toggle("show", paused);
      if (!paused) {
        lastPlayerStep = performance.now();
        lastComputerStep = lastPlayerStep;
        lastTimerFrame = lastPlayerStep;
      }
      updateAutoBattleControls();
    }

    function surrenderGame() {
      if (HexSnakeReplay.isPlaybackMode()) return;
      if (!running || gameOver) {
        if (computerBattleMode && relayMode) {
          setRelayMode(false, false, false);
          setStatus("接力賽已停止。");
        }
        return;
      }
      setStatus("你已投降。");
      setRelayMode(false, false, false);
      HexSnakeReplay.markSurrendered();
      endGame(true, false);
    }

    function boardCellFromPointer(event) {
      const rect = canvas.getBoundingClientRect();
      return nearestInsideCell(pixelToAxial(event.clientX - rect.left, event.clientY - rect.top));
    }

    function beginBoardAttackPointer(event) {
      if (HexSnakeReplay.isPlaybackMode()) return;
      if (event.target !== canvas) return;
      event.preventDefault();
      const cell = boardCellFromPointer(event);
      attackPointer = {
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
      previewDirectAttack("small", attackPointer);
      clearAttackPointerLongPressTimer();
      attackPointerLongPressTimer = setTimeout(() => {
        if (!attackPointer || attackPointer.pointerId !== event.pointerId) return;
        attackPointer.longPressed = true;
        attackPointer.previewProfile = "big";
        previewDirectAttack("big", attackPointer);
      }, 460);
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // Pointer capture is a convenience; window-level listeners still finish the drag.
      }
      requestPreviewDraw();
    }

    function moveBoardAttackPointer(event) {
      if (!attackPointer || event.pointerId !== attackPointer.pointerId) return;
      event.preventDefault();
      const cell = boardCellFromPointer(event);
      attackPointer.currentCell = { ...cell };
      const dragDistance = Math.hypot(event.clientX - attackPointer.startX, event.clientY - attackPointer.startY);
      attackPointer.moved = attackPointer.moved || dragDistance > Math.max(8, cellSize * 0.28) || keyOf(cell) !== keyOf(attackPointer.startCell);
      if (attackPointer.moved) {
        clearAttackPointerLongPressTimer();
        attackPointer.previewProfile = "big";
        previewDirectAttack("big", attackPointer);
        return;
      }
      previewDirectAttack(attackPointer.previewProfile, attackPointer);
      requestPreviewDraw();
    }

    function finishBoardAttackPointer(event) {
      if (!attackPointer || event.pointerId !== attackPointer.pointerId) return;
      event.preventDefault();
      const pointer = attackPointer;
      pointer.currentCell = boardCellFromPointer(event);
      attackPointer = null;
      clearAttackPointerLongPressTimer();
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      const heldLongEnough = performance.now() - pointer.startedAt >= 460;
      const profile = pointer.moved || pointer.longPressed || heldLongEnough ? "big" : "small";
      launchDirectPlayerAttack(profile, pointer);
    }

    function cancelBoardAttackPointer(event) {
      if (!attackPointer || event.pointerId !== attackPointer.pointerId) return;
      attackPointer = null;
      clearAttackPointerLongPressTimer();
      targetActive = false;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      requestPreviewDraw();
    }

    function setSettingsOpen(open) {
      settingsToggle.setAttribute("aria-expanded", String(open));
      settingsContent.hidden = !open;
      if (!open) setPendingDirectionKeybind(null);
      if (open && !rulesModal.hidden) {
        rulesModal.hidden = true;
        rulesButton.setAttribute("aria-expanded", "false");
      }
      if (open) setGmOpen(false);
      if (open) settingsCloseButton.focus();
      settingsToggle.closest(".settings-section").classList.toggle("open", open || !gmContent.hidden);
    }

    function toggleSettings() {
      if (settingsToggle.disabled || running) return;
      setSettingsOpen(settingsToggle.getAttribute("aria-expanded") !== "true");
    }

    function setGmOpen(open) {
      gmToggle.setAttribute("aria-expanded", String(open));
      gmContent.hidden = !open;
      if (open && !running) {
        if (!rulesModal.hidden) {
          rulesModal.hidden = true;
          rulesButton.setAttribute("aria-expanded", "false");
        }
        setGmMode(true);
        saveGmSettings();
      }
      if (open) setSettingsOpen(false);
      if (open) gmCloseButton.focus();
      gmToggle.closest(".settings-section").classList.toggle("open", open || !settingsContent.hidden);
    }

    function toggleGmSettings() {
      if (running && !gameOver && !HexSnakeReplay.isPlaybackMode()) {
        if (computerBattleMode) setComputerBattleManualOverride(!computerBattleManualOverride);
        else setPlayerAutoMode(!playerAutoMode);
        return;
      }
      if (gmToggle.disabled || running) return;
      setGmOpen(gmToggle.getAttribute("aria-expanded") !== "true");
    }

    document.addEventListener("pointerdown", HexSnakeAudio.unlock, { once: true, passive: true });
    document.addEventListener("keydown", HexSnakeAudio.unlock, { once: true });

    settingsToggle.addEventListener("click", toggleSettings);
    gmToggle.addEventListener("click", toggleGmSettings);
    settingsCloseButton.addEventListener("click", () => setSettingsOpen(false));
    gmCloseButton.addEventListener("click", () => setGmOpen(false));

    settingsToggle.addEventListener("pointerdown", event => {
      event.stopPropagation();
    });

    gmToggle.addEventListener("pointerdown", event => {
      event.stopPropagation();
    });

    settingsContent.addEventListener("pointerdown", event => {
      if (event.target === settingsContent) {
        setSettingsOpen(false);
        return;
      }
      event.stopPropagation();
    });

    gmContent.addEventListener("pointerdown", event => {
      if (event.target === gmContent) {
        setGmOpen(false);
        return;
      }
      event.stopPropagation();
    });

    characterStage.addEventListener("pointerdown", event => {
      if (HexSnakeReplay.isPlaybackMode()) return;
      const module = event.target.closest('[data-module="player"]');
      if (!module) return;
      event.preventDefault();
    });

    characterStage.addEventListener("pointerup", clearModuleHold);
    characterStage.addEventListener("pointercancel", clearModuleHold);
    characterStage.addEventListener("pointerleave", clearModuleHold);

    winnerPortrait.addEventListener("pointerdown", event => {
      const swipeZone = event.target.closest("[data-portrait-swipe-owner]");
      if (swipeZone && (event.target.closest("[data-portrait-select]") || event.target.closest(".intro-avatar-gate"))) {
        portraitSwipeStartX = event.clientX;
        portraitSwipeStartY = event.clientY;
        portraitSwipeOwner = swipeZone.dataset.portraitSwipeOwner === "computer" ? "computer" : "player";
        portraitIntroDidSwipe = false;
        return;
      }
      if (event.target.closest(".portrait-copy") && event.target.closest("[data-portrait-select]")) {
        portraitInfoSwipeStartX = event.clientX;
        portraitInfoSwipeStartY = event.clientY;
        portraitIntroDidSwipe = false;
      }
    });

    winnerPortrait.addEventListener("click", event => {
      if (portraitIntroDidSwipe) {
        portraitIntroDidSwipe = false;
        return;
      }
      const portraitShift = event.target.closest("[data-portrait-shift][data-portrait-owner]");
      if (portraitShift) {
        applyPortraitCharacter(portraitShift.dataset.portraitOwner, Number(portraitShift.dataset.portraitShift));
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
        if (owner !== selectedPortraitOwner) {
          selectPortraitOwner(owner);
          return;
        }
        openPortraitLightbox(owner);
        return;
      }
      const portraitOption = event.target.closest("[data-portrait-owner]");
      if (portraitOption) {
        selectPortraitOwner(portraitOption.dataset.portraitOwner === "computer" ? "computer" : "player");
        return;
      }
      const introButton = event.target.closest("[data-open-intro]");
      if (!introButton) return;
      selectedPortraitOwner = introButton.dataset.openIntro === "computer" ? "computer" : "player";
      overlayTitle.textContent = "角色選擇";
      overlayText.textContent = "點擊 P1 或 P2 立繪選擇要調整的角色，使用左右箭頭切換。";
      startButton.textContent = "開始";
      renderIntroPortraits(true);
    });

    winnerPortrait.addEventListener("pointerup", event => {
      if (portraitSwipeStartX !== null) {
        const deltaX = event.clientX - portraitSwipeStartX;
        const deltaY = event.clientY - portraitSwipeStartY;
        const owner = portraitSwipeOwner;
        portraitSwipeStartX = null;
        portraitSwipeStartY = null;
        portraitSwipeOwner = null;
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) >= 42) {
          portraitIntroDidSwipe = true;
          setTimeout(() => {
            portraitIntroDidSwipe = false;
          }, 160);
          shiftPortraitVariantMode(deltaY < 0 ? -1 : 1);
          return;
        }
        if (Math.abs(deltaX) < 42) return;
        portraitIntroDidSwipe = true;
        setTimeout(() => {
          portraitIntroDidSwipe = false;
        }, 160);
        applyPortraitCharacter(owner, deltaX < 0 ? 1 : -1);
        return;
      }
      if (portraitInfoSwipeStartX !== null) {
        const deltaX = event.clientX - portraitInfoSwipeStartX;
        const deltaY = event.clientY - portraitInfoSwipeStartY;
        portraitInfoSwipeStartX = null;
        portraitInfoSwipeStartY = null;
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) >= 42) {
          portraitIntroDidSwipe = true;
          setTimeout(() => {
            portraitIntroDidSwipe = false;
          }, 160);
          shiftPortraitVariantMode(deltaY < 0 ? -1 : 1);
          return;
        }
        if (Math.abs(deltaX) < 42) return;
        portraitIntroDidSwipe = true;
        setTimeout(() => {
          portraitIntroDidSwipe = false;
        }, 160);
        applyPortraitCharacter(selectedPortraitOwner, deltaX < 0 ? 1 : -1);
      }
    });

    winnerPortrait.addEventListener("pointercancel", () => {
      portraitSwipeStartX = null;
      portraitSwipeStartY = null;
      portraitSwipeOwner = null;
      portraitInfoSwipeStartX = null;
      portraitInfoSwipeStartY = null;
    });

    portraitLightboxClose.addEventListener("click", closePortraitLightbox);

    portraitLightboxShiftButtons.forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        shiftPortraitLightbox(Number(button.dataset.portraitLightboxShift));
      });
    });

    portraitLightboxVariantButtons.forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        shiftPortraitVariantMode(button.dataset.portraitLightboxDirection === "up" ? -1 : 1);
      });
    });

    portraitLightbox.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      portraitSwipeStartX = event.clientX;
      portraitSwipeStartY = event.clientY;
      portraitLightboxDidSwipe = false;
    });

    portraitLightbox.addEventListener("pointerup", event => {
      if (portraitSwipeStartX === null) return;
      const deltaX = event.clientX - portraitSwipeStartX;
      const deltaY = event.clientY - portraitSwipeStartY;
      portraitSwipeStartX = null;
      portraitSwipeStartY = null;
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) >= 42) {
        portraitLightboxDidSwipe = true;
        shiftPortraitVariantMode(deltaY < 0 ? -1 : 1);
        return;
      }
      if (Math.abs(deltaX) < 42) return;
      portraitLightboxDidSwipe = true;
      shiftPortraitLightbox(deltaX < 0 ? 1 : -1);
    });

    portraitLightbox.addEventListener("pointercancel", () => {
      portraitSwipeStartX = null;
      portraitSwipeStartY = null;
    });

    portraitLightbox.addEventListener("click", event => {
      if (portraitLightboxDidSwipe) {
        portraitLightboxDidSwipe = false;
        return;
      }
      if (event.target === portraitLightbox) closePortraitLightbox();
    });

    gridSizeInput.addEventListener("change", () => {
      if (running) return;
      setGridSize(gridSizeInput.value);
      applyGmSettingsChanged();
      cancelAnimationFrame(rafId);
      resetGame();
      resize();
      overlayTitle.textContent = "棋盤已更新";
      overlayText.textContent = `棋盤半徑已設為 ${gridSize}。開始後設定會鎖定到下一局。`;
      startButton.textContent = "開始";
      renderIntroPortraits(true);
      overlay.classList.add("show");
    });

    foodCountInput.addEventListener("change", () => {
      if (running) return;
      setFoodCount(foodCountInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
      overlayTitle.textContent = "食物數量已更新";
      overlayText.textContent = `場上會維持 ${foodCount} 個蛋白、脂肪、纖維、碳水隨機食物。`;
      startButton.textContent = "開始";
      renderIntroPortraits(true);
      overlay.classList.add("show");
    });

    computerDifficultyInput.addEventListener("change", () => {
      if (running) return;
      setComputerDifficulty(computerDifficultyInput.value);
      saveGmSettings();
      resetGame();
      resize();
      overlayTitle.textContent = "難度已更新";
      overlayText.textContent = `電腦難度設為 ${computerDifficultyInput.selectedOptions[0].textContent}。`;
      startButton.textContent = "開始";
      renderIntroPortraits(true);
      overlay.classList.add("show");
    });

    initialSpeedInput.addEventListener("change", () => {
      if (running) return;
      setInitialSpeed(initialSpeedInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
      overlayTitle.textContent = "初始速度已更新";
      overlayText.textContent = `初始速度已設為 ${initialSpeed}x。`;
      startButton.textContent = "開始";
      renderIntroPortraits(true);
      overlay.classList.add("show");
    });

    initialLengthInput.addEventListener("change", () => {
      if (running) return;
      setInitialLength(initialLengthInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
    });

    initialEnergyInput.addEventListener("change", () => {
      if (running) return;
      setInitialEnergy(initialEnergyInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
    });

    initialBombsInput.addEventListener("change", () => {
      if (running) return;
      setInitialBombs(initialBombsInput.value);
      applyGmSettingsChanged();
      resetGame();
      resize();
    });

    initialStockInputs.forEach(input => {
      input.addEventListener("change", () => {
        if (running) return;
        setInitialStock(input.dataset.initialStock, input.value);
        applyGmSettingsChanged();
        resetGame();
        resize();
      });
    });

    [playerCharacterInput, computerCharacterInput].forEach(input => {
      input.addEventListener("change", () => {
        if (running) return;
        const changedOwner = input === computerCharacterInput ? "computer" : "player";
        playerCharacterChoice = playerCharacterInput.value === randomCharacterChoiceId || characterById.has(playerCharacterInput.value) ? playerCharacterInput.value : defaultSettings.playerCharacterId;
        computerCharacterChoice = computerCharacterInput.value === randomCharacterChoiceId || characterById.has(computerCharacterInput.value) ? computerCharacterInput.value : defaultSettings.computerCharacterId;
        if (characterById.has(playerCharacterChoice)) playerCharacterId = playerCharacterChoice;
        if (characterById.has(computerCharacterChoice)) computerCharacterId = computerCharacterChoice;
        syncCharacterInputs();
        saveCharacterChoices();
        preloadPortraitsFor("player");
        preloadPortraitsFor("computer");
        buildCharacterStage();
        resetGame();
        resize();
        overlayTitle.textContent = "角色已更新";
        overlayText.textContent = `P1 選擇 ${selectedCharacterFor("player")?.name || "隨機選擇"}，P2 選擇 ${selectedCharacterFor("computer")?.name || "隨機選擇"}。`;
        startButton.textContent = "開始";
        renderIntroPortraits(true);
        overlay.classList.add("show");
        const selectedId = changedOwner === "computer" ? computerCharacterChoice : playerCharacterChoice;
        if (characterById.has(selectedId)) {
          HexSnakeAudio.playCharacter(changedOwner, "select", { character: characterById.get(selectedId), unlock: true });
        }
      });
    });

    resetBestTimeButton.addEventListener("click", () => {
      bestTotalMs = 0;
      localStorage.setItem("hexSnakeBestTotalMs", "0");
      updateHud();
    });

    realModeButton.addEventListener("click", () => {
      if (running) return;
      setGmMode(true);
      resetGmParameters();
      applyGmSettingsChanged({ presetMode: "real" });
      refreshGmPreview();
    });

    midGameModeButton.addEventListener("click", () => {
      if (running) return;
      applyMidGameModePreset();
      applyGmSettingsChanged({ presetMode: "mid" });
      refreshGmPreview();
    });

    ultimateModeButton.addEventListener("click", () => {
      if (running) return;
      applyUltimateModePreset();
      applyGmSettingsChanged({ presetMode: "battle" });
      refreshGmPreview();
    });

    lateGameModeButton.addEventListener("click", () => {
      if (running) return;
      applyLateGameModePreset();
      applyGmSettingsChanged({ presetMode: "late" });
      refreshGmPreview();
    });

    resetSettingsButton.addEventListener("click", () => {
      if (running) return;
      setComputerDifficulty(defaultSettings.computerDifficulty);
      setGmMode(defaultSettings.gmMode);
      resetGmParameters();
      applyGmSettingsChanged({ presetMode: "real" });
      playerCharacterId = defaultSettings.playerCharacterId;
      computerCharacterId = defaultSettings.computerCharacterId;
      playerCharacterChoice = playerCharacterId;
      computerCharacterChoice = computerCharacterId;
      syncCharacterInputs();
      saveCharacterChoices();
      keybinds = structuredClone(defaultKeybinds);
      saveKeybinds();
      applyKeybinds();
      setLeftHandMode(false);
      HexSnakeAudio.setMuted(false);
      resetGame();
      resize();
      overlayTitle.textContent = "已回到預設值";
      overlayText.textContent = "一般設定已恢復預設，GM 設定維持不變。";
      startButton.textContent = "開始";
      renderIntroPortraits(true);
      overlay.classList.add("show");
    });

    function defaultPlayerAttackTarget() {
      return targetCell || computerSnake[0] || snake[0];
    }

    function attackButtonPointerTarget(profile) {
      if (profile === "big" && bigAttackUsesDrawnDirection(characterFor("player").id)) {
        return directionalAttackTarget(ownerDirection("player"));
      }
      return defaultPlayerAttackTarget();
    }

    function attackButtonPointerOptions(profile) {
      if (profile === "big" && bigAttackUsesDrawnDirection(characterFor("player").id)) {
        return { aimDirection: ownerDirection("player"), aimOrigin: snake[0] };
      }
      return {};
    }

    function handleAttackButtonDown(event, profile) {
      event.preventDefault();
      event.stopPropagation();
      if (isLogoTransitionActive()) return;
      attackButtonPointerId = event.pointerId;
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
      if (isLogoTransitionActive()) return;
      if (attackButtonPointerId !== null && event.pointerId !== attackButtonPointerId) return;
      attackButtonPointerId = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      releaseAttackButtonHighlight();
      triggerTouchFeedback(event, 5);
      launchDirectPlayerAttack(profile);
    }

    function handleAttackButtonCancel(event) {
      if (attackButtonPointerId !== null && event.pointerId !== attackButtonPointerId) return;
      attackButtonPointerId = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setAttackButtonHighlight(null);
    }

    function handleKeyboardAimButtonDown(event, profile) {
      event.preventDefault();
      event.stopPropagation();
      if (isLogoTransitionActive()) return;
      attackButtonPointerId = event.pointerId;
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
      if (attackButtonPointerId !== null && event.pointerId !== attackButtonPointerId) return;
      attackButtonPointerId = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      handleKeyboardAimKeyUp(event, `button-${profile}`);
    }

    function handleKeyboardAimButtonCancel(event) {
      if (attackButtonPointerId !== null && event.pointerId !== attackButtonPointerId) return;
      attackButtonPointerId = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      clearKeyboardAimKeyLocks();
    }

    smallAttackButton.addEventListener("pointerdown", event => handleAttackButtonDown(event, "small"));
    bigAttackButton.addEventListener("pointerdown", event => handleAttackButtonDown(event, "big"));
    keyboardSmallAimButton.addEventListener("pointerdown", event => handleKeyboardAimButtonDown(event, "small"));
    keyboardBigAimButton.addEventListener("pointerdown", event => handleKeyboardAimButtonDown(event, "big"));
    smallAttackButton.addEventListener("pointerup", event => handleAttackButtonUp(event, "small"));
    bigAttackButton.addEventListener("pointerup", event => handleAttackButtonUp(event, "big"));
    keyboardSmallAimButton.addEventListener("pointerup", event => handleKeyboardAimButtonUp(event, "small"));
    keyboardBigAimButton.addEventListener("pointerup", event => handleKeyboardAimButtonUp(event, "big"));
    smallAttackButton.addEventListener("pointercancel", handleAttackButtonCancel);
    bigAttackButton.addEventListener("pointercancel", handleAttackButtonCancel);
    keyboardSmallAimButton.addEventListener("pointercancel", handleKeyboardAimButtonCancel);
    keyboardBigAimButton.addEventListener("pointercancel", handleKeyboardAimButtonCancel);
    smallAttackButton.addEventListener("click", event => event.preventDefault());
    bigAttackButton.addEventListener("click", event => event.preventDefault());
    keyboardSmallAimButton.addEventListener("click", event => event.preventDefault());
    keyboardBigAimButton.addEventListener("click", event => event.preventDefault());
    targetModeSmallIndicator.addEventListener("pointerdown", event => remindKeyboardAttackTarget("small", event));
    targetModeBigIndicator.addEventListener("pointerdown", event => remindKeyboardAttackTarget("big", event));
    targetModeSmallIndicator.addEventListener("click", event => event.preventDefault());
    targetModeBigIndicator.addEventListener("click", event => event.preventDefault());
    controlRow.addEventListener("pointerdown", event => {
      if (joyZone.contains(event.target)) return;
      if (event.target.closest("#bigAttackButton")) previewDirectAttack("big");
    });
    leftHandModeInput.addEventListener("change", () => setLeftHandMode(leftHandModeInput.checked));
    sfxMuteToggle.addEventListener("change", () => HexSnakeAudio.setMuted(sfxMuteToggle.checked));
    surrenderButton.addEventListener("click", surrenderGame);
    rulesButton.addEventListener("click", openRulesModal);
    rulesCloseButton.addEventListener("click", closeRulesModal);
    rulesContent.addEventListener("click", event => {
      if (event.target.closest("[data-open-tutorial]")) showTutorial(0);
    });
    rulesContent.addEventListener("keydown", event => {
      const tutorialCard = event.target.closest("[data-open-tutorial]");
      if (!tutorialCard || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      showTutorial(0);
    });
    replayArchiveButton.addEventListener("click", HexSnakeReplay.openModal);
    settingsReplayButton.addEventListener("click", HexSnakeReplay.openModal);
    replayModalClose.addEventListener("click", HexSnakeReplay.closeModal);
    replayModal.addEventListener("pointerdown", event => {
      if (event.target === replayModal) HexSnakeReplay.closeModal();
    });
    replayModal.querySelector(".replay-dialog").addEventListener("pointerdown", event => event.stopPropagation());
    replayModal.addEventListener("click", event => {
      const playButton = event.target.closest("[data-replay-play]");
      const favoriteButton = event.target.closest("[data-replay-favorite]");
      const deleteButton = event.target.closest("[data-replay-delete]");
      if (playButton) {
        const record = HexSnakeReplay.findRecord(playButton.dataset.replayPlay);
        if (record) HexSnakeReplay.startPlayback(record);
        return;
      }
      if (favoriteButton) {
        HexSnakeReplay.toggleFavorite(favoriteButton.dataset.replayFavorite);
        return;
      }
      if (deleteButton) {
        HexSnakeReplay.deleteRecord(deleteButton.dataset.replayDelete, deleteButton.dataset.replaySection);
      }
    });
    replayPlayButton.addEventListener("click", () => {
      HexSnakeReplay.togglePlaybackPaused();
    });
    replayReverseButton.addEventListener("click", () => {
      HexSnakeReplay.reversePlayback();
    });
    replayPrevButton.addEventListener("click", () => {
      HexSnakeReplay.switchPlayback(-1);
    });
    replayNextButton.addEventListener("click", () => {
      HexSnakeReplay.switchPlayback(1);
    });
    replaySpeedSelect.addEventListener("change", () => {
      HexSnakeReplay.setPlaybackSpeed(replaySpeedSelect.value);
    });
    replayTimeline.addEventListener("input", () => {
      HexSnakeReplay.seekPlayback(replayTimeline.value);
    });
    replayExitButton.addEventListener("click", HexSnakeReplay.exitPlayback);
    rulesModal.addEventListener("pointerdown", event => {
      if (event.target === rulesModal) closeRulesModal();
    });
    rulesModal.querySelector(".rules-dialog").addEventListener("pointerdown", event => event.stopPropagation());

    keybindInputs.forEach(input => {
      input.addEventListener("keydown", event => {
        event.preventDefault();
        const value = event.key === " " ? " " : event.key;
        input.value = keyLabel(normalizeKey(value, input.value));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      input.addEventListener("change", () => {
        const normalized = normalizeKey(input.value, " ");
        if (input.id === "smallAttackKey") keybinds.smallAttack = normalized;
        else if (input.id === "bigAttackKey") keybinds.bigAttack = normalized;
        else if (input.id === "pauseKey") keybinds.pause = normalized;
        else if (input.id === "surrenderKey") keybinds.surrender = normalized;
        else if (input.dataset.keybindDir !== undefined) keybinds.directions[Number(input.dataset.keybindDir)] = normalized;
        saveKeybinds();
        applyKeybinds();
      });
    });

    settingsDirButtons.forEach(button => {
      button.addEventListener("click", () => {
        setPendingDirectionKeybind(Number(button.dataset.dir));
        button.focus();
      });
    });

    introCloseButton.addEventListener("click", () => {
      renderIntroPortraits(false);
      overlay.classList.add("show");
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

    winnerPortrait.addEventListener("click", event => {
      if (tutorialSwipeDidMove) {
        tutorialSwipeDidMove = false;
        event.preventDefault();
        return;
      }
      const button = tutorialActionButtonFromEvent(event);
      if (!button) return;
      const action = button.dataset.tutorialAction;
      if (action === "next") {
        moveTutorial(1);
      } else if (action === "prev") {
        moveTutorial(-1);
      } else if (action === "skip" || action === "done") {
        finishTutorial(true);
      }
    });

    overlay.addEventListener("pointerdown", event => {
      if (!isTutorialOpen() || event.button > 0) return;
      if (tutorialActionButtonFromEvent(event)) return;
      tutorialSwipeStartX = event.clientX;
      tutorialSwipeStartY = event.clientY;
      tutorialSwipePointerId = event.pointerId;
      tutorialSwipeDidMove = false;
      overlay.setPointerCapture?.(event.pointerId);
    }, true);

    overlay.addEventListener("pointermove", event => {
      if (!isTutorialOpen() || tutorialSwipeStartX === null) return;
      if (tutorialSwipePointerId !== null && event.pointerId !== tutorialSwipePointerId) return;
      const deltaX = event.clientX - tutorialSwipeStartX;
      const deltaY = event.clientY - tutorialSwipeStartY;
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) event.preventDefault();
    }, true);

    overlay.addEventListener("pointerup", event => {
      if (!isTutorialOpen() || tutorialSwipeStartX === null) return;
      if (tutorialSwipePointerId !== null && event.pointerId !== tutorialSwipePointerId) return;
      const deltaX = event.clientX - tutorialSwipeStartX;
      const deltaY = event.clientY - tutorialSwipeStartY;
      const pointerId = tutorialSwipePointerId;
      tutorialSwipeStartX = null;
      tutorialSwipeStartY = null;
      tutorialSwipePointerId = null;
      if (pointerId !== null && overlay.hasPointerCapture?.(pointerId)) overlay.releasePointerCapture(pointerId);
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 42) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
      tutorialSwipeDidMove = true;
      event.preventDefault();
      moveTutorial(deltaX < 0 ? 1 : -1);
      setTimeout(() => {
        tutorialSwipeDidMove = false;
      }, 160);
    }, true);

    overlay.addEventListener("pointercancel", event => {
      if (tutorialSwipePointerId === null || event.pointerId !== tutorialSwipePointerId) return;
      const pointerId = tutorialSwipePointerId;
      tutorialSwipeStartX = null;
      tutorialSwipeStartY = null;
      tutorialSwipePointerId = null;
      if (overlay.hasPointerCapture?.(pointerId)) overlay.releasePointerCapture(pointerId);
    }, true);

    startButton.addEventListener("click", () => {
      if (HexSnakeReplay.isPlaybackMode()) return;
      if (!characters.length) {
        window.location.reload();
        return;
      }
      if (paused && running && !gameOver) {
        paused = false;
        setStatus("對戰中：吃食物累積能量，集滿可獲得炸彈。");
        overlay.classList.remove("show");
        characterStage.hidden = false;
        lastPlayerStep = performance.now();
        lastComputerStep = lastPlayerStep;
        lastTimerFrame = lastPlayerStep;
        updateAutoBattleControls();
        return;
      }
      if (gameOver) {
        if (!canRestartAfterGameOver()) return;
        returnToStartScreen();
        return;
      }
      overlayTitle.textContent = "準備開局";
      overlayText.textContent = `每吃 1 個食物獲得 2 點能量，集滿 ${attackNeedTotal} 點獲得 1 枚炸彈，最多 ${maxAmmo} 枚；HP 上限為（蛇長 + 1）× ${hpPerSnakeUnit}；能量與炸彈都滿時，施放消耗炸彈的招式會立刻把滿能量轉為 1 枚炸彈；小招消耗目前最高的食物庫存 ${smallAttackFoodCost} 點與 ${smallAttackBombCost} 枚炸彈，大招消耗 ${bigAttackBombCost} 枚炸彈與四種庫存各 2 點。`;
      startButton.textContent = "開始";
      setOverlayChromeVisible(true);
      beginStartLogoCountdown();
    });

    computerBattleButton.addEventListener("click", () => {
      if (HexSnakeReplay.isPlaybackMode()) return;
      if (!characters.length) {
        window.location.reload();
        return;
      }
      if (gameOver && !canRestartAfterGameOver()) return;
      overlayTitle.textContent = "自動對弈";
      overlayText.textContent = "P1 / P2 皆自動操作，控制面板可調整對弈速度或暫停。";
      setOverlayChromeVisible(true);
      startGame({ computerBattle: true, resetRelayScore: true });
    });

    function applyAutoBattleSpeedIndex(index) {
      const nextIndex = Math.max(0, Math.min(autoBattleSpeeds.length - 1, index));
      if (autoBattleSpeeds[nextIndex] === computerBattleSpeed) return;
      setComputerBattleSpeed(autoBattleSpeeds[nextIndex]);
      resetAutoBattleStepTimers();
      updateAutoBattleControls();
    }

    function replayPlaybackSpeedIndex() {
      const options = replaySpeedOptions();
      const currentIndex = options.indexOf(HexSnakeReplay.playback?.speed ?? 1);
      return currentIndex >= 0 ? currentIndex : options.indexOf(1);
    }

    function applyReplayPlaybackSpeedIndex(index) {
      if (!HexSnakeReplay.playback) return;
      const options = replaySpeedOptions();
      const nextIndex = Math.max(0, Math.min(options.length - 1, index));
      if (options[nextIndex] === HexSnakeReplay.playback.speed) return;
      HexSnakeReplay.setPlaybackSpeed(options[nextIndex]);
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
      select: autoBattleSpeedSelect,
      menu: autoSpeedMenu,
      isActive: isPlayerAutoControlActive,
      currentIndex: () => autoBattleSpeeds.indexOf(computerBattleSpeed),
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
      select: replaySpeedSelect,
      menu: replaySpeedMenu,
      isActive: () => Boolean(HexSnakeReplay.playback),
      currentIndex: replayPlaybackSpeedIndex,
      applyIndex: applyReplayPlaybackSpeedIndex,
      setMenuOpen: setReplaySpeedMenuOpen,
      menuButtonSelector: "[data-replay-speed]",
      applyMenuButton(button) {
        HexSnakeReplay.setPlaybackSpeed(button.dataset.replaySpeed);
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
      if (!HexSnakeReplay.isPlaybackMode() || !HexSnakeReplay.playback) return false;
      if (event.button > 0 || event.target.closest(".overlay")) return false;
      event.preventDefault();
      event.stopPropagation();
      setReplaySpeedMenuOpen(false);
      replayBoardGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now(),
        startReplayTime: HexSnakeReplay.playback.time,
        startSpeedIndex: replayPlaybackSpeedIndex(),
        activated: false,
        moved: false,
        mode: null,
        longPressTimer: setTimeout(() => {
          if (!replayBoardGesture || replayBoardGesture.pointerId !== event.pointerId || !HexSnakeReplay.playback) return;
          replayBoardGesture.activated = true;
          replayBoardGesture.startReplayTime = HexSnakeReplay.playback.time;
          replayBoardGesture.startSpeedIndex = replayPlaybackSpeedIndex();
        }, replayBoardLongPressMs)
      };
      playArea.setPointerCapture?.(event.pointerId);
      return true;
    }

    function moveReplayBoardGesture(event) {
      if (!replayBoardGesture || event.pointerId !== replayBoardGesture.pointerId) return false;
      if (!HexSnakeReplay.playback) {
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
        const width = Math.max(1, playArea.getBoundingClientRect().width);
        const nextTime = replayBoardGesture.startReplayTime + HexSnakeReplay.playback.duration * (dx / width);
        HexSnakeReplay.seekPlayback(nextTime);
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
      if (playArea.hasPointerCapture?.(event.pointerId)) playArea.releasePointerCapture(event.pointerId);
      replayBoardGesture = null;

      if (gesture.activated) return true;
      if (Math.abs(dx) >= replayBoardSwipePx && Math.abs(dx) > Math.abs(dy) * 1.25) {
        lastReplayBoardTap = { at: 0, x: 0, y: 0 };
        HexSnakeReplay.switchPlayback(dx < 0 ? 1 : -1);
        return true;
      }
      if (Math.hypot(dx, dy) <= 12) {
        const now = performance.now();
        const tapDistance = Math.hypot(event.clientX - lastReplayBoardTap.x, event.clientY - lastReplayBoardTap.y);
        if (now - lastReplayBoardTap.at <= replayBoardTapMs && tapDistance <= replayBoardTapPx) {
          lastReplayBoardTap = { at: 0, x: 0, y: 0 };
          HexSnakeReplay.togglePlaybackPaused();
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
      if (playArea.hasPointerCapture?.(event.pointerId)) playArea.releasePointerCapture(event.pointerId);
      replayBoardGesture = null;
      return true;
    }

    document.addEventListener("pointerdown", event => {
      if (!autoSpeedMenu.hidden && !autoBattlePanel.contains(event.target)) {
        setAutoSpeedMenuOpen(false);
      }
      if (!replaySpeedMenu.hidden && !replayControls.contains(event.target)) {
        setReplaySpeedMenuOpen(false);
      }
    });

    relayModeInput.addEventListener("change", event => {
      event.stopPropagation();
      if (!isRelayModeAvailable()) {
        relayModeInput.checked = false;
        return;
      }
      setRelayMode(relayModeInput.checked, relayModeInput.checked);
    });

    autoPauseButton.addEventListener("click", event => {
      event.stopPropagation();
      if (!isPlayerAutoControlActive() || !running || gameOver) return;
      paused = !paused;
      if (!paused) {
        lastPlayerStep = performance.now();
        lastComputerStep = lastPlayerStep;
        lastTimerFrame = lastPlayerStep;
      }
      updateAutoBattleControls();
    });

    joyZone.addEventListener("pointerdown", event => {
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
      movePointerId = event.pointerId;
      movePointerStartedAt = performance.now();
      movePointerStartX = event.clientX;
      movePointerStartY = event.clientY;
      movePointerMoved = false;
      moveStickEngaged = false;
      joyZone.setPointerCapture(movePointerId);
      clearMoveStickHoldTimer();
      moveStickHoldTimer = setTimeout(() => engageMoveStick(event), 80);
    });

    joyZone.addEventListener("pointermove", event => {
      if (controlAttackPointer && event.pointerId === controlAttackPointer.pointerId) {
        moveControlPadAttackPointer(event);
        return;
      }
      if (event.pointerId === movePointerId && !moveStickEngaged) {
        const dragDistance = Math.hypot(event.clientX - movePointerStartX, event.clientY - movePointerStartY);
        if (dragDistance > 5) engageMoveStick(event);
      }
      if (event.pointerId === movePointerId && moveStickEngaged) moveStick(event);
    });

    joyZone.addEventListener("pointerup", event => {
      if (controlAttackPointer && event.pointerId === controlAttackPointer.pointerId) {
        finishControlPadAttackPointer(event);
        return;
      }
      releaseMoveStick(event);
    });
    joyZone.addEventListener("pointercancel", event => {
      if (controlAttackPointer && event.pointerId === controlAttackPointer.pointerId) {
        cancelControlPadAttackPointer(event);
        return;
      }
      releaseMoveStick(event);
    });

    window.addEventListener("pointermove", event => {
      if (controlAttackPointer && event.pointerId === controlAttackPointer.pointerId) {
        moveControlPadAttackPointer(event);
        return;
      }
      if (!moveStickLocked && !moveStickEngaged) return;
      if (event.pointerId === movePointerId || event.pointerType === "mouse") {
        moveStick(event);
      }
    });
    window.addEventListener("pointerup", finishControlPadAttackPointer);
    window.addEventListener("pointercancel", cancelControlPadAttackPointer);

    playArea.addEventListener("pointerdown", event => {
      if (event.target.closest(".overlay")) return;
      if (beginReplayBoardGesture(event)) return;
      beginBoardAttackPointer(event);
    });
    playArea.addEventListener("pointermove", event => {
      if (moveReplayBoardGesture(event)) return;
      moveBoardAttackPointer(event);
    });
    playArea.addEventListener("pointerup", event => {
      if (endReplayBoardGesture(event)) return;
      finishBoardAttackPointer(event);
    });
    playArea.addEventListener("pointercancel", event => {
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
      if (pendingDirectionKeybind !== null) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape" || event.key === "Esc") setPendingDirectionKeybind(null);
        else commitPendingDirectionKeybind(event.key === " " ? " " : event.key);
        return;
      }
      if (HexSnakeReplay.isPlaybackMode()) {
        if (event.key === "Escape" || event.key === "Esc") HexSnakeReplay.exitPlayback();
        if (event.key === " " && HexSnakeReplay.playback) {
          event.preventDefault();
          HexSnakeReplay.togglePlaybackPaused();
        }
        if (event.key === "ArrowLeft" && HexSnakeReplay.playback) {
          event.preventDefault();
          HexSnakeReplay.switchPlayback(-1);
        }
        if (event.key === "ArrowRight" && HexSnakeReplay.playback) {
          event.preventDefault();
          HexSnakeReplay.switchPlayback(1);
        }
        return;
      }
      if (!rulesModal.hidden) {
        if (event.key === "Escape" || event.key === "Esc") closeRulesModal();
        return;
      }
      if (isTutorialOpen()) {
        if (event.key === "Escape" || event.key === "Esc") {
          event.preventDefault();
          finishTutorial(true);
          return;
        }
        if (event.key === "PageDown" || event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          moveTutorial(1);
          return;
        }
        if (event.key === "PageUp" || event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          moveTutorial(-1);
          return;
        }
      }
      if (!replayModal.hidden) {
        if (event.key === "Escape" || event.key === "Esc") HexSnakeReplay.closeModal();
        return;
      }
      if (isLogoTransitionActive()) {
        if ((event.key === "Enter" || event.key === " ") && skipLogoTransition()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!settingsContent.hidden || !gmContent.hidden) {
        if (event.key === "Escape" || event.key === "Esc") {
          setSettingsOpen(false);
          setGmOpen(false);
        }
        return;
      }
      if (!portraitLightbox.hidden) {
        if (event.key === "Escape" || event.key === "Esc") closePortraitLightbox();
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          shiftPortraitLightbox(-1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          shiftPortraitLightbox(1);
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          shiftPortraitVariantMode(-1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          shiftPortraitVariantMode(1);
        }
        return;
      }
      if (mobileInputQuery.matches) return;
      if (event.target && ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;

      const pressedKey = event.key === " " ? " " : event.key.toLowerCase();
      if (pressedKey === keybinds.pause) {
        event.preventDefault();
        togglePause();
        return;
      }
      if (pressedKey === keybinds.surrender) {
        event.preventDefault();
        surrenderGame();
        return;
      }
      if (pressedKey === "x" || pressedKey === "y") {
        handleKeyboardAimKeyDown(event, pressedKey === "x" ? "small" : "big", pressedKey);
        return;
      }
      if (pressedKey === keybinds.smallAttack || pressedKey === keybinds.bigAttack) {
        event.preventDefault();
        const profile = pressedKey === keybinds.smallAttack ? "small" : "big";
        launchKeyboardPlayerAttack(profile);
        return;
      }
      if (keyToDir.has(pressedKey)) {
        event.preventDefault();
        setDirection(keyToDir.get(pressedKey));
        return;
      }
      if ((pressedKey === " " && keybinds.pause !== " ") || (pressedKey === "q" && keybinds.smallAttack !== "q" && keybinds.bigAttack !== "q")) {
        event.preventDefault();
        return;
      }

      const key = event.key.toLowerCase();
      if (key === " ") {
        if (!running || gameOver) {
          beginStartLogoCountdown();
          return;
        }
        paused = !paused;
        setStatus(paused ? "已暫停" : "對戰中：吃食物累積能量，集滿可獲得炸彈。");
        overlayTitle.textContent = "暫停";
        overlayText.textContent = "按繼續回到對戰。";
        startButton.textContent = "繼續";
        setOverlayChromeVisible(true);
        overlay.classList.toggle("show", paused);
        if (!paused) {
          lastPlayerStep = performance.now();
          lastComputerStep = lastPlayerStep;
          lastTimerFrame = lastPlayerStep;
        }
        updateAutoBattleControls();
        return;
      }

      if (key === "q") {
        if (!running || gameOver) {
          if (!autoStartGame()) return;
        }
        if (launchAttack("player", targetCell || snake[0], performance.now())) {
          setStatus("P1 施放炸彈，2 秒後落地。");
        } else {
          setStatus(`大招需要 ${bigAttackBombCost} 枚炸彈，且四種庫存各至少 2。`);
        }
        return;
      }

      if (keyToDir.has(key)) {
        event.preventDefault();
        setDirection(keyToDir.get(key));
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
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearKeyboardAimKeyLocks();
    });

    window.addEventListener("resize", resize);

    async function bootstrap() {
      await loadBalanceConfig();
      await loadHighAiStrategyConfig();
      try {
        await loadCharacterDatabase();
      } catch (error) {
        showCharacterDatabaseError(error);
        return;
      }
      buildCharacterOptions();
      buildCharacterStage();
      buildResourceHud();
      buildRulesContent();
      loadSavedGmSettings();
      setGridSize(gridSizeInput.value);
      setFoodCount(foodCountInput.value);
      setComputerDifficulty(computerDifficultyInput.value);
      setInitialSpeed(initialSpeedInput.value);
      setGmMode(gmMode);
      setInitialLength(initialLengthInput.value);
      setInitialEnergy(initialEnergyInput.value);
      setInitialBombs(initialBombsInput.value);
      initialStockInputs.forEach(input => setInitialStock(input.dataset.initialStock, input.value));
      updateGmPresetHighlight();
      setSettingsLocked(false);
      applyKeybinds();
      setLeftHandMode(localStorage.getItem("hexSnakeLeftHandMode") === "1");
      sfxMuteToggle.checked = HexSnakeAudio.muted;
      updateAttackButtons();
      resetGame();
      resize();
      renderIntroPortraits(false);
      overlay.classList.add("show");
      if (shouldShowTutorial()) showTutorial(0);
      preloadPortraitsFor("player");
      preloadPortraitsFor("computer");
      if (isEffectComparisonMode()) {
        overlay.classList.remove("show");
        characterStage.hidden = true;
        setStatus("Skill effect comparison mode.");
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(comparisonLoop);
      }
      if ("requestIdleCallback" in window) {
        requestIdleCallback(preloadAllPortraits, { timeout: 1500 });
      } else {
        setTimeout(preloadAllPortraits, 250);
      }
    }

    bootstrap();
