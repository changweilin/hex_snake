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
      if (choice === randomCharacterChoiceId) return randomCharacter().id;
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
      highlightedAttackProfile = profile === "small" || profile === "big" ? profile : null;
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
      smallAttackButton.classList.toggle("secondary", highlightedAttackProfile !== "small");
      bigAttackButton.classList.toggle("secondary", highlightedAttackProfile !== "big");
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
      computerDifficulty = ["novice", "low", "medium", "high"].includes(value) ? value : "medium";
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
      const showSurrender = running && !gameOver && !replayMode;
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
      playerHp = snake.length * 2;
      computerHp = computerSnake.length * 2;
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
      targetCell = { ...snake[0] };
      targetActive = false;
      totalElapsedMs = 0;
      lastFeedElapsedMs = 0;
      lastTimerFrame = 0;
      lastPlayerStep = 0;
      lastComputerStep = 0;
      playerStunUntil = 0;
      playerSlowUntil = 0;
      playerCollisionParalysisMs = 0;
      computerStunUntil = 0;
      computerSlowUntil = 0;
      computerCollisionParalysisMs = 0;
      playerUndergroundFrom = 0;
      playerUndergroundUntil = 0;
      computerUndergroundFrom = 0;
      computerUndergroundUntil = 0;
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
      lastPlayerAttackMs = -Infinity;
      lastComputerAttackMs = -Infinity;
      replaySurrendered = false;
      gameOver = false;
      paused = false;
      placeFoods();
      updateHud();
      setStatus("準備就緒。右搖桿移動，左搖桿瞄準攻擊。");
    }

    function canRestartAfterGameOver() {
      return !gameOverSettlementPending && performance.now() >= restartUnlockAt;
    }

    function startGame(options = {}) {
      if (replayMode) return false;
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
      startReplayRecording();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
      return true;
    }

    function autoStartGame() {
      if (running && !gameOver) return true;
      if (gameOver) return false;
      return startGame();
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
              <span class="resource-chip-fill" style="--resource-ratio: ${bombRatio.toFixed(4)}; --resource-chip-color: #facc15"></span>
            </span>
            <span class="resource-chip-value">${ammo}/${maxAmmo}</span>
          </span>
        `;
      }
      foodTypes.forEach(type => {
        const count = Math.max(0, Math.min(maxFoodStock, Math.round(stock[type.id] || 0)));
        const countEl = resourceBoard.querySelector(`[data-count="${owner}-${type.id}"]`);
        const fill = resourceBoard.querySelector(`[data-fill="${owner}-${type.id}"]`);
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

    function updateHud() {
      const playerMaxHp = snake.length * 2;
      const computerMaxHp = computerSnake.length * 2;
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
      const visible = !replayMode && (relayMode || (running && !gameOver && isRelayModeAvailable()));
      relayPanel.hidden = !visible;
      relayModeInput.checked = relayMode;
      relayScore.innerHTML = `<span class="owner-name is-p1">P1</span> ${relayPlayerWins} 勝 / <span class="owner-name is-p2">P2</span> ${relayComputerWins} 勝 / 平手 ${relayDraws}`;
    }

    function updateAutoBattleControls() {
      const visible = isPlayerAutoControlActive() && running && !gameOver && !replayMode;
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
      const nextActive = Boolean(active) && running && !gameOver && !replayMode;
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
      if (!computerBattleMode || !running || gameOver || replayMode) return;
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
      const from = owner === "player" ? playerUndergroundFrom : computerUndergroundFrom;
      const until = owner === "player" ? playerUndergroundUntil : computerUndergroundUntil;
      if (!from || now < from || now > until) return 1;
      const fadeMs = 120;
      const fadeIn = Math.min(1, Math.max(0, (now - from) / fadeMs));
      const fadeOut = Math.min(1, Math.max(0, (until - now) / fadeMs));
      return 1 - Math.min(fadeIn, fadeOut);
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

    function nearestFoodDistance(cell) {
      if (!foods.length) return Number.POSITIVE_INFINITY;
      return Math.min(...foods.map(food => wrappedDistance(cell, food)));
    }

    function wrappedDistance(start, target) {
      if (!start || !target) return Number.POSITIVE_INFINITY;
      if (keyOf(start) === keyOf(target)) return 0;
      const visited = new Set([keyOf(start)]);
      const queue = [{ cell: start, distance: 0 }];
      for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        for (let direction = 0; direction < directions.length; direction += 1) {
          const next = nextWrappedCell(current.cell, direction);
          const nextKey = keyOf(next);
          if (visited.has(nextKey)) continue;
          if (nextKey === keyOf(target)) return current.distance + 1;
          visited.add(nextKey);
          queue.push({ cell: next, distance: current.distance + 1 });
        }
      }
      return hexDistance(start, target);
    }

    function nearestFoodFor(cell) {
      if (!foods.length) return null;
      return [...foods].sort((a, b) => wrappedDistance(cell, a) - wrappedDistance(cell, b))[0];
    }

    function randomItem(items) {
      return items[Math.floor(Math.random() * items.length)];
    }

    const aiProfiles = {
      dragon: { preferredFood: "balanced" },
      sandworm: { preferredFood: "fat" },
      quetzal: { preferredFood: "fiber" },
      moray: { preferredFood: "carb" },
      lobster: { preferredFood: "protein" },
      gu_king: { preferredFood: "black" }
    };

    const highAiStrategyWeightsByCharacter = {
      dragon: {
        movement: { safePath: 0, leastDamage: 0, fastestArrival: 3 },
        food: { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 },
        skillAllocation: { preferSmall: 1, preferBig: 1 },
        castTiming: { lethal: 3, nearFullEnergy: 3, opponentDebuffed: 3, opponentAlmostReady: 0, nearOpponent: 0, farOpponent: 0 },
        castTarget: { targetHead: 3, bodyCluster: 0, targetNearestFood: 0 },
        castDirection: { selfHeadToOpponentHead: 0, opponentBodyLongestAxis: 0, opponentHeadToNearestFood: 3 }
      },
      sandworm: {
        movement: { safePath: 0, leastDamage: 0, fastestArrival: 3 },
        food: { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 },
        skillAllocation: { preferSmall: 1, preferBig: 1 },
        castTiming: { lethal: 3, nearFullEnergy: 3, opponentDebuffed: 3, opponentAlmostReady: 0, nearOpponent: 0, farOpponent: 0 },
        castTarget: { targetHead: 3, bodyCluster: 0, targetNearestFood: 0 },
        castDirection: { selfHeadToOpponentHead: 0, opponentBodyLongestAxis: 0, opponentHeadToNearestFood: 3 }
      },
      quetzal: {
        movement: { safePath: 0, leastDamage: 0, fastestArrival: 3 },
        food: { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 },
        skillAllocation: { preferSmall: 1, preferBig: 1 },
        castTiming: { lethal: 3, nearFullEnergy: 3, opponentDebuffed: 3, opponentAlmostReady: 0, nearOpponent: 0, farOpponent: 0 },
        castTarget: { targetHead: 3, bodyCluster: 0, targetNearestFood: 0 },
        castDirection: { selfHeadToOpponentHead: 0, opponentBodyLongestAxis: 0, opponentHeadToNearestFood: 3 }
      },
      moray: {
        movement: { safePath: 0, leastDamage: 0, fastestArrival: 3 },
        food: { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 },
        skillAllocation: { preferSmall: 1, preferBig: 1 },
        castTiming: { lethal: 3, nearFullEnergy: 3, opponentDebuffed: 3, opponentAlmostReady: 0, nearOpponent: 0, farOpponent: 0 },
        castTarget: { targetHead: 3, bodyCluster: 0, targetNearestFood: 0 },
        castDirection: { selfHeadToOpponentHead: 0, opponentBodyLongestAxis: 3, opponentHeadToNearestFood: 0 }
      },
      lobster: {
        movement: { safePath: 0, leastDamage: 0, fastestArrival: 3 },
        food: { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 },
        skillAllocation: { preferSmall: 1, preferBig: 1 },
        castTiming: { lethal: 3, nearFullEnergy: 3, opponentDebuffed: 3, opponentAlmostReady: 0, nearOpponent: 0, farOpponent: 0 },
        castTarget: { targetHead: 3, bodyCluster: 0, targetNearestFood: 0 },
        castDirection: { selfHeadToOpponentHead: 3, opponentBodyLongestAxis: 0, opponentHeadToNearestFood: 0 }
      },
      gu_king: {
        movement: { safePath: 0, leastDamage: 0, fastestArrival: 3 },
        food: { fastestArrival: 3, ownDeficit: 0, opponentDeficit: 0, ownPreferred: 0, opponentPreferred: 0 },
        skillAllocation: { preferSmall: 1, preferBig: 1 },
        castTiming: { lethal: 3, nearFullEnergy: 3, opponentDebuffed: 3, opponentAlmostReady: 0, nearOpponent: 0, farOpponent: 0 },
        castTarget: { targetHead: 3, bodyCluster: 0, targetNearestFood: 0 },
        castDirection: { selfHeadToOpponentHead: 0, opponentBodyLongestAxis: 0, opponentHeadToNearestFood: 3 }
      }
    };
    const dragonOrbStepMs = 45;

    function ultimateSetting(characterId, key, fallback) {
      const value = attackUltimateBalance?.[characterId]?.[key];
      return Number.isFinite(value) ? value : fallback;
    }

    function ultimateDamageMultiplier(characterId) {
      return ultimateSetting(characterId, "damageMultiplier", 1);
    }

    function bigAttackAbilityId(characterId) {
      if (characterId === "dragon") return "lobster";
      if (characterId === "lobster") return "dragon";
      return characterId;
    }

    function bigAttackUsesDrawnDirection(characterId) {
      return characterId === "moray" || characterId === "lobster";
    }

    function shouldUseControlPadAttackDirection() {
      return selectedAttackProfile === "big" && bigAttackUsesDrawnDirection(characterFor("player").id);
    }

    function defaultAiStrategyWeights() {
      return {
        movement: {
          safePath: computerDifficulty === "high" ? 1.6 : computerDifficulty === "low" ? 0.9 : 1.2,
          leastDamage: computerDifficulty === "high" ? 1.3 : 1,
          fastestArrival: computerDifficulty === "low" ? 1.3 : 1
        },
        food: {
          fastestArrival: 1,
          ownDeficit: 0.8,
          opponentDeficit: computerDifficulty === "high" ? 1.5 : 0.45,
          ownPreferred: computerDifficulty === "high" ? 1.1 : 0.75,
          opponentPreferred: computerDifficulty === "high" ? 1.4 : 0.35
        },
        skillAllocation: {
          preferSmall: computerDifficulty === "low" ? 2.1 : computerDifficulty === "high" ? 0.45 : 1,
          preferBig: computerDifficulty === "high" ? 2.1 : computerDifficulty === "low" ? 0.45 : 1
        },
        castTiming: {
          lethal: 3,
          nearFullEnergy: 0.75,
          opponentDebuffed: computerDifficulty === "low" ? 0.4 : 1.25,
          opponentAlmostReady: computerDifficulty === "high" ? 1.2 : 0.65,
          nearOpponent: computerDifficulty === "high" ? 1.15 : 0.85,
          farOpponent: computerDifficulty === "high" ? 0.75 : 0.35
        },
        castTarget: {
          targetHead: 1.3,
          bodyCluster: computerDifficulty === "high" ? 1.2 : 0.8,
          targetNearestFood: computerDifficulty === "high" ? 0.8 : 0.5
        },
        castDirection: {
          selfHeadToOpponentHead: 1.4,
          opponentBodyLongestAxis: computerDifficulty === "high" ? 1.1 : 0.7,
          opponentHeadToNearestFood: computerDifficulty === "high" ? 0.8 : 0.4
        }
      };
    }

    function mergeAiWeights(defaults, provided = {}) {
      return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
        const value = Number(provided[key]);
        return [key, Number.isFinite(value) ? Math.min(3, Math.max(0, value)) : fallback];
      }));
    }

    function normalizeAiStrategyWeights(provided = {}) {
      const defaults = defaultAiStrategyWeights();
      return {
        movement: mergeAiWeights(defaults.movement, provided.movement),
        food: mergeAiWeights(defaults.food, provided.food),
        skillAllocation: mergeAiWeights(defaults.skillAllocation, provided.skillAllocation),
        castTiming: mergeAiWeights(defaults.castTiming, provided.castTiming),
        castTarget: mergeAiWeights(defaults.castTarget, provided.castTarget),
        castDirection: mergeAiWeights(defaults.castDirection, provided.castDirection)
      };
    }

    function aiProfileFor(owner) {
      const character = characterFor(owner);
      return aiProfiles[character.id] || { preferredFood: character.foodPreference };
    }

    function aiStrategyWeightsFor(owner) {
      if (computerDifficulty !== "high") return defaultAiStrategyWeights();
      return normalizeAiStrategyWeights(highAiStrategyWeightsByCharacter[characterFor(owner).id]);
    }

    function ownerSnake(owner) {
      return owner === "player" ? snake : computerSnake;
    }

    function ownerStock(owner) {
      return owner === "player" ? playerStock : computerStock;
    }

    function ownerHead(owner) {
      return ownerSnake(owner)[0];
    }

    function opponentOf(owner) {
      return owner === "player" ? "computer" : "player";
    }

    function isNoviceComputer() {
      return computerDifficulty === "novice";
    }

    function aiAvoidsOpponentBody() {
      const ignoreBodyChance = { novice: 0.55, low: 0.35, medium: 0, high: 0 }[computerDifficulty] ?? 0;
      return Math.random() >= ignoreBodyChance;
    }

    function computerCanGrow() {
      return !isNoviceComputer();
    }

    function computerCanUseAttack() {
      return !isNoviceComputer();
    }

    function ownerStunUntil(owner) {
      return owner === "player" ? playerStunUntil : computerStunUntil;
    }

    function ownerSlowUntil(owner) {
      return owner === "player" ? playerSlowUntil : computerSlowUntil;
    }

    function ownerCollisionParalysis(owner) {
      return owner === "player" ? playerCollisionParalysisMs : computerCollisionParalysisMs;
    }

    function ownerHp(owner) {
      return owner === "player" ? playerHp : computerHp;
    }

    function isOwnerUnderground(owner, now) {
      if (characterFor(owner).id !== "sandworm") return false;
      const from = owner === "player" ? playerUndergroundFrom : computerUndergroundFrom;
      const until = owner === "player" ? playerUndergroundUntil : computerUndergroundUntil;
      return Boolean(from && now >= from && now <= until);
    }

    function updateAiVisibilityMemory(now) {
      if (snake && !isOwnerUnderground("player", now)) {
        lastVisiblePlayerSnake = snake.map(segment => ({ ...segment }));
        lastVisiblePlayerDir = dir;
      }
      if (computerSnake && !isOwnerUnderground("computer", now)) {
        lastVisibleComputerSnake = computerSnake.map(segment => ({ ...segment }));
        lastVisibleComputerDir = computerDir;
      }
    }

    function perceivedSnakeFor(observer, target, now) {
      if (!isOwnerUnderground(target, now)) return ownerSnake(target);
      const remembered = target === "player" ? lastVisiblePlayerSnake : lastVisibleComputerSnake;
      return remembered.length ? remembered : ownerSnake(target).map(segment => ({ ...segment }));
    }

    function perceivedDirectionFor(target, now) {
      if (!isOwnerUnderground(target, now)) return target === "player" ? nextDir : computerDir;
      return target === "player" ? lastVisiblePlayerDir : lastVisibleComputerDir;
    }

    function hasOpponentDebuff(owner, now) {
      const opponent = opponentOf(owner);
      return now < ownerStunUntil(opponent) || now < ownerSlowUntil(opponent) || ownerCollisionParalysis(opponent) > 0;
    }

    function hasResourcePressure(owner) {
      const stock = ownerStock(owner);
      const nearStockCap = foodTypes.some(type => stock[type.id] >= maxFoodStock - 2);
      return nearStockCap || hasFullBombsAndNearFullEnergy(owner);
    }

    function hasFullBombsAndNearFullEnergy(owner) {
      return ammoFor(owner) >= maxAmmo && ammoChargeFor(owner) >= attackNeedTotal - 1;
    }

    function strongestVisibleDamage(owner, profile, now) {
      const opponent = opponentOf(owner);
      const stock = ownerStock(owner);
      const stats = attackStats(stock, profile);
      const targetSnake = perceivedSnakeFor(owner, opponent, now);
      const head = targetSnake[0];
      const candidates = cellsWithinDistance(head, 0, Math.max(1, Math.ceil(stats.radius + 1)));
      return candidates.reduce((best, cell) => Math.max(best, damageSnake(targetSnake, cell, stats.radius, stats.damage)), 0);
    }

    function shouldUseBigAttack(owner, now) {
      if (!canAttack(owner, "big")) return false;
      if (computerDifficulty === "low") {
        const distance = hexDistance(ownerHead(owner), perceivedSnakeFor(owner, opponentOf(owner), now)[0]);
        return !canAttack(owner, "small") || hasResourcePressure(owner) || (distance <= 2 && Math.random() < 0.35) || Math.random() < 0.18;
      }
      if (computerDifficulty === "medium" || computerDifficulty === "high") {
        const lethal = strongestVisibleDamage(owner, "big", now) >= ownerHp(opponentOf(owner));
        return hasOpponentDebuff(owner, now) || lethal || hasResourcePressure(owner);
      }
      return false;
    }

    function isLethalAttack(owner, profile, now) {
      return canAttack(owner, profile) && strongestVisibleDamage(owner, profile, now) >= ownerHp(opponentOf(owner));
    }

    function attackResourceCost(profile = "big") {
      return attackFoodCost(profile) * foodTypes.length + attackBombCost(profile) * foodTypes.length;
    }

    function opponentAlmostReady(owner) {
      const opponent = opponentOf(owner);
      const stock = ownerStock(opponent);
      if (canAttack(opponent, "small") || canAttack(opponent, "big")) return true;
      const stockClose = foodTypes.every(type => stock[type.id] >= Math.max(0, attackFoodCost("small") - 1));
      const ammoClose = ammoFor(opponent) >= bigAttackBombCost - 1 || ammoChargeFor(opponent) >= attackNeedTotal - 1;
      return stockClose || ammoClose;
    }

    function castTimingScore(owner, profile, now) {
      const weights = aiStrategyWeightsFor(owner).castTiming;
      const opponent = opponentOf(owner);
      const distance = hexDistance(ownerHead(owner), perceivedSnakeFor(owner, opponent, now)[0]);
      let score = 0;
      if (isLethalAttack(owner, profile, now)) score += weights.lethal * 3;
      if (hasFullBombsAndNearFullEnergy(owner)) score += weights.nearFullEnergy;
      if (hasOpponentDebuff(owner, now)) score += weights.opponentDebuffed;
      if (opponentAlmostReady(owner)) score += weights.opponentAlmostReady;
      if (distance <= 3) score += weights.nearOpponent * (4 - distance) / 3;
      if (distance >= 5) score += weights.farOpponent * Math.min(1, (distance - 4) / 4);
      return score;
    }

    function chooseAiAttackProfile(owner, now) {
      if (isNoviceComputer()) return null;
      const lethal = ["small", "big"]
        .filter(profile => isLethalAttack(owner, profile, now))
        .sort((a, b) => attackResourceCost(a) - attackResourceCost(b))[0];
      if (lethal) return lethal;
      if (computerDifficulty === "low" && shouldUseBigAttack(owner, now)) return "big";

      if (computerDifficulty === "high") {
        const available = ["small", "big"].filter(profile => canAttack(owner, profile));
        if (!available.length) return null;
        const allocation = aiStrategyWeightsFor(owner).skillAllocation;
        const scored = available.map(profile => {
          const allocationScore = profile === "small" ? allocation.preferSmall : allocation.preferBig;
          const timingScore = castTimingScore(owner, profile, now);
          const legacyBoost = profile === "big" && shouldUseBigAttack(owner, now) ? 1.25 : 0;
          return { profile, score: allocationScore + timingScore + legacyBoost };
        });
        const bestScore = Math.max(...scored.map(row => row.score));
        const bestOptions = scored.filter(row => row.score === bestScore);
        const best = bestOptions.length > 1 ? randomItem(bestOptions) : bestOptions[0];
        const tiedSmall = bestOptions.some(row => row.profile === "small");
        if (best.profile === "big") return best.score >= (tiedSmall ? 0.9 : 1.8) ? "big" : canAttack(owner, "small") ? "small" : null;
        return best.score >= 0.9 ? best.profile : null;
      }

      if (shouldUseBigAttack(owner, now)) return "big";
      if (canAttack(owner, "small")) return "small";
      if (computerDifficulty === "low" && canAttack(owner, "big")) return "big";
      return null;
    }

    function cellsWithinDistance(origin, minDistance, maxDistance) {
      return cells.filter(cell => {
        const distance = hexDistance(cell, origin);
        return distance >= minDistance && distance <= maxDistance;
      });
    }

    function attackTargetDamage(targetSnake, target, radius, damageScale) {
      return damageSnake(targetSnake, target, radius, damageScale);
    }

    function bestBodyClusterTarget(targetSnake, stats) {
      if (!targetSnake.length) return null;
      return [...cells].sort((a, b) => {
        const damageDiff = attackTargetDamage(targetSnake, b, stats.radius, stats.damage) - attackTargetDamage(targetSnake, a, stats.radius, stats.damage);
        if (damageDiff) return damageDiff;
        return wrappedDistance(targetSnake[0], a) - wrappedDistance(targetSnake[0], b);
      })[0];
    }

    function directionForLongestBodyAxis(targetSnake, fallbackDirection = 0) {
      if (!targetSnake.length) return fallbackDirection;
      const values = targetSnake.map(cell => ({ q: cell.q, r: cell.r, s: -cell.q - cell.r }));
      const rangeFor = axis => Math.max(...values.map(value => value[axis])) - Math.min(...values.map(value => value[axis]));
      const axis = ["q", "r", "s"].sort((a, b) => rangeFor(b) - rangeFor(a))[0];
      const head = values[0];
      const tailAverage = values.slice(1).reduce((sum, value) => sum + value[axis], 0) / Math.max(1, values.length - 1);
      const positive = tailAverage >= head[axis];
      if (axis === "q") return positive ? 2 : 5;
      if (axis === "r") return positive ? 3 : 0;
      return positive ? 4 : 1;
    }

    function chooseAiAttackDirection(owner, target, now) {
      const opponent = opponentOf(owner);
      const targetSnake = perceivedSnakeFor(owner, opponent, now);
      const targetHead = targetSnake[0] || target;
      const nearestFood = nearestFoodFor(targetHead);
      const fallbackDirection = ownerDirection(owner);
      const ideal = directionFromSourceToTarget(ownerHead(owner), target, fallbackDirection);
      const weights = aiStrategyWeightsFor(owner).castDirection;
      const candidates = [
        {
          direction: directionFromSourceToTarget(ownerHead(owner), targetHead, fallbackDirection),
          weight: weights.selfHeadToOpponentHead
        },
        {
          direction: directionForLongestBodyAxis(targetSnake, fallbackDirection),
          weight: weights.opponentBodyLongestAxis
        },
        {
          direction: nearestFood ? directionFromSourceToTarget(targetHead, nearestFood, fallbackDirection) : fallbackDirection,
          weight: nearestFood ? weights.opponentHeadToNearestFood : 0
        }
      ];
      candidates.sort((a, b) => b.weight - a.weight || turnDistance(a.direction, ideal) - turnDistance(b.direction, ideal));
      return candidates[0].direction;
    }

    function chooseAiAttackTarget(owner, profile, now) {
      const opponent = opponentOf(owner);
      const targetSnake = perceivedSnakeFor(owner, opponent, now);
      const targetHead = targetSnake[0];
      const stats = attackStats(ownerStock(owner), profile);

      if (computerDifficulty === "high") {
        const maxDamageTarget = bestBodyClusterTarget(targetSnake, stats) || targetHead;
        if (attackTargetDamage(targetSnake, maxDamageTarget, stats.radius, stats.damage) >= ownerHp(opponent)) return { ...maxDamageTarget };
        const weights = aiStrategyWeightsFor(owner).castTarget;
        const nearestFood = nearestFoodFor(targetHead);
        const weighted = [
          { target: targetHead, weight: weights.targetHead },
          { target: maxDamageTarget, weight: weights.bodyCluster },
          { target: nearestFood || targetHead, weight: nearestFood ? weights.targetNearestFood : 0 }
        ];
        weighted.sort((a, b) => {
          const aDamage = attackTargetDamage(targetSnake, a.target, stats.radius, stats.damage);
          const bDamage = attackTargetDamage(targetSnake, b.target, stats.radius, stats.damage);
          const aScore = a.weight * 2 + aDamage * 0.8 + (aDamage > 0 ? 0.5 : -2);
          const bScore = b.weight * 2 + bDamage * 0.8 + (bDamage > 0 ? 0.5 : -2);
          if (aScore !== bScore) return bScore - aScore;
          return wrappedDistance(targetHead, a.target) - wrappedDistance(targetHead, b.target);
        });
        return { ...weighted[0].target };
      }

      if (computerDifficulty === "medium") {
        const nearTarget = cellsWithinDistance(targetHead, 0, 1);
        return { ...randomItem(nearTarget.length ? nearTarget : [targetHead]) };
      }

      const looseAim = cellsWithinDistance(targetHead, 2, 4);
      return { ...randomItem(looseAim.length ? looseAim : cellsWithinDistance(targetHead, 0, 2)) };
    }

    function shortestFoodDistance(start, occupied) {
      const foodKeys = new Set(foods.map(keyOf));
      const visited = new Set([keyOf(start)]);
      const queue = [{ cell: start, distance: 0 }];

      for (let index = 0; index < queue.length; index += 1) {
        const current = queue[index];
        if (foodKeys.has(keyOf(current.cell))) return current.distance;

        directions.forEach((_, direction) => {
          const next = nextWrappedCell(current.cell, direction);
          const nextKey = keyOf(next);
          if (visited.has(nextKey)) return;
          if (occupied.has(nextKey) && !foodKeys.has(nextKey)) return;
          visited.add(nextKey);
          queue.push({ cell: next, distance: current.distance + 1 });
        });
      }

      return Number.POSITIVE_INFINITY;
    }

    function reachableSpace(start, occupied, maxCells = 10) {
      if (occupied.has(keyOf(start))) return 0;
      const visited = new Set([keyOf(start)]);
      const queue = [start];
      for (let index = 0; index < queue.length && visited.size < maxCells; index += 1) {
        const current = queue[index];
        directions.forEach((_, direction) => {
          const next = nextWrappedCell(current, direction);
          const nextKey = keyOf(next);
          if (visited.has(nextKey) || occupied.has(nextKey)) return;
          visited.add(nextKey);
          queue.push(next);
        });
      }
      return visited.size;
    }

    function expectedDamageAt(owner, cell, now) {
      const opponent = opponentOf(owner);
      let damage = 0;
      projectiles.forEach(projectile => {
        if (projectile.owner !== opponent) return;
        if (!isProjectileVisibleTo(owner, projectile, now)) return;
        if (projectile.kind === "line") {
          if (projectile.lineCells?.some(lineCell => hexDistance(lineCell, cell) <= projectile.width)) damage += projectile.damage || 0;
          return;
        }
        const target = projectile.explosionTarget || projectile.target;
        if (target && hexDistance(cell, target) <= (projectile.radius || 0)) damage += projectile.damage || 0;
      });
      hazards.forEach(hazard => {
        if (hazard.owner !== opponent || now > hazard.endAt) return;
        if (hazard.kind === "radiation" && hexDistance(cell, hazard.target) <= hazard.radius) damage += hazard.damage || 0;
        if (hazard.cells?.some(hazardCell => hexDistance(hazardCell, cell) <= hazard.width)) damage += hazard.damage || 0;
      });
      return damage;
    }

    function isProjectileVisibleTo(observer, projectile, now) {
      if (projectile.owner === observer) return true;
      if (!projectile.sandwormHidden) return true;
      return projectile.impactAt - now <= sandwormRevealBeforeImpactMs;
    }

    function foodValueFor(owner, opponent, food, now) {
      const ownDistance = wrappedDistance(ownerHead(owner), food);
      const opponentHead = perceivedSnakeFor(owner, opponent, now)[0];
      const opponentDistance = wrappedDistance(opponentHead, food);
      const profile = aiProfileFor(owner);
      const opponentProfile = aiProfileFor(opponent);
      const types = food.types || [];
      const weights = aiStrategyWeightsFor(owner).food;
      const normalizedTypes = types.includes("black") ? foodTypes.map(type => type.id) : types.filter(type => foodTypes.some(foodType => foodType.id === type));
      const ownStock = ownerStock(owner);
      const opponentStock = ownerStock(opponent);
      const ownDeficit = normalizedTypes.reduce((sum, type) => sum + maxFoodStock - (ownStock[type] || 0), 0) / Math.max(1, normalizedTypes.length);
      const opponentDeficit = normalizedTypes.reduce((sum, type) => sum + maxFoodStock - (opponentStock[type] || 0), 0) / Math.max(1, normalizedTypes.length);
      const preferred = profile.preferredFood === "balanced"
        ? normalizedTypes.length > 0
        : profile.preferredFood === "black" ? types.includes("black") : types.includes(profile.preferredFood);
      const opponentPreferred = opponentProfile.preferredFood === "balanced"
        ? normalizedTypes.length > 0
        : opponentProfile.preferredFood === "black" ? types.includes("black") : types.includes(opponentProfile.preferredFood);
      if (computerDifficulty === "high") {
        return (
          weights.fastestArrival * (1 / (1 + ownDistance)) * 10 +
          weights.ownDeficit * ownDeficit / 5 +
          weights.opponentDeficit * opponentDeficit / 6 +
          weights.ownPreferred * (preferred ? 2.5 : 0) +
          weights.opponentPreferred * (opponentPreferred ? 2 : 0) +
          (opponentDistance <= ownDistance ? weights.opponentDeficit * 0.35 : 0)
        );
      }
      const preferredBonus = preferred ? 1.5 : 0;
      return -ownDistance + preferredBonus + (opponentDistance <= ownDistance ? 0.4 : 0);
    }

    function chooseAiMoveTarget(owner, opponent, now) {
      const perceivedOpponent = perceivedSnakeFor(owner, opponent, now);
      if (!foods.length) return perceivedOpponent[0];
      const targetKey = owner === "player" ? playerFoodTargetKey : computerFoodTargetKey;
      const targetAt = owner === "player" ? playerFoodTargetAt : computerFoodTargetAt;
      const staleTarget = targetKey && Number.isFinite(targetAt) && now - targetAt >= 20000 ? targetKey : null;
      const choices = foods.filter(food => keyOf(food) !== staleTarget);
      const filteredChoices = filterUnsafeFoodTargets(owner, opponent, choices.length ? choices : foods, now);
      const targetPool = filteredChoices.length ? filteredChoices : choices.length ? choices : foods;
      const lockedTarget = !staleTarget && targetKey ? targetPool.find(food => keyOf(food) === targetKey) : null;
      const target = lockedTarget || [...targetPool].sort((a, b) => foodValueFor(owner, opponent, b, now) - foodValueFor(owner, opponent, a, now))[0];
      const nextTargetKey = target ? keyOf(target) : null;
      if (owner === "player") {
        if (nextTargetKey !== playerFoodTargetKey) playerFoodTargetAt = nextTargetKey ? now : 0;
        playerFoodTargetKey = nextTargetKey;
      } else {
        if (nextTargetKey !== computerFoodTargetKey) computerFoodTargetAt = nextTargetKey ? now : 0;
        computerFoodTargetKey = nextTargetKey;
      }
      return target;
    }

    function movementOccupiedSet(owner, opponent, now) {
      const ownSnake = ownerSnake(owner);
      const opponentSnake = perceivedSnakeFor(owner, opponent, now);
      const occupied = new Set(ownSnake.slice(0, -1).map(keyOf));
      if (aiAvoidsOpponentBody() && !isOwnerUnderground(opponent, now)) {
        opponentSnake.forEach(segment => occupied.add(keyOf(segment)));
      }
      return occupied;
    }

    function filterUnsafeFoodTargets(owner, opponent, candidateFoods, now) {
      if (candidateFoods.length <= 1) return candidateFoods;
      const occupied = movementOccupiedSet(owner, opponent, now);
      const withRace = candidateFoods.map(food => ({
        food,
        opponentAdvantage: wrappedDistance(ownerHead(owner), food) - wrappedDistance(ownerHead(opponent), food),
        reachable: reachableSpace(food, occupied, deadEndMinSpace)
      }));
      const maxOpponentAdvantage = Math.max(0, ...withRace.map(row => row.opponentAdvantage));
      const filtered = withRace
        .filter(row => !(maxOpponentAdvantage > 0 && row.opponentAdvantage === maxOpponentAdvantage))
        .filter(row => row.reachable >= deadEndMinSpace)
        .map(row => row.food);
      return filtered.length ? filtered : candidateFoods;
    }

    function chooseAiDirection(owner, now = performance.now()) {
      const opponent = opponentOf(owner);
      const ownSnake = ownerSnake(owner);
      const currentDirection = owner === "player" ? dir : computerDir;
      const opponentSnake = perceivedSnakeFor(owner, opponent, now);
      const opponentDirection = perceivedDirectionFor(opponent, now);
      const opponentThreat = nextWrappedCell(opponentSnake[0], opponentDirection);
      const target = chooseAiMoveTarget(owner, opponent, now);
      const occupied = movementOccupiedSet(owner, opponent, now);
      const options = [];

      directions.forEach((_, candidate) => {
        if (!canOwnerTurn(owner, candidate)) return;
        const next = nextWrappedCell(ownSnake[0], candidate);
        const nextKey = keyOf(next);

        const blocked = occupied.has(nextKey);
        const headThreat = keyOf(opponentThreat) === nextKey;
        const danger = headThreat ? 20 : 0;
        const wallPressure = cells.filter(cell => hexDistance(cell, next) <= 1 && !occupied.has(keyOf(cell))).length;
        const pathDistance = shortestFoodDistance(next, occupied);
        const targetDistance = wrappedDistance(next, target);
        const expectedDamage = expectedDamageAt(owner, next, now);
        const trapRisk = Math.max(0, 5 - reachableSpace(next, occupied, 10));
        const deadEnd = reachableSpace(next, occupied, deadEndMinSpace) < deadEndMinSpace;
        const lethalThreat = expectedDamage >= ownerHp(owner);
        const weights = aiStrategyWeightsFor(owner).movement;
        const risk = (blocked ? 100 : 0) + danger + trapRisk * 4 + expectedDamage;
        options.push({
          direction: candidate,
          blocked,
          headThreat,
          deadEnd,
          lethalThreat,
          pathValue: Number.isFinite(pathDistance) ? pathDistance : nearestFoodDistance(next),
          tacticalValue: computerDifficulty === "high"
            ? weights.fastestArrival * targetDistance + weights.safePath * risk + weights.leastDamage * expectedDamage - wallPressure * 0.04
            : (Number.isFinite(pathDistance) ? pathDistance : nearestFoodDistance(next)) + targetDistance * 0.45 + danger - wallPressure * 0.08,
          fallbackValue: nearestFoodDistance(next) + targetDistance * 0.45 + danger - wallPressure * 0.08
        });
      });

      if (!options.length) return currentDirection;

      const hardSafe = options.filter(option => !option.blocked && !option.headThreat && !option.deadEnd && !option.lethalThreat);
      const rankedOptions = hardSafe.length ? hardSafe : options.filter(option => !option.blocked && !option.headThreat && !option.lethalThreat);
      const sortableOptions = rankedOptions.length ? rankedOptions : options;
      sortableOptions.sort((a, b) => {
        if (computerDifficulty === "high") return a.tacticalValue - b.tacticalValue;
        const aValue = Number.isFinite(a.tacticalValue) ? a.tacticalValue : a.fallbackValue;
        const bValue = Number.isFinite(b.tacticalValue) ? b.tacticalValue : b.fallbackValue;
        return aValue - bValue;
      });
      const randomChance = { high: 0, medium: 0.3, low: 0.52, novice: 0.52 }[computerDifficulty];

      if (Math.random() < randomChance) return randomItem(sortableOptions).direction;
      return sortableOptions[0].direction;
    }

    function chooseComputerDirection() {
      return chooseAiDirection("computer");
    }

    function chooseAutoDirection(owner) {
      return chooseAiDirection(owner);
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
        damage: damageMultiplier(stock)
      };
    }

    function bandDistanceFromTotalWidth(totalWidth) {
      return Math.max(0, Math.floor((totalWidth - 1) / 2));
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

    function dragonTrackingDirection(cursor, direction, targetSnake, visited) {
      const target = targetSnake[0];
      if (!target) return direction;
      const idealDirection = directionFromSourceToTarget(cursor, target, direction);
      const candidates = [
        direction,
        (direction + 1) % directions.length,
        (direction + 5) % directions.length,
        (direction + 2) % directions.length,
        (direction + 4) % directions.length
      ];
      candidates.sort((a, b) => {
        const nextA = nextWrappedCell(cursor, a);
        const nextB = nextWrappedCell(cursor, b);
        const distanceA = hexDistance(nextA, target) + (visited.has(keyOf(nextA)) ? 0.35 : 0);
        const distanceB = hexDistance(nextB, target) + (visited.has(keyOf(nextB)) ? 0.35 : 0);
        if (distanceA !== distanceB) return distanceA - distanceB;
        return turnDistance(a, idealDirection) - turnDistance(b, idealDirection);
      });
      return candidates[0];
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

    function dragonChargePath(source, direction, targetSnake) {
      const targetCells = cellKeySet(targetSnake);
      const path = [];
      let cursor = source;
      let carryAfterHit = false;
      while (isInside(cursor)) {
        path.push({ q: cursor.q, r: cursor.r });
        if (carryAfterHit) break;
        if (targetCells.has(keyOf(cursor))) carryAfterHit = true;
        cursor = nextCell(cursor, direction);
      }
      return path;
    }

    function dragonOrbPath(source, direction) {
      return cellsForwardFrom(source, direction, false);
    }

    function dragonWrappedOrbPath(source, direction) {
      const path = [];
      let cursor = { q: source.q, r: source.r };
      const maxSteps = Math.max(1, cells.length);
      for (let step = 0; step < maxSteps; step += 1) {
        cursor = nextWrappedCell(cursor, direction);
        if (keyOf(cursor) === keyOf(source)) break;
        path.push({ q: cursor.q, r: cursor.r });
      }
      return path;
    }

    function dragonTrackingOrbPath(source, direction, targetSnake) {
      const path = [];
      const visited = new Set([keyOf(source)]);
      let cursor = { q: source.q, r: source.r };
      let currentDirection = direction;
      const maxSteps = Math.max(1, Math.ceil((radius * 2 + 1) / 2));
      for (let step = 0; step < maxSteps; step += 1) {
        if (step > 0) {
          currentDirection = dragonTrackingDirection(cursor, currentDirection, targetSnake, visited);
        }
        cursor = nextWrappedCell(cursor, currentDirection);
        if (keyOf(cursor) === keyOf(source)) break;
        path.push({ q: cursor.q, r: cursor.r });
        visited.add(keyOf(cursor));
      }
      return path;
    }

    function lobsterFistDirection(cursor, direction, targetSnake) {
      const target = targetSnake[0];
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
          currentDirection = lobsterFistDirection(cursor, currentDirection, targetSnake);
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

    function scheduleCharacterBigAttack(owner, character, source, target, now, stock, stunChance, options = {}) {
      const small = attackStats(stock, "small");
      const direction = Number.isInteger(options.aimDirection)
        ? options.aimDirection
        : directionFromSourceToTarget(source, target, ownerDirection(owner));
      const abilityId = bigAttackAbilityId(character.id);

      if (abilityId === "dragon") {
        const targetSnake = owner === "player" ? computerSnake : snake;
        const useTracking = character.id === "lobster" || isPlayerAutoControlActive() || owner === "computer";
        const isLobsterPalm = character.id === "lobster";
        const path = isLobsterPalm
          ? lobsterFistPath(source, direction, targetSnake)
          : useTracking
          ? dragonTrackingOrbPath(source, direction, targetSnake)
          : dragonWrappedOrbPath(source, direction);
        const hits = pathHits(path, targetSnake);
        const endCell = path[path.length - 1] || source;
        const orbStepMs = ultimateSetting(abilityId, "orbStepMs", dragonOrbStepMs);
        const travelDelay = small.delay + path.length * orbStepMs;
        const volleys = isLobsterPalm ? 2 : 1;
        const orbDamage = small.damage * (isLobsterPalm ? 0.3 : 1);
        const orbRadius = isLobsterPalm ? 1 : small.radius * ultimateSetting(abilityId, "orbRadiusMultiplier", 1);
        const burstRadius = small.radius * (isLobsterPalm ? 1.5 : 2);
        const burstDamage = small.damage * (isLobsterPalm ? 0.9 : 1.5);
        const visualType = character.id === "lobster" ? "lobster-palm-big" : attackVisualType(owner, "big", abilityId);
        const volleyIntervalMs = isLobsterPalm ? attackDelay(stock) : 500;
        for (let volley = 0; volley < volleys; volley += 1) {
          const volleyDelay = volley * volleyIntervalMs;
          const hand = volley % 2 === 0 ? "right" : "left";
          projectiles.push({
            kind: "dragonOrb",
            owner,
            profile: "big",
            source: { q: source.q, r: source.r },
            target: { q: endCell.q, r: endCell.r },
            pathCells: path,
            visualType,
            hand,
            createdAt: now + volleyDelay,
            impactAt: now + volleyDelay + travelDelay,
            delay: travelDelay,
            radius: orbRadius,
            damage: orbDamage,
            burstRadius,
            burstDamage,
            stunChance
          });
          const burstHits = isLobsterPalm && !hits.length ? [{ cell: endCell, index: Math.max(0, path.length - 1) }] : hits;
          burstHits.forEach(hit => {
            projectiles.push({
              kind: "dragonOrbBurst",
              owner,
              profile: "big",
              source: { q: source.q, r: source.r },
              target: { q: hit.cell.q, r: hit.cell.r },
              visualType,
              hand,
              hidden: true,
              createdAt: now + volleyDelay,
              impactAt: now + volleyDelay + small.delay + (hit.index + 1) * orbStepMs,
              delay: small.delay + (hit.index + 1) * orbStepMs,
              radius: orbRadius,
              damage: orbDamage,
              burstRadius,
              burstDamage,
              stunChance
            });
          });
        }
        return travelDelay + (volleys - 1) * volleyIntervalMs;
      }

      if (character.id === "moray") {
        const lineOrigin = options.aimOrigin || target;
        const lineCells = boardLineThrough(lineOrigin, direction);
        const excludedCells = (owner === "player" ? snake : computerSnake).map(segment => ({ q: segment.q, r: segment.r }));
        projectiles.push({
          kind: "line",
          owner,
          profile: "big",
          source: { q: source.q, r: source.r },
          target: { q: target.q, r: target.r },
          lineCells,
          excludedCells,
          width: bandDistanceFromTotalWidth(small.radius),
          visualType: attackVisualType(owner, "big"),
          createdAt: now,
          impactAt: now + small.delay,
          delay: small.delay,
          damage: small.damage * 0.8 * ultimateDamageMultiplier(character.id),
          stunChance,
          stackStun: true
        });
        return small.delay;
      }

      if (character.id === "quetzal") {
        const trail = (owner === "player" ? snake : computerSnake).map(segment => ({ q: segment.q, r: segment.r }));
        const duration = 3000;
        const extensionDamageMultiplier = Math.max(0, Math.min(1, (stock.protein || 0) / maxFoodStock));
        const outwardWidth = extensionDamageMultiplier > 0 ? 1 : 0;
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
          damage: small.damage * ultimateDamageMultiplier(character.id),
          stunChance,
          startedAt: now + small.delay,
          nextTickAt: now + small.delay,
          tickMs: moveInterval(stock),
          endAt: now + small.delay + duration
        });
        return small.delay + duration;
      }

      if (character.id === "sandworm") {
        const delay = small.delay * 3;
        const undergroundFrom = now + Math.max(0, delay - sandwormUndergroundWindowMs);
        const undergroundUntil = now + delay + sandwormUndergroundWindowMs;
        if (owner === "player") {
          playerUndergroundFrom = undergroundFrom;
          playerUndergroundUntil = Math.max(playerUndergroundUntil, undergroundUntil);
        } else {
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
          damage: small.damage * 3.5 * ultimateDamageMultiplier(character.id),
          stunChance,
          hidden: true,
          sandwormHidden: true,
          sandwormParalyzeOnBody: true,
          sandwormKillOnHead: true
        });
        return delay;
      }

      if (abilityId === "lobster") {
        const lobsterUltimateRadius = character.id === "dragon"
          ? small.radius * 2
          : small.radius * ultimateSetting(abilityId, "radiusMultiplier", 2.5);
        const volleys = character.id === "dragon" ? 1 : 2;
        const impactDamage = character.id === "dragon" ? small.damage * 0.5 : small.damage;
        const radiationTotalDamage = character.id === "dragon" ? small.damage * 1.5 : small.damage * 0.25;
        const firstImpactDelay = character.id === "dragon" ? small.delay * 2 : small.delay;
        const visualType = character.id === "dragon" ? "dragon-spirit-big" : attackVisualType(owner, "big", abilityId);
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
            radius: lobsterUltimateRadius,
            damage: impactDamage,
            radiationDurationMs: 4000,
            radiationTickMs: 500,
            radiationTotalDamage,
            stunChance,
            flat: true,
            visualType
          });
        }
        return firstImpactDelay + (volleys - 1) * 2000;
      }

      if (character.id === "gu_king") {
        const volleyIntervalMs = small.delay;
        const firstImpactDelay = small.delay;
        for (let index = 0; index < 3; index += 1) {
          const impactDelay = firstImpactDelay + index * volleyIntervalMs;
          pushCircleAttack({
            owner,
            profile: "big",
            target,
            createdAt: now,
            impactAt: now + impactDelay,
            delay: impactDelay,
            radius: small.radius,
            damage: small.damage * ultimateDamageMultiplier(character.id),
            stunChance
          });
        }
        return firstImpactDelay + volleyIntervalMs * 2;
      }

      const big = attackStats(stock, "big");
      pushCircleAttack({ owner, profile: "big", target, createdAt: now, impactAt: now + big.delay, delay: big.delay, radius: big.radius, damage: big.damage * ultimateDamageMultiplier(character.id), stunChance });
      return big.delay;
    }

    function launchAttack(owner, target, now, profile = "big", options = {}) {
      const stock = owner === "player" ? playerStock : computerStock;
      const lastAttack = owner === "player" ? lastPlayerAttackMs : lastComputerAttackMs;
      const source = owner === "player" ? snake[0] : computerSnake[0];
      const character = characterFor(owner);
      const isSmall = profile === "small";
      if (!canAttack(owner, profile)) return false;
      if (now - lastAttack < attackCooldown(stock) * (isSmall ? smallAttackCooldownScale : 1)) return false;
      const stats = attackStats(stock, profile);
      const stunChance = attackStunChance(stock);
      consumeAttackCost(owner, stock, profile);
      if (owner === "player") {
        lastPlayerAttackMs = now;
        playerBombFlashUntil = now + 1200;
      } else {
        lastComputerAttackMs = now;
        computerBombFlashUntil = now + 1200;
      }
      HexSnakeAudio.playCharacter(owner, isSmall ? "small" : "big");
      const poseDuration = isSmall
        ? stats.delay
        : scheduleCharacterBigAttack(owner, character, source, target, now, stock, stunChance, options);
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
          stunChance
        });
      }
      setFighterPose(owner, "attack", Math.max(180, Math.min(poseDuration, 520)));
      showAttackCallout(owner, profile);
      updateHud();
      return true;
    }

    function maybeComputerAttack(now) {
      if (!computerCanUseAttack()) return;
      const profile = chooseAiAttackProfile("computer", now);
      if (!profile) return;
      const target = chooseAiAttackTarget("computer", profile, now);
      const computerCharacter = characterFor("computer");
      const options = profile === "big" ? {
        aimDirection: chooseAiAttackDirection("computer", target, now),
        aimOrigin: computerCharacter.id === "moray" ? target : computerSnake[0]
      } : {};
      if (launchAttack("computer", target, now, profile, options)) {
        setStatus(profile === "small" ? "P2 施放小招。" : "P2 施放大招，2 秒後落地。");
      }
    }

    function autoBattleAttackProfile(owner) {
      return chooseAiAttackProfile(owner, performance.now());
    }

    function autoBattleAttackTarget(owner, profile) {
      return chooseAiAttackTarget(owner, profile, performance.now());
    }

    function maybeAutoBattlePlayerAttack(now) {
      if (!isPlayerAutoControlActive() || isNoviceComputer()) return;
      const profile = chooseAiAttackProfile("player", now);
      if (!profile) return;
      const target = chooseAiAttackTarget("player", profile, now);
      const playerCharacter = characterFor("player");
      const options = profile === "big" ? {
        aimDirection: chooseAiAttackDirection("player", target, now),
        aimOrigin: playerCharacter.id === "moray" ? target : snake[0]
      } : {};
      if (launchAttack("player", target, now, profile, options)) flashAttackButton(profile, 150);
    }

    function damageSnake(parts, target, radius, damageScale) {
      const falloff = rangeDamageFalloffEnabled ? baseBlastHexRadius / Math.max(baseBlastHexRadius, radius) : 1;
      const wholeRadius = Math.floor(radius);
      const outerRingRatio = Math.max(0, Math.min(1, radius - wholeRadius));
      const outerRingDistance = wholeRadius + 1;
      return parts.reduce((total, segment) => {
        const distance = hexDistance(segment, target);
        if (distance > radius) {
          if (outerRingRatio > 0 && distance === outerRingDistance) {
            return total + damageScale * falloff * outerRingRatio;
          }
          return total;
        }
        const hitChance = Math.max(0, Math.min(1, 1 - distance / radius));
        return total + damageScale * falloff * hitChance;
      }, 0);
    }

    function damageSnakeFlat(parts, target, radius, damageScale) {
      return parts.reduce((total, segment) => (
        hexDistance(segment, target) <= radius ? total + damageScale : total
      ), 0);
    }

    function damageSnakeCells(parts, effectCells, width, damageScale, excludedCells = [], minDistance = 0, outerDamageMultiplier = 1) {
      const excluded = cellKeySet(excludedCells);
      return parts.reduce((total, segment) => {
        if (excluded.has(keyOf(segment))) return total;
        const bestMultiplier = effectCells.reduce((best, cell) => {
          const distance = hexDistance(segment, cell);
          if (distance < minDistance || distance > width) return best;
          return Math.max(best, distance === 0 ? 1 : outerDamageMultiplier);
        }, 0);
        return bestMultiplier > 0 ? total + damageScale * bestMultiplier : total;
      }, 0);
    }

    function snakeBodyHitAtCenter(parts, target) {
      return parts.slice(1).some(segment => keyOf(segment) === keyOf(target));
    }

    function snakeHeadHitAtCenter(parts, target) {
      return Boolean(parts[0] && keyOf(parts[0]) === keyOf(target));
    }

    function applyBlastDamage(owner, damage) {
      if (damage <= 0) return;
      if (owner === "player") {
        playerHp = Math.max(0, playerHp - damage);
      } else {
        computerHp = Math.max(0, computerHp - damage);
      }
    }

    function interruptCasting(owner) {
      projectiles = projectiles.filter(projectile => projectile.owner !== owner);
    }

    function applyAttackStun(owner, chance = baseAttackStunChance, now = performance.now(), options = {}) {
      if (Math.random() >= chance) return false;
      if (options.interrupt !== false) interruptCasting(owner);
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
      return true;
    }

    function applyCollisionPenalty(owner, severity = 1, now = performance.now()) {
      const stunUntil = now + collisionStunMs * severity;
      const slowUntil = stunUntil + collisionSlowMs * severity;
      if (owner === "player") {
        playerStunUntil = Math.max(playerStunUntil, stunUntil);
        playerSlowUntil = Math.max(playerSlowUntil, slowUntil);
        playerCollisionParalysisMs += collisionStunMs * severity;
        return playerCollisionParalysisMs > maxCollisionParalysisMs;
      } else {
        computerStunUntil = Math.max(computerStunUntil, stunUntil);
        computerSlowUntil = Math.max(computerSlowUntil, slowUntil);
        computerCollisionParalysisMs += collisionStunMs * severity;
        return computerCollisionParalysisMs > maxCollisionParalysisMs;
      }
    }

    function applyCollisionParalysis(owner, now = performance.now()) {
      const stunUntil = now + collisionStunMs;
      const slowUntil = stunUntil + collisionSlowMs;
      if (owner === "player") {
        playerStunUntil = Math.max(playerStunUntil, stunUntil);
        playerSlowUntil = Math.max(playerSlowUntil, slowUntil);
      } else {
        computerStunUntil = Math.max(computerStunUntil, stunUntil);
        computerSlowUntil = Math.max(computerSlowUntil, slowUntil);
      }
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
        if (projectile.kind === "dragonOrb") {
          return;
        } else if (projectile.kind === "dragonOrbBurst") {
          const defenderOwner = projectile.owner === "player" ? "computer" : "player";
          const defenderSnake = defenderOwner === "player" ? snake : computerSnake;
          const orbDamage = damageSnake(defenderSnake, projectile.target, projectile.radius, projectile.damage);
          if (defenderOwner === "player") playerDamage += orbDamage;
          else computerDamage += orbDamage;
          playerDamage += damageSnake(snake, projectile.target, projectile.burstRadius, projectile.burstDamage);
          computerDamage += damageSnake(computerSnake, projectile.target, projectile.burstRadius, projectile.burstDamage);
          blasts.push({
            kind: "circle",
            target: projectile.target,
            owner: projectile.owner,
            radius: projectile.burstRadius,
            visualType: burstVisualType(projectile),
            hand: projectile.hand,
            startedAt: now,
            endAt: now + blastDurationMs * 1.25
          });
          triggerBoardShake(burstVisualType(projectile), now);
        } else if (projectile.kind === "line") {
          playerDamage = damageSnakeCells(snake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells);
          computerDamage = damageSnakeCells(computerSnake, projectile.lineCells, projectile.width, projectile.damage, projectile.excludedCells);
          blasts.push({
            kind: "line",
            lineCells: projectile.lineCells,
            excludedCells: projectile.excludedCells,
            width: projectile.width,
            target: projectile.target,
            owner: projectile.owner,
            visualType: projectile.visualType || attackVisualType(projectile.owner, projectile.profile),
            startedAt: now,
            endAt: now + blastDurationMs
          });
          triggerBoardShake(projectile.visualType || attackVisualType(projectile.owner, projectile.profile), now);
        } else {
          if (projectile.kind === "headCircle" && projectile.followHead) {
            const head = ownerHead(projectile.owner);
            projectile.explosionTarget = { q: head.q, r: head.r };
            projectile.target = { q: projectile.explosionTarget.q, r: projectile.explosionTarget.r };
          }
          const explosionTarget = projectile.explosionTarget || projectile.target;
          const radius = projectile.radius || baseBlastHexRadius;
          const damage = projectile.damage || 1;
          const damageFn = projectile.flat ? damageSnakeFlat : damageSnake;
          playerDamage = damageFn(snake, explosionTarget, radius, damage);
          computerDamage = damageFn(computerSnake, explosionTarget, radius, damage);
          blasts.push({
            kind: "circle",
            target: explosionTarget,
            owner: projectile.owner,
            radius,
            visualType: projectile.visualType || attackVisualType(projectile.owner, projectile.profile),
            hand: projectile.hand,
            startedAt: now,
            endAt: now + blastDurationMs
          });
          triggerBoardShake(projectile.visualType || attackVisualType(projectile.owner, projectile.profile), now);
          if (projectile.kind === "headCircle" && projectile.radiationDurationMs) {
            const ticks = Math.max(1, Math.ceil(projectile.radiationDurationMs / projectile.radiationTickMs));
            hazards.push({
              kind: "radiation",
              owner: projectile.owner,
              target: { q: explosionTarget.q, r: explosionTarget.r },
              radius,
              width: radius,
              visualType: projectile.visualType === "dragon-spirit-big" ? "dragon-spirit-radiation" : "lobster-radiation",
              damage: projectile.radiationTotalDamage / ticks,
              stunChance: projectile.stunChance,
              startedAt: now,
              nextTickAt: now + projectile.radiationTickMs,
              tickMs: projectile.radiationTickMs,
              endAt: now + projectile.radiationDurationMs
            });
          }
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
        applyBlastDamage("player", playerDamage);
        applyBlastDamage("computer", computerDamage);
        if (projectile.owner !== "player" && playerDamage > 0) applyAttackStun("player", projectile.stunChance, now, { stack: projectile.stackStun });
        if (projectile.owner !== "computer" && computerDamage > 0) applyAttackStun("computer", projectile.stunChance, now, { stack: projectile.stackStun });
      });
      blasts = blasts.filter(blast => now <= blast.endAt);
      if (playerHp <= 0 || computerHp <= 0) endGame(playerHp <= 0, computerHp <= 0);
    }

    function addProjectileImpactVisual(projectile, now) {
      if (projectile.kind === "dragonOrb") return;
      if (projectile.kind === "dragonOrbBurst") {
        blasts.push({
          kind: "circle",
          target: projectile.target,
          owner: projectile.owner,
          radius: projectile.burstRadius,
          visualType: burstVisualType(projectile),
          hand: projectile.hand,
          startedAt: now,
          endAt: now + blastDurationMs * 1.25
        });
        triggerBoardShake(burstVisualType(projectile), now);
        return;
      }
      if (projectile.kind === "line") {
        blasts.push({
          kind: "line",
          lineCells: projectile.lineCells,
          excludedCells: projectile.excludedCells,
          width: projectile.width,
          target: projectile.target,
          owner: projectile.owner,
          visualType: projectile.visualType || attackVisualType(projectile.owner, projectile.profile),
          startedAt: now,
          endAt: now + blastDurationMs
        });
        triggerBoardShake(projectile.visualType || attackVisualType(projectile.owner, projectile.profile), now);
        return;
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
          damage: 0,
          stunChance: projectile.stunChance,
          startedAt: now,
          nextTickAt: now + projectile.radiationTickMs,
          tickMs: projectile.radiationTickMs,
          endAt: now + projectile.radiationDurationMs
        });
      }
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
      if (!gameOver || running || replayMode) return;
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
          : damageSnakeCells(snake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "player" ? damageExcludedCells : [], hazard.minDistance || 0, hazard.outerDamageMultiplier ?? 1);
        let computerDamage = hazard.kind === "radiation"
          ? damageSnake(computerSnake, hazard.target, hazard.radius, hazard.damage)
          : damageSnakeCells(computerSnake, hazard.cells, hazard.width, hazard.damage, hazard.owner === "computer" ? damageExcludedCells : [], hazard.minDistance || 0, hazard.outerDamageMultiplier ?? 1);
        if (hazard.owner === "player") playerDamage = 0;
        if (hazard.owner === "computer") computerDamage = 0;
        applyBlastDamage("player", playerDamage);
        applyBlastDamage("computer", computerDamage);
        if (hazard.owner !== "player" && playerDamage > 0) applyAttackStun("player", hazard.stunChance, now, { interrupt: false });
        if (hazard.owner !== "computer" && computerDamage > 0) applyAttackStun("computer", hazard.stunChance, now, { interrupt: false });
      });
      if (playerHp <= 0 || computerHp <= 0) endGame(playerHp <= 0, computerHp <= 0);
    }

    function step(headCollisionOrder = "simultaneous") {
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

      if (!playerCollision) {
        snake.unshift(next);
      }
      if (!computerCollision) {
        computerSnake.unshift(computerNext);
      }

      if (!playerCollision && eating) {
        score += 1;
        collectFood("player", eatenFood);
        best = Math.max(best, score);
        localStorage.setItem("hexSnakeBest", String(best));
        lastFeedElapsedMs = 0;
        lastPlayerFoodAt = performance.now();
        playerFoodTargetKey = null;
        playerFoodTargetAt = 0;
        playerHp = Math.min(snake.length * 2, playerHp + 1);
      } else if (!playerCollision) {
        snake.pop();
      }

      if (!computerCollision && computerEating) {
        computerScore += 1;
        lastComputerFoodAt = performance.now();
        computerFoodTargetKey = null;
        computerFoodTargetAt = 0;
        if (computerCanGrow()) {
          collectFood("computer", computerEatenFood);
          computerHp = Math.min(computerSnake.length * 2, computerHp + 1);
        } else {
          computerSnake.pop();
        }
      } else if (!computerCollision) {
        computerSnake.pop();
      }

      if (eating || computerEating) {
        const eatenKeys = new Set([
          !playerCollision && eating ? nextKey : null,
          !computerCollision && computerEating ? computerNextKey : null
        ].filter(Boolean));
        foods = foods.filter(food => !eatenKeys.has(keyOf(food)));
        placeFoods([
          !playerCollision && eating ? "player" : null,
          !computerCollision && computerEating ? "computer" : null
        ].filter(Boolean));
      }

      updateHud();
    }

    function stepPlayerOnly() {
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

      snake.unshift(next);
      if (eating) {
        score += 1;
        collectFood("player", eatenFood);
        best = Math.max(best, score);
        localStorage.setItem("hexSnakeBest", String(best));
        lastFeedElapsedMs = 0;
        lastPlayerFoodAt = performance.now();
        playerFoodTargetKey = null;
        playerFoodTargetAt = 0;
        playerHp = Math.min(snake.length * 2, playerHp + 1);
        foods = foods.filter(food => keyOf(food) !== nextKey);
        placeFoods(["player"]);
      } else {
        snake.pop();
      }
      updateHud();
    }

    function stepComputerOnly() {
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

      computerSnake.unshift(computerNext);
      if (computerEating) {
        computerScore += 1;
        lastComputerFoodAt = performance.now();
        computerFoodTargetKey = null;
        computerFoodTargetAt = 0;
        if (computerCanGrow()) {
          collectFood("computer", computerEatenFood);
          computerHp = Math.min(computerSnake.length * 2, computerHp + 1);
        } else {
          computerSnake.pop();
        }
        foods = foods.filter(food => keyOf(food) !== computerNextKey);
        placeFoods(["computer"]);
      } else {
        computerSnake.pop();
      }
      updateHud();
    }

    function endGame(playerLost = true, computerLost = false) {
      if (gameOver) return;
      clearGameOverSettlementTimer();
      const shouldContinueRelay = relayMode && (computerBattleMode || playerAutoMode);
      const nextRelayStartOptions = computerBattleMode
        ? { computerBattle: true }
        : { playerAuto: true };
      const gameOverAt = performance.now();
      finishReplayRecording(playerLost, computerLost);
      running = false;
      playerAutoMode = false;
      computerBattleManualOverride = false;
      gameOver = true;
      gameOverContinuousVisualDeadlineAt = gameOverAt + gameOverContinuousVisualMaxWaitMs;
      updateAutoBattleControls();
      restartUnlockAt = gameOverAt + gameOverRestartDelayMs;
      setSettingsLocked(false);
      if (totalElapsedMs > bestTotalMs) {
        bestTotalMs = totalElapsedMs;
        localStorage.setItem("hexSnakeBestTotalMs", String(Math.floor(bestTotalMs)));
      }
      updateHud();
      let title = "P1 獲勝";
      if (playerLost && !computerLost) title = "P2 獲勝";
      if (playerLost && computerLost) {
        if (score > computerScore) title = "P1 獲勝";
        else if (computerScore > score) title = "P2 獲勝";
        else title = "平手";
      }
      setStatus(`對戰結束：${title}`);
      overlayTitle.textContent = title;
      const winnerOwner = (!playerLost && computerLost) || (playerLost && computerLost && score > computerScore)
        ? "player"
        : (playerLost && !computerLost) || (playerLost && computerLost && computerScore > score)
          ? "computer"
          : null;
      const resultText = winnerOwner === "player" ? "P1獲勝" : winnerOwner === "computer" ? "P2獲勝" : "平手";
      const resultTitleHtml = winnerOwner === "player"
        ? `<span class="owner-name is-p1">P1</span>獲勝！ <span class="owner-name is-p1">P1</span>:<span class="owner-name is-p2">P2</span> = ${score}:${computerScore}`
        : winnerOwner === "computer"
          ? `<span class="owner-name is-p2">P2</span>獲勝！ <span class="owner-name is-p1">P1</span>:<span class="owner-name is-p2">P2</span> = ${score}:${computerScore}`
          : `平手！ <span class="owner-name is-p1">P1</span>:<span class="owner-name is-p2">P2</span> = ${score}:${computerScore}`;
      overlayTitle.innerHTML = resultTitleHtml;
      HexSnakeAudio.playCharacter("player", winnerOwner === "player" ? "victory" : "defeat", { gainScale: winnerOwner ? 1 : 0.82 });
      HexSnakeAudio.playCharacter("computer", winnerOwner === "computer" ? "victory" : "defeat", { delay: winnerOwner ? 0.08 : 0.12, gainScale: winnerOwner ? 1 : 0.82 });
      if (shouldContinueRelay) {
        if (winnerOwner === "player") relayPlayerWins += 1;
        else if (winnerOwner === "computer") relayComputerWins += 1;
        else relayDraws += 1;
        updateRelayControls();
      }
      renderWinnerPortrait(winnerOwner, playerLost, computerLost);
      overlayText.textContent = shouldContinueRelay
        ? `P1 ${score} 分，P2 ${computerScore} 分。接力賽：P1 ${relayPlayerWins} 勝，P2 ${relayComputerWins} 勝，平手 ${relayDraws}。`
        : `P1 ${score} 分，P2 ${computerScore} 分。按開始再來一局。`;
      startButton.textContent = "重新開始";
      gameOverSettlementPending = true;
      gameOverRelayStartOptions = shouldContinueRelay ? nextRelayStartOptions : null;
      const gameScoreText = `${resultText}！ P1:P2 = ${score}:${computerScore}`;
      overlayText.textContent = shouldContinueRelay
        ? `${gameScoreText}。接力賽：P1 ${relayPlayerWins} 勝，P2 ${relayComputerWins} 勝，平手 ${relayDraws}。`
        : gameScoreText;
      overlayText.hidden = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    }

    function loop(now) {
      if (!running) {
        const visualsActive = gameOverSettlementPending && advanceGameOverVisuals(now || performance.now());
        draw();
        if (visualsActive) {
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
        resolveProjectiles(now);
        resolveHazards(now);
        updateAiVisibilityMemory(now);
        maybeAutoBattlePlayerAttack(now);
        maybeComputerAttack(now);
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
          step(headCollisionOrder);
          lastPlayerStep = now;
          lastComputerStep = now;
        } else if (playerDue) {
          stepPlayerOnly();
          lastPlayerStep = now;
        } else if (computerDue) {
          stepComputerOnly();
          lastComputerStep = now;
        }
      }
      blasts = blasts.filter(blast => now <= blast.endAt);
      hazards = hazards.filter(hazard => now <= hazard.endAt);
      updateHud();
      recordReplaySnapshot(now);
      updateAutoBattleControls();
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function comparisonLoop(now) {
      drawEffectComparisonBoard(now);
      rafId = requestAnimationFrame(comparisonLoop);
    }

    function draw() {
      if (isEffectComparisonMode()) {
        drawEffectComparisonBoard(performance.now());
        return;
      }
      const now = performance.now();
      const rect = playArea.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#111720";
      ctx.fillRect(0, 0, rect.width, rect.height);
      const shake = boardShakeOffset(now);
      ctx.save();
      ctx.translate(shake.x, shake.y);
      drawElementalBackdrop(now);

      cells.forEach(cell => {
        const { x, y } = axialToPixel(cell);
        const shade = (cell.q - cell.r + radius) % 2 === 0 ? colors.cell : colors.cellAlt;
        hexPath(x, y, cellSize * 0.94);
        ctx.fillStyle = shade;
        ctx.fill();
        ctx.strokeStyle = colors.cellLine;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      foods.forEach(food => {
        const type = foodTypeIds(food).map(typeId => foodTypeById.get(typeId)).filter(Boolean);
        const { x, y } = axialToPixel(food);
        drawFoodToken(x, y, type);
      });

      drawProjectiles();
      drawDirectionalAttackPreview(now);
      drawTarget();
      drawHazards();
      drawQuetzalBloomPreview(now);
      drawBlasts();

      if (computerSnake) {
        const computerCharacter = characterFor("computer");
        drawSnake(computerSnake, {
          head: computerCharacter.color,
          body: computerCharacter.body,
          headLine: computerCharacter.line,
          bodyLine: colors.computerBodyLine,
          ownerColor: colors.computerHead,
          ownerLine: colors.computerHeadLine,
          character: computerCharacter,
          owner: "computer",
          direction: computerDir,
          alpha: sandwormUndergroundAlpha("computer", now)
        });
      }

      if (snake) {
        const playerCharacter = characterFor("player");
        drawSnake(snake, {
          head: playerCharacter.color,
          body: playerCharacter.body,
          headLine: playerCharacter.line,
          bodyLine: colors.bodyLine,
          ownerColor: colors.head,
          ownerLine: colors.headLine,
          character: playerCharacter,
          owner: "player",
          direction: dir,
          alpha: sandwormUndergroundAlpha("player", now)
        });
      }

      drawStatusEffects(now);
      ctx.restore();
    }

    function waveValue(progress, offset = 0) {
      return (Math.sin((progress + offset) * Math.PI * 2) + 1) / 2;
    }

    function triggerBoardShake(visualType = "", now = performance.now()) {
      if (!visualType.endsWith("-big") && !visualType.endsWith("-burst")) return;
      const characterId = visualType.split("-")[0];
      const presets = {
        dragon: { strength: visualType.endsWith("-burst") ? 9.6 : 6.2, duration: visualType.endsWith("-burst") ? 760 : 520, frequency: 1.2, style: "impact" },
        moray: { strength: 5.8, duration: 700, frequency: 5.6, style: "electric" },
        lobster: { strength: 10.8, duration: 860, frequency: 1.05, style: "impact" },
        gu_king: { strength: 6.2, duration: 860, frequency: 2.8, style: "vortex" },
        sandworm: { strength: 8.8, duration: 820, frequency: 1.55, style: "rumble" },
        quetzal: { strength: 5.4, duration: 820, frequency: 1.8, style: "growth" }
      };
      const preset = presets[characterId] || { strength: 4.6, duration: 520, frequency: 1.4, style: "impact" };
      boardShakeStartedAt = now;
      boardShakeUntil = Math.max(boardShakeUntil, now + preset.duration);
      boardShakeStrength = Math.max(boardShakeStrength, preset.strength);
      boardShakeFrequency = preset.frequency;
      boardShakeStyle = preset.style;
    }

    function boardShakeOffset(now) {
      if (now >= boardShakeUntil || !boardShakeStrength) {
        boardShakeStrength = 0;
        return { x: 0, y: 0 };
      }
      const duration = Math.max(1, boardShakeUntil - boardShakeStartedAt);
      const progress = Math.min(1, Math.max(0, (now - boardShakeStartedAt) / duration));
      const decay = Math.pow(1 - progress, boardShakeStyle === "electric" ? 0.62 : 1.15);
      const t = now / 34 * boardShakeFrequency;
      if (boardShakeStyle === "electric") {
        return {
          x: Math.sin(t * 3.1) * boardShakeStrength * decay,
          y: Math.sign(Math.sin(t * 7.3)) * boardShakeStrength * 0.42 * decay
        };
      }
      if (boardShakeStyle === "vortex") {
        return {
          x: Math.cos(t * 1.7 + progress * Math.PI * 4) * boardShakeStrength * decay,
          y: Math.sin(t * 1.3 + progress * Math.PI * 4) * boardShakeStrength * 0.74 * decay
        };
      }
      if (boardShakeStyle === "growth") {
        return {
          x: Math.sin(t * 1.4) * boardShakeStrength * 0.44 * decay,
          y: -Math.abs(Math.cos(t * 1.8)) * boardShakeStrength * decay
        };
      }
      return {
        x: Math.sin(t * 2.4) * boardShakeStrength * decay,
        y: Math.cos(t * 1.7) * boardShakeStrength * 0.72 * decay
      };
    }

    function elementColorsFor(character) {
      if (character.id === "dragon") return { primary: "#f8fafc", secondary: "#fbbf24", glow: "#fde68a", hot: "#ffffff", deep: "#bae6fd", palette: ["#ffffff", "#f8fafc", "#fef3c7", "#fbbf24", "#bae6fd"] };
      if (character.id === "sandworm") return { primary: "#facc15", secondary: "#92400e", glow: "#fef08a", hot: "#fde68a", deep: "#78350f", dust: "#d6a35c", palette: ["#fef08a", "#facc15", "#d97706", "#92400e", "#4a2a12"] };
      if (character.id === "quetzal") return { primary: "#22c55e", secondary: "#67e8f9", glow: "#bbf7d0", hot: "#f0fdfa", deep: "#15803d", mud: "#6b4423", palette: ["#f0fdfa", "#bbf7d0", "#22c55e", "#67e8f9", "#6b4423"] };
      if (character.id === "moray") return { primary: "#1d4ed8", secondary: "#60a5fa", glow: "#bfdbfe", hot: "#ffffff", deep: "#172554", violet: "#8b5cf6", palette: ["#1d4ed8", "#2563eb", "#60a5fa", "#ffffff", "#93c5fd", "#8b5cf6", "#7c3aed"] };
      if (character.id === "lobster") return { primary: "#ef4444", secondary: "#f97316", glow: "#fecaca", hot: "#fff7ed", deep: "#7f1d1d", palette: ["#fff7ed", "#fecaca", "#f97316", "#ef4444", "#7f1d1d"] };
      if (character.id === "gu_king") return { primary: "#050505", secondary: "#7f1d1d", glow: "#064e3b", hot: "#6d28d9", deep: "#020617", bruise: "#312e81", palette: ["#050505", "#7f1d1d", "#064e3b", "#312e81", "#1f2937"] };
      return { primary: character.accent || character.color, secondary: character.line, glow: character.line, hot: "#ffffff", deep: character.color, palette: ["#ffffff", character.accent || character.color, character.line, character.color] };
    }

    function paletteColor(character, index) {
      const element = elementColorsFor(character);
      return element.palette[index % element.palette.length];
    }

    function clamp01(value) {
      return Math.max(0, Math.min(1, value));
    }

    function stableUnitSeed(...parts) {
      let hash = 2166136261;
      parts.join("|").split("").forEach(char => {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
      });
      return (hash >>> 0) / 4294967295;
    }

    function spriteMotifsFor(character) {
      if (character.id === "dragon") return ["cloud", "crystal", "rune", "scale"];
      if (character.id === "sandworm") return ["dust", "crack", "stone", "spiral"];
      if (character.id === "quetzal") return ["leaf", "petal", "vine", "feather"];
      if (character.id === "moray") return ["water", "spark", "bubble", "current"];
      if (character.id === "lobster") return ["flame", "ember", "palm", "smoke"];
      if (character.id === "gu_king") return ["poison", "insect", "sigil", "miasma"];
      return ["spark", "rune", "mist"];
    }

    function visualLoadScale() {
      const mobileScale = mobileInputQuery.matches ? 0.72 : 1;
      const boardScale = cells.length > 240 ? 0.82 : 1;
      return mobileScale * boardScale;
    }

    function effectVisualPlanFor(visualType = "", phase = "impact", character = null) {
      const id = typeof visualType === "string" ? visualType.split("-")[0] : character?.id;
      const isSmall = typeof visualType === "string" && visualType.endsWith("-small");
      const base = {
        textureAlpha: isSmall ? 0.38 : 0.58,
        perCell: isSmall ? 0.9 : 1.35,
        maxParticles: isSmall ? 42 : 88,
        density: isSmall ? 10 : 18,
        size: isSmall ? 0.72 : 0.96,
        spin: 0.72,
        drift: 0.28,
        ellipse: 0.82,
        persistent: phase === "hazard"
      };
      if (id === "moray") return { ...base, textureAlpha: phase === "line" ? 0.72 : 0.6, perCell: 1.8, maxParticles: 118, density: 18, size: 0.9, spin: 1.15, drift: 0.2 };
      if (id === "quetzal") return { ...base, textureAlpha: phase === "hazard" ? 0.66 : 0.6, perCell: phase === "hazard" ? 1.52 : 1.25, maxParticles: phase === "hazard" ? 145 : 96, density: 20, size: 0.94, spin: 0.38, drift: 0.16, persistent: phase === "hazard" };
      if (id === "sandworm") return { ...base, textureAlpha: phase === "warning" ? 0.72 : 0.62, perCell: 1.28, maxParticles: 96, density: 22, size: 0.98, spin: 0.45, drift: 0.08, ellipse: 0.54 };
      if (id === "dragon" || visualType.startsWith("dragon-spirit")) return { ...base, textureAlpha: phase === "path" ? 0.54 : 0.66, perCell: 1.25, maxParticles: 108, density: 24, size: 1.04, spin: 0.82, drift: 0.24 };
      if (id === "lobster" || visualType.startsWith("lobster-palm")) return { ...base, textureAlpha: phase === "radiation" ? 0.58 : 0.68, perCell: 1.42, maxParticles: 124, density: 22, size: 1.02, spin: 0.76, drift: 0.18 };
      if (id === "gu_king") return { ...base, textureAlpha: 0.72, perCell: 1.56, maxParticles: 132, density: 26, size: 0.98, spin: 1.7, drift: 0.12 };
      return base;
    }

    function createElementalSprite(character, motif) {
      const key = `${character.id}:${motif}`;
      if (elementalSpriteCache.has(key)) return elementalSpriteCache.get(key);
      const sprite = document.createElement("canvas");
      const size = 96;
      sprite.width = size;
      sprite.height = size;
      const sctx = sprite.getContext("2d");
      const cx = size / 2;
      const cy = size / 2;
      const element = elementColorsFor(character);
      const color = element.primary;
      const secondary = element.secondary;
      const glow = element.glow;
      sctx.lineCap = "round";
      sctx.lineJoin = "round";
      const gradient = sctx.createRadialGradient(cx, cy, 2, cx, cy, size * 0.46);
      gradient.addColorStop(0, hexToRgba(glow, 0.52));
      gradient.addColorStop(0.52, hexToRgba(color, 0.22));
      gradient.addColorStop(1, hexToRgba(element.deep, 0));
      sctx.fillStyle = gradient;
      sctx.beginPath();
      sctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
      sctx.fill();

      sctx.strokeStyle = hexToRgba(secondary, 0.9);
      sctx.fillStyle = hexToRgba(color, 0.82);
      sctx.lineWidth = 5;
      if (motif === "leaf" || motif === "feather") {
        sctx.beginPath();
        sctx.moveTo(cx, cy + 34);
        sctx.bezierCurveTo(cx - 34, cy + 8, cx - 24, cy - 32, cx, cy - 38);
        sctx.bezierCurveTo(cx + 28, cy - 24, cx + 30, cy + 14, cx, cy + 34);
        sctx.fill();
        sctx.stroke();
        sctx.strokeStyle = hexToRgba(glow, 0.78);
        sctx.lineWidth = 3;
        sctx.beginPath();
        sctx.moveTo(cx, cy + 28);
        sctx.lineTo(cx + 6, cy - 28);
        sctx.stroke();
      } else if (motif === "petal") {
        for (let i = 0; i < 5; i += 1) {
          const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
          sctx.save();
          sctx.translate(cx + Math.cos(angle) * 11, cy + Math.sin(angle) * 10);
          sctx.rotate(angle);
          sctx.beginPath();
          sctx.ellipse(0, -16, 10, 25, 0, 0, Math.PI * 2);
          sctx.fill();
          sctx.stroke();
          sctx.restore();
        }
      } else if (motif === "crystal" || motif === "stone" || motif === "scale") {
        sctx.beginPath();
        sctx.moveTo(cx, cy - 38);
        sctx.lineTo(cx + 28, cy - 8);
        sctx.lineTo(cx + 15, cy + 36);
        sctx.lineTo(cx - 18, cy + 30);
        sctx.lineTo(cx - 30, cy - 7);
        sctx.closePath();
        sctx.fill();
        sctx.stroke();
        sctx.strokeStyle = hexToRgba(glow, 0.78);
        sctx.lineWidth = 3;
        sctx.beginPath();
        sctx.moveTo(cx, cy - 32);
        sctx.lineTo(cx - 4, cy + 24);
        sctx.lineTo(cx + 20, cy - 7);
        sctx.stroke();
      } else if (motif === "flame" || motif === "ember") {
        sctx.fillStyle = hexToRgba(secondary, 0.86);
        sctx.beginPath();
        sctx.moveTo(cx, cy + 36);
        sctx.bezierCurveTo(cx - 32, cy + 8, cx - 4, cy - 18, cx - 6, cy - 40);
        sctx.bezierCurveTo(cx + 26, cy - 8, cx + 32, cy + 15, cx, cy + 36);
        sctx.fill();
        sctx.fillStyle = hexToRgba(glow, 0.76);
        sctx.beginPath();
        sctx.moveTo(cx + 2, cy + 24);
        sctx.bezierCurveTo(cx - 10, cy + 4, cx + 7, cy - 8, cx + 6, cy - 26);
        sctx.bezierCurveTo(cx + 22, cy - 2, cx + 20, cy + 14, cx + 2, cy + 24);
        sctx.fill();
      } else if (motif === "water" || motif === "current" || motif === "cloud" || motif === "smoke" || motif === "miasma") {
        sctx.strokeStyle = hexToRgba(glow, 0.8);
        sctx.lineWidth = 7;
        for (let i = 0; i < 3; i += 1) {
          const y = cy - 18 + i * 18;
          sctx.beginPath();
          sctx.moveTo(cx - 34, y);
          sctx.bezierCurveTo(cx - 16, y - 18, cx + 10, y + 18, cx + 34, y - 2);
          sctx.stroke();
        }
      } else if (motif === "crack" || motif === "spark") {
        sctx.strokeStyle = hexToRgba(glow, 0.94);
        sctx.lineWidth = 6;
        sctx.beginPath();
        sctx.moveTo(cx - 18, cy - 35);
        sctx.lineTo(cx + 4, cy - 8);
        sctx.lineTo(cx - 8, cy - 4);
        sctx.lineTo(cx + 20, cy + 35);
        sctx.stroke();
      } else if (motif === "insect") {
        sctx.fillStyle = hexToRgba(secondary, 0.84);
        sctx.beginPath();
        sctx.ellipse(cx, cy, 13, 24, 0, 0, Math.PI * 2);
        sctx.fill();
        sctx.stroke();
        for (let i = -1; i <= 1; i += 1) {
          sctx.beginPath();
          sctx.moveTo(cx - 8, cy + i * 9);
          sctx.lineTo(cx - 32, cy + i * 15);
          sctx.moveTo(cx + 8, cy + i * 9);
          sctx.lineTo(cx + 32, cy + i * 15);
          sctx.stroke();
        }
      } else {
        sctx.strokeStyle = hexToRgba(glow, 0.84);
        sctx.lineWidth = 5;
        sctx.beginPath();
        sctx.arc(cx, cy, 28, 0, Math.PI * 2);
        sctx.stroke();
        sctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = i * Math.PI * 2 / 6;
          const px = cx + Math.cos(angle) * 31;
          const py = cy + Math.sin(angle) * 31;
          if (i === 0) sctx.moveTo(px, py);
          else sctx.lineTo(px, py);
        }
        sctx.closePath();
        sctx.stroke();
      }
      elementalSpriteCache.set(key, sprite);
      return sprite;
    }

    function drawElementSprite(x, y, size, angle, character, motif, alpha = 1, blend = "lighter") {
      const sprite = createElementalSprite(character, motif);
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.globalCompositeOperation = blend;
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    function drawElementTextureParticles(cellsForEffect, character, progress, alpha = 1, options = {}) {
      if (!cellsForEffect?.length) return;
      const motifs = spriteMotifsFor(character);
      const perCell = options.perCell ?? 1.25;
      const maxParticles = Math.max(8, Math.floor((options.maxParticles ?? 96) * visualLoadScale()));
      const count = Math.min(maxParticles, Math.max(8, Math.floor(cellsForEffect.length * perCell)));
      const seed = options.seed ?? 0;
      for (let i = 0; i < count; i += 1) {
        const cell = cellsForEffect[Math.floor(stableUnitSeed(seed, i, "cell") * cellsForEffect.length) % cellsForEffect.length];
        const base = axialToPixel(cell);
        const jitterRadius = cellSize * (options.jitter ?? 0.72);
        const jitterAngle = stableUnitSeed(seed, i, "angle") * Math.PI * 2;
        const drift = (progress - 0.5) * cellSize * (options.drift ?? 0.34);
        const x = base.x + Math.cos(jitterAngle) * jitterRadius * stableUnitSeed(seed, i, "jx");
        const y = base.y + Math.sin(jitterAngle) * jitterRadius * stableUnitSeed(seed, i, "jy") - drift;
        const motif = motifs[(i + Math.floor(stableUnitSeed(seed, i, "motif") * motifs.length)) % motifs.length];
        const pulse = 0.76 + waveValue(progress, stableUnitSeed(seed, i, "pulse")) * 0.42;
        const size = cellSize * (options.size ?? 0.86) * (0.68 + stableUnitSeed(seed, i, "size") * 0.72) * pulse;
        const fade = options.persistent ? 1 : Math.sin(clamp01(progress) * Math.PI);
        drawElementSprite(x, y, size, jitterAngle + progress * Math.PI * (options.spin ?? 0.7), character, motif, alpha * fade * (0.34 + stableUnitSeed(seed, i, "alpha") * 0.5));
      }
    }

    function drawElementCellTextureWash(cellsForEffect, character, progress, alpha = 1, options = {}) {
      if (!cellsForEffect?.length) return;
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = options.blend || "lighter";
      cellsForEffect.forEach((cell, index) => {
        const { x, y } = axialToPixel(cell);
        const local = (progress + index * 0.037) % 1;
        const radiusPx = cellSize * (options.radiusScale ?? 0.96);
        const gradient = ctx.createRadialGradient(x, y, radiusPx * 0.08, x, y, radiusPx);
        gradient.addColorStop(0, hexToRgba(element.glow, 0.2 * alpha));
        gradient.addColorStop(0.46, hexToRgba(element.primary, 0.15 * alpha));
        gradient.addColorStop(1, hexToRgba(element.deep, 0));
        hexPath(x, y, cellSize * 0.96);
        ctx.fillStyle = gradient;
        ctx.fill();
        if (index % 2 === 0) {
          const motif = spriteMotifsFor(character)[stableVariantIndex(cell, index + Math.floor(local * 100), spriteMotifsFor(character).length)];
          const angle = local * Math.PI * 2 + index;
          drawElementSprite(x, y, cellSize * 1.24, angle, character, motif, alpha * 0.2, "source-over");
        }
      });
      ctx.restore();
      drawElementTextureParticles(cellsForEffect, character, progress, alpha, options);
    }

    function drawElementCircleTexture(x, y, radiusPx, progress, character, alpha = 1, options = {}) {
      const motifs = spriteMotifsFor(character);
      const maxParticles = Math.max(16, Math.floor((options.maxParticles ?? 120) * visualLoadScale()));
      const count = Math.min(maxParticles, Math.max(16, Math.floor(radiusPx / Math.max(1, cellSize) * (options.density ?? 18))));
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gradient = ctx.createRadialGradient(x, y, radiusPx * 0.05, x, y, radiusPx * 1.12);
      gradient.addColorStop(0, hexToRgba(element.hot, 0.14 * alpha));
      gradient.addColorStop(0.45, hexToRgba(element.primary, 0.1 * alpha));
      gradient.addColorStop(1, hexToRgba(element.deep, 0));
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * 1.12, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();
      for (let i = 0; i < count; i += 1) {
        const seed = options.seed ?? character.id;
        const angle = stableUnitSeed(seed, i, "circle-angle") * Math.PI * 2 + progress * Math.PI * (options.spin ?? 0.9);
        const distance = radiusPx * Math.sqrt(stableUnitSeed(seed, i, "circle-distance")) * (0.18 + 0.92 * clamp01(progress + 0.12));
        const orbit = angle + Math.sin(progress * Math.PI * 2 + i) * 0.22;
        const px = x + Math.cos(orbit) * distance;
        const py = y + Math.sin(orbit) * distance * (options.ellipse ?? 0.82);
        const motif = motifs[i % motifs.length];
        const size = cellSize * (options.size ?? 1.05) * (0.72 + stableUnitSeed(seed, i, "circle-size") * 0.88);
        const fade = Math.sin(clamp01(progress) * Math.PI);
        drawElementSprite(px, py, size, orbit + progress * Math.PI * 2, character, motif, alpha * fade * (0.32 + stableUnitSeed(seed, i, "circle-alpha") * 0.58));
      }
    }

    function drawPathTextureTrail(source, pathCells, progress, character, options = {}) {
      const cellsOnPath = [source, ...(pathCells || [])].filter(Boolean);
      if (cellsOnPath.length < 2) return;
      const visibleCount = Math.max(2, Math.ceil(cellsOnPath.length * clamp01(progress)));
      const visibleCells = cellsOnPath.slice(0, visibleCount);
      const plan = effectVisualPlanFor(options.visualType || character.id, "path", character);
      drawElementCellTextureWash(visibleCells, character, progress, plan.textureAlpha * (options.alpha ?? 1), {
        seed: `${options.visualType || character.id}:${options.seed || 0}:path`,
        maxParticles: Math.min(plan.maxParticles, 72),
        perCell: plan.perCell,
        size: plan.size,
        spin: plan.spin,
        drift: plan.drift
      });
    }

    function drawElementalBackdrop(now) {
      if (!characters.length || !cells.length) return;
      const activeCharacters = [characterFor("player"), characterFor("computer")].filter(Boolean);
      const rect = playArea.getBoundingClientRect();
      const maxRadius = Math.max(rect.width, rect.height);
      activeCharacters.forEach((character, ownerIndex) => {
        const element = elementColorsFor(character);
        const phase = now / (ownerIndex ? 6800 : 7600);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const gradient = ctx.createRadialGradient(
          center.x + Math.cos(phase) * maxRadius * 0.16,
          center.y + Math.sin(phase * 0.7) * maxRadius * 0.12,
          maxRadius * 0.05,
          center.x,
          center.y,
          maxRadius * 0.58
        );
        gradient.addColorStop(0, hexToRgba(element.glow, ownerIndex ? 0.055 : 0.07));
        gradient.addColorStop(0.55, hexToRgba(element.primary, ownerIndex ? 0.04 : 0.05));
        gradient.addColorStop(1, hexToRgba(element.deep, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.restore();

        const motifs = spriteMotifsFor(character);
        for (let i = 0; i < 18; i += 1) {
          const angle = stableUnitSeed(character.id, i, "backdrop-angle") * Math.PI * 2 + phase * (ownerIndex ? -0.45 : 0.38);
          const distance = maxRadius * (0.12 + stableUnitSeed(character.id, i, "backdrop-distance") * 0.36);
          const x = center.x + Math.cos(angle) * distance;
          const y = center.y + Math.sin(angle * 1.17) * distance * 0.64;
          const size = cellSize * (1.1 + stableUnitSeed(character.id, i, "backdrop-size") * 1.7);
          drawElementSprite(x, y, size, angle, character, motifs[i % motifs.length], 0.055, "source-over");
        }
      });
    }

    function drawElementAura(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const pulse = 0.84 + waveValue(progress, 0.17) * 0.28;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gradient = ctx.createRadialGradient(x, y, radiusPx * 0.05, x, y, radiusPx * pulse);
      gradient.addColorStop(0, hexToRgba(element.hot, 0.2 * alpha));
      gradient.addColorStop(0.34, hexToRgba(element.primary, 0.16 * alpha));
      gradient.addColorStop(0.68, hexToRgba(element.deep, 0.08 * alpha));
      gradient.addColorStop(1, hexToRgba(element.glow, 0));
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * pulse, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      for (let ring = 0; ring < 3; ring += 1) {
        ctx.beginPath();
        ctx.arc(x, y, radiusPx * (0.38 + ring * 0.19 + progress * 0.12), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(element.palette[ring], alpha * (0.34 - ring * 0.07));
        ctx.lineWidth = Math.max(1.2, cellSize * (0.04 + ring * 0.012));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFlameTongue(x, y, size, angle, color, line, alpha = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.bezierCurveTo(size * 0.46, -size * 0.42, size * 0.28, size * 0.32, 0, size * 0.86);
      ctx.bezierCurveTo(-size * 0.42, size * 0.28, -size * 0.34, -size * 0.36, 0, -size);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.58 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(line, 0.86 * alpha);
      ctx.lineWidth = Math.max(1.2, cellSize * 0.04);
      ctx.stroke();
      ctx.restore();
    }

    function drawElementSigil(x, y, size, angle, color, alpha = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.strokeStyle = hexToRgba(color, 0.82 * alpha);
      ctx.lineWidth = Math.max(1.2, cellSize * 0.044);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(-size * 0.44, -size * 0.08);
      ctx.lineTo(-size * 0.12, -size * 0.36);
      ctx.lineTo(size * 0.18, -size * 0.08);
      ctx.lineTo(size * 0.46, -size * 0.32);
      ctx.moveTo(-size * 0.28, size * 0.28);
      ctx.lineTo(size * 0.36, size * 0.28);
      ctx.stroke();
      ctx.restore();
    }

    function drawElementShard(x, y, size, angle, color, alpha = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.3, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.3, 0);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.46 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(color, 0.94 * alpha);
      ctx.lineWidth = Math.max(1.2, cellSize * 0.038);
      ctx.stroke();
      ctx.restore();
    }

    function drawElementMotifs(x, y, radiusPx, progress, character, alpha = 1, density = 7) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < density; i += 1) {
        const orbit = radiusPx * (0.28 + (i % 4) * 0.16);
        const angle = progress * Math.PI * (character.id === "moray" ? 4.8 : 1.6) + i * Math.PI * 2 / density;
        const px = x + Math.cos(angle) * orbit;
        const py = y + Math.sin(angle) * orbit * 0.78;
        const motifAlpha = alpha * (0.74 + waveValue(progress, i * 0.11) * 0.38);
        const color = paletteColor(character, i);
        const nextColor = paletteColor(character, i + 1);
        if (character.id === "dragon") {
          drawElementShard(px, py, cellSize * 0.24, angle, color, motifAlpha);
        } else if (character.id === "sandworm") {
          drawDustCloud(px, py, cellSize * 0.48, progress + i * 0.07, color, nextColor);
        } else if (character.id === "quetzal") {
          drawFeatherShape(px, py, cellSize * 0.3, angle + Math.PI / 2, color, nextColor, motifAlpha);
        } else if (character.id === "moray") {
          drawLightningBetween(
            { x: px - Math.cos(angle) * cellSize * 0.34, y: py - Math.sin(angle) * cellSize * 0.34 },
            { x: px + Math.cos(angle) * cellSize * 0.34, y: py + Math.sin(angle) * cellSize * 0.34 },
            progress + i * 0.09,
            color,
            0.88,
            4
          );
        } else if (character.id === "lobster") {
          drawFlameTongue(px, py, cellSize * 0.34, angle, color, nextColor, motifAlpha);
        } else if (character.id === "gu_king") {
          drawElementSigil(px, py, cellSize * 0.3, angle, color, motifAlpha);
        }
      }
      ctx.restore();
    }

    function drawElementWake(start, end, progress, character) {
      const element = elementColorsFor(character);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i += 1) {
        const t = Math.max(0, progress - i * 0.08);
        const px = start.x + dx * t;
        const py = start.y + dy * t;
        const spread = cellSize * (0.1 + i * 0.06);
        ctx.beginPath();
        ctx.moveTo(px - nx * spread, py - ny * spread);
        ctx.quadraticCurveTo(
          px - dx * 0.12 + nx * spread * 0.4,
          py - dy * 0.12 + ny * spread * 0.4,
          px + nx * spread,
          py + ny * spread
        );
        ctx.strokeStyle = hexToRgba(element.palette[i % element.palette.length], 0.42 * (1 - i * 0.1));
        ctx.lineWidth = Math.max(1.2, cellSize * (0.055 - i * 0.003));
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawPulseRing(x, y, radiusPx, progress, fill, stroke, lineScale = 1) {
      const alpha = 1 - progress;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.55 + progress * 0.45), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(fill, 0.24 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(stroke, 0.96 * alpha);
      ctx.lineWidth = Math.max(2, cellSize * 0.105 * lineScale);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.28 + progress * 0.28), 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba("#ffffff", 0.4 * alpha);
      ctx.lineWidth = Math.max(1, cellSize * 0.04 * lineScale);
      ctx.stroke();
      ctx.restore();
    }

    function isUltimateVisualType(type = "") {
      return type.endsWith("-big") || type.endsWith("-burst") || type.endsWith("-radiation");
    }

    function drawSmallSkillOrb(x, y, size, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const pulse = 0.92 + waveValue(progress, 0.18) * 0.14;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(0, 0, size * 0.08, 0, 0, size * 1.15);
      glow.addColorStop(0, hexToRgba(element.hot, 0.72 * alpha));
      glow.addColorStop(0.45, hexToRgba(element.primary, 0.34 * alpha));
      glow.addColorStop(1, hexToRgba(element.deep, 0));
      ctx.beginPath();
      ctx.arc(0, 0, size * 1.1, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.48 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(element.hot, 0.9 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(element.secondary, 0.95 * alpha);
      ctx.lineWidth = Math.max(1.4, cellSize * 0.05);
      ctx.stroke();
      ctx.restore();
    }

    function drawSmallSkillScale(x, y, size, angle, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.quadraticCurveTo(size * 0.55, -size * 0.2, size * 0.18, size * 0.82);
      ctx.quadraticCurveTo(-size * 0.48, size * 0.18, 0, -size);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(element.primary, 0.64 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(element.glow, 0.86 * alpha);
      ctx.lineWidth = Math.max(1.1, cellSize * 0.032);
      ctx.stroke();
      ctx.restore();
    }

    function drawSmallSkillRuneRing(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(progress * Math.PI * 0.72);
      ctx.globalCompositeOperation = "lighter";
      for (let ring = 0; ring < 2; ring += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, radiusPx * (0.48 + ring * 0.2), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(ring ? element.secondary : element.glow, (0.46 - ring * 0.1) * alpha);
        ctx.lineWidth = Math.max(1.2, cellSize * (0.035 + ring * 0.012));
        ctx.stroke();
      }
      for (let i = 0; i < 6; i += 1) {
        const angle = i * Math.PI * 2 / 6;
        const px = Math.cos(angle) * radiusPx * 0.66;
        const py = Math.sin(angle) * radiusPx * 0.66;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle + Math.PI / 2);
        drawLocalHex(cellSize * 0.11);
        ctx.fillStyle = hexToRgba(i % 2 ? element.primary : element.hot, 0.28 * alpha);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(i % 2 ? element.glow : element.secondary, 0.78 * alpha);
        ctx.lineWidth = Math.max(1, cellSize * 0.024);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    function drawSmallSkillGroundCracks(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < 7; i += 1) {
        const angle = i * Math.PI * 2 / 7 + 0.18;
        const inner = radiusPx * (0.12 + progress * 0.08);
        const mid = radiusPx * (0.34 + (i % 2) * 0.08);
        const outer = radiusPx * (0.58 + progress * 0.28);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner * 0.72);
        ctx.lineTo(x + Math.cos(angle + 0.12) * mid, y + Math.sin(angle + 0.12) * mid * 0.72);
        ctx.lineTo(x + Math.cos(angle - 0.08) * outer, y + Math.sin(angle - 0.08) * outer * 0.72);
        ctx.strokeStyle = hexToRgba(i % 2 ? element.secondary : element.deep, alpha * (0.68 - progress * 0.24));
        ctx.lineWidth = Math.max(1.4, cellSize * 0.045);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawSmallSkillWaterRibbon(x, y, size, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let band = -1; band <= 1; band += 1) {
        ctx.beginPath();
        for (let step = 0; step <= 22; step += 1) {
          const t = step / 22;
          const px = -size * 0.82 + t * size * 1.64;
          const py = Math.sin(t * Math.PI * 2 + progress * Math.PI * 2 + band * 0.7) * size * 0.13 + band * size * 0.16;
          if (step === 0) ctx.moveTo(x + px, y + py);
          else ctx.lineTo(x + px, y + py);
        }
        ctx.strokeStyle = hexToRgba(band ? element.secondary : element.hot, alpha * (band ? 0.5 : 0.7));
        ctx.lineWidth = Math.max(1.4, cellSize * (band ? 0.04 : 0.06));
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawSmallSkillClawEmblem(x, y, size, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const strike = Math.pow(waveValue(progress, 0.18), 1.8);
      const lift = size * (0.56 - strike * 0.52);
      const squash = 1 + strike * 0.16;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.08 + Math.sin(progress * Math.PI * 2) * 0.045);
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = hexToRgba(element.glow, 0.54 * alpha);
      ctx.shadowBlur = cellSize * 0.16;

      ctx.save();
      ctx.translate(0, lift);
      ctx.scale(1.02, squash);
      ctx.beginPath();
      ctx.moveTo(-size * 0.52, -size * 0.42);
      ctx.quadraticCurveTo(-size * 0.72, -size * 0.08, -size * 0.42, size * 0.34);
      ctx.quadraticCurveTo(-size * 0.16, size * 0.76, size * 0.28, size * 0.58);
      ctx.quadraticCurveTo(size * 0.72, size * 0.4, size * 0.74, -size * 0.08);
      ctx.quadraticCurveTo(size * 0.68, -size * 0.48, size * 0.28, -size * 0.66);
      ctx.quadraticCurveTo(size * 0.04, -size * 0.26, -size * 0.18, -size * 0.02);
      ctx.quadraticCurveTo(-size * 0.28, -size * 0.28, -size * 0.52, -size * 0.42);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(element.primary, 0.9 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(element.hot, 0.94 * alpha);
      ctx.lineWidth = Math.max(1.8, cellSize * 0.062);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-size * 0.2, -size * 0.1);
      ctx.quadraticCurveTo(size * 0.04, -size * 0.22, size * 0.34, -size * 0.16);
      ctx.strokeStyle = hexToRgba(element.deep, 0.44 * alpha);
      ctx.lineWidth = Math.max(1.2, cellSize * 0.035);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.18, size * 0.2);
      ctx.quadraticCurveTo(size * 0.08, size * 0.3, size * 0.42, size * 0.14);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.roundRect?.(-size * 0.16, -size * 0.95 + lift, size * 0.32, size * 0.48, size * 0.1);
      if (!ctx.roundRect) ctx.rect(-size * 0.16, -size * 0.95 + lift, size * 0.32, size * 0.48);
      ctx.fillStyle = hexToRgba(element.deep, 0.82 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(element.glow, 0.72 * alpha);
      ctx.lineWidth = Math.max(1.2, cellSize * 0.04);
      ctx.stroke();

      if (strike > 0.55) {
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.ellipse(0, size * 0.62, size * (0.46 + strike * 0.24), size * (0.12 + strike * 0.04), 0, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(element.hot, alpha * 0.72);
        ctx.lineWidth = Math.max(1.6, cellSize * 0.055);
        ctx.stroke();
        for (let crack = 0; crack < 7; crack += 1) {
          const angle = -Math.PI * 0.88 + crack * Math.PI * 1.76 / 6;
          const inner = size * 0.16;
          const outer = size * (0.44 + (crack % 3) * 0.08);
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * inner, size * 0.62 + Math.sin(angle) * inner * 0.36);
          ctx.lineTo(Math.cos(angle) * outer, size * 0.62 + Math.sin(angle) * outer * 0.42);
          ctx.strokeStyle = hexToRgba(crack % 2 ? element.secondary : "#ffffff", alpha * (0.62 - crack * 0.035));
          ctx.lineWidth = Math.max(1.1, cellSize * 0.032);
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawSmallSkillPoisonSigil(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-progress * Math.PI * 0.9);
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.arc(0, 0, radiusPx * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba("#020617", 0.72 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(element.glow, 0.82 * alpha);
      ctx.lineWidth = Math.max(1.6, cellSize * 0.05);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const angle = i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * radiusPx * 0.22, Math.sin(angle) * radiusPx * 0.22);
        ctx.quadraticCurveTo(
          Math.cos(angle + 0.34) * radiusPx * 0.46,
          Math.sin(angle + 0.34) * radiusPx * 0.46,
          Math.cos(angle + 0.68) * radiusPx * 0.74,
          Math.sin(angle + 0.68) * radiusPx * 0.54
        );
        ctx.strokeStyle = hexToRgba(i % 2 ? element.secondary : element.hot, 0.68 * alpha);
        ctx.lineWidth = Math.max(1.1, cellSize * 0.034);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawSmallSkillIcon(x, y, size, progress, character, angle = 0, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      if (character.id === "dragon") {
        drawSmallSkillOrb(0, 0, size * 0.78, progress, character, alpha);
        for (let i = 0; i < 5; i += 1) {
          const scaleAngle = i * Math.PI * 2 / 5 + progress * Math.PI * 1.2;
          drawSmallSkillScale(Math.cos(scaleAngle) * size * 0.58, Math.sin(scaleAngle) * size * 0.42, size * 0.2, scaleAngle, character, 0.78 * alpha);
        }
      } else if (character.id === "sandworm") {
        ctx.beginPath();
        ctx.moveTo(size * 0.72, 0);
        ctx.lineTo(size * 0.12, -size * 0.4);
        ctx.lineTo(-size * 0.64, -size * 0.22);
        ctx.lineTo(-size * 0.26, 0);
        ctx.lineTo(-size * 0.64, size * 0.22);
        ctx.lineTo(size * 0.12, size * 0.4);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(element.primary, 0.88 * alpha);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.deep, 0.94 * alpha);
        ctx.lineWidth = Math.max(1.5, cellSize * 0.052);
        ctx.stroke();
        drawSmallSkillGroundCracks(0, 0, size * 0.8, progress, character, 0.74 * alpha);
      } else if (character.id === "quetzal") {
        drawFeatherShape(0, 0, size * 0.72, Math.PI / 2, element.primary, element.glow, 0.92 * alpha);
        [-1, 1].forEach(mirror => drawFeatherShape(-size * 0.18, mirror * size * 0.28, size * 0.42, Math.PI / 2 + mirror * 0.52, element.secondary, element.hot, 0.72 * alpha));
      } else if (character.id === "moray") {
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.62, size * 0.34, 0, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(element.deep, 0.88 * alpha);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.hot, 0.94 * alpha);
        ctx.lineWidth = Math.max(1.6, cellSize * 0.055);
        ctx.stroke();
        drawSmallSkillWaterRibbon(0, 0, size * 0.9, progress, character, alpha);
      } else if (character.id === "lobster") {
        drawSmallSkillClawEmblem(0, 0, size * 1.05, progress, character, alpha);
      } else if (character.id === "gu_king") {
        drawSmallSkillPoisonSigil(0, 0, size * 0.92, progress, character, alpha);
        ctx.beginPath();
        ctx.arc(size * 0.2, -size * 0.12, size * 0.12, 0, Math.PI * 2);
        ctx.arc(size * 0.18, size * 0.14, size * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(element.hot, 0.86 * alpha);
        ctx.fill();
      } else {
        drawSmallSkillOrb(0, 0, size * 0.72, progress, character, alpha);
      }
      ctx.restore();
    }

    function drawSmallCastFrame(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const pulse = 0.82 + waveValue(progress, 0.16) * 0.18;
      drawElementAura(x, y, radiusPx * 0.78, progress, character, 0.34 * alpha);
      drawSmallSkillRuneRing(x, y, radiusPx * pulse, progress, character, 0.74 * alpha);
      drawSmallSkillIcon(x, y, radiusPx * 0.46, progress, character, -Math.PI / 2 + progress * 0.28, alpha);
      if (character.id === "sandworm") {
        drawSmallSkillGroundCracks(x, y + radiusPx * 0.08, radiusPx * 0.72, progress, character, 0.52 * alpha);
      } else if (character.id === "moray") {
        drawSmallSkillWaterRibbon(x, y, radiusPx * 0.72, progress, character, 0.72 * alpha);
      } else if (character.id === "lobster") {
        drawClawArc(x - radiusPx * 0.12, y, radiusPx * 0.86, progress * 0.7, element.secondary, element.glow, 1);
        drawClawArc(x + radiusPx * 0.12, y, radiusPx * 0.86, progress * 0.7, element.secondary, element.glow, -1);
      } else if (character.id === "gu_king") {
        drawSmallSkillPoisonSigil(x, y, radiusPx * 0.78, progress, character, 0.6 * alpha);
      }
    }

    function drawSmallImpactFrame(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const fade = Math.max(0, 1 - progress * 0.18);
      drawElementAura(x, y, radiusPx * 0.96, progress, character, 0.54 * alpha);
      drawPulseRing(x, y, radiusPx * 0.86, progress, element.primary, element.glow, 0.82);
      drawSmallSkillRuneRing(x, y, radiusPx * (0.58 + progress * 0.24), 1 - progress, character, 0.72 * alpha * fade);
      if (character.id === "dragon") {
        drawSmallSkillOrb(x, y, radiusPx * 0.42, progress, character, alpha);
        for (let i = 0; i < 8; i += 1) {
          const angle = i * Math.PI * 2 / 8 + progress * Math.PI * 0.8;
          drawSmallSkillScale(x + Math.cos(angle) * radiusPx * 0.52, y + Math.sin(angle) * radiusPx * 0.38, cellSize * 0.18, angle, character, 0.7 * alpha);
        }
      } else if (character.id === "sandworm") {
        drawSandSpike(x, y, radiusPx * 0.88, progress, element.secondary, element.glow);
        drawSmallSkillGroundCracks(x, y + radiusPx * 0.08, radiusPx, progress, character, 0.8 * alpha);
      } else if (character.id === "quetzal") {
        drawSwampForestBloom(x, y, radiusPx * 0.66, progress, character, 0.72 * alpha, 2);
        for (let i = 0; i < 7; i += 1) {
          const angle = i * Math.PI * 2 / 7 + progress * 0.55;
          drawFeatherShape(x + Math.cos(angle) * radiusPx * 0.5, y + Math.sin(angle) * radiusPx * 0.36, cellSize * 0.22, angle + Math.PI / 2, element.primary, element.hot, 0.68 * alpha);
        }
      } else if (character.id === "moray") {
        drawSmallSkillWaterRibbon(x, y, radiusPx * 0.92, progress, character, alpha);
        for (let i = 0; i < 5; i += 1) {
          const angle = i * Math.PI * 2 / 5 + progress * Math.PI;
          drawLightningBetween(
            { x: x + Math.cos(angle) * radiusPx * 0.26, y: y + Math.sin(angle) * radiusPx * 0.18 },
            { x: x + Math.cos(angle) * radiusPx * 0.72, y: y + Math.sin(angle) * radiusPx * 0.48 },
            progress + i * 0.1,
            i % 2 ? element.secondary : element.hot,
            0.42,
            3
          );
        }
      } else if (character.id === "lobster") {
        drawSmallSkillClawEmblem(x, y, radiusPx * 0.78, progress, character, alpha);
        drawPulseRing(x, y, radiusPx * 0.62, progress, element.deep, element.hot, 0.72);
      } else if (character.id === "gu_king") {
        drawSmallSkillPoisonSigil(x, y, radiusPx * 0.78, progress, character, alpha);
        for (let i = 0; i < 9; i += 1) {
          const angle = i * Math.PI * 2 / 9 - progress * Math.PI * 1.4;
          ctx.beginPath();
          ctx.arc(x + Math.cos(angle) * radiusPx * 0.56, y + Math.sin(angle) * radiusPx * 0.4, cellSize * (0.06 + (i % 3) * 0.02), 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(i % 2 ? element.glow : element.secondary, 0.58 * alpha);
          ctx.fill();
        }
      } else {
        drawSmallSkillIcon(x, y, radiusPx * 0.44, progress, character, 0, alpha);
      }
    }

    function drawSmallSkillTrail(start, end, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      const nx = -uy;
      const ny = ux;
      const headX = start.x + dx * progress;
      const headY = start.y + dy * progress;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i += 1) {
        const back = cellSize * (0.32 + i * 0.22);
        const width = cellSize * (0.1 + i * 0.035);
        const fade = alpha * (0.45 - i * 0.065) * Math.min(1, progress * 2.2);
        const tx = headX - ux * back;
        const ty = headY - uy * back;
        ctx.beginPath();
        if (character.id === "sandworm") {
          ctx.ellipse(tx, ty + cellSize * 0.08, width * 1.35, width * 0.62, Math.atan2(uy, ux), 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(i % 2 ? element.secondary : element.dust || element.primary, fade);
          ctx.fill();
        } else if (character.id === "quetzal") {
          drawFeatherShape(tx + nx * width * 0.5, ty + ny * width * 0.5, cellSize * (0.13 + i * 0.012), Math.atan2(uy, ux) + Math.PI / 2, i % 2 ? element.secondary : element.primary, element.glow, fade * 1.5);
        } else if (character.id === "lobster") {
          drawFlameTongue(tx, ty, cellSize * (0.16 + i * 0.018), Math.atan2(uy, ux) - Math.PI / 2, i % 2 ? element.secondary : element.primary, element.hot, fade * 1.25);
        } else if (character.id === "gu_king") {
          ctx.arc(tx + nx * Math.sin(i) * width, ty + ny * Math.sin(i) * width, cellSize * (0.055 + i * 0.008), 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(i % 2 ? element.glow : element.secondary, fade * 1.25);
          ctx.fill();
        } else {
          ctx.moveTo(tx - nx * width, ty - ny * width);
          ctx.quadraticCurveTo(tx - ux * cellSize * 0.16, ty - uy * cellSize * 0.16, tx + nx * width, ty + ny * width);
          ctx.strokeStyle = hexToRgba(character.id === "moray" && i % 2 ? element.hot : i % 2 ? element.secondary : element.glow, fade);
          ctx.lineWidth = Math.max(1.1, cellSize * (0.042 - i * 0.004));
          ctx.lineCap = "round";
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawUltimateImpactFrame(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const pulse = 0.94 + waveValue(progress, 0.24) * 0.16;
      drawElementAura(x, y, radiusPx * 1.36 * pulse, progress, character, 1.08 * alpha);
      drawPulseRing(x, y, radiusPx * 1.22, progress, element.deep, element.glow, 1.65);
      drawPulseRing(x, y, radiusPx * (0.82 + progress * 0.3), 1 - progress, element.primary, "#ffffff", 1.15);
      drawElementMotifs(x, y, radiusPx * 1.18, progress, character, 1.08 * alpha, 24);
      for (let i = 0; i < 22; i += 1) {
        const angle = progress * Math.PI * 4.6 + i * Math.PI * 2 / 22;
        const inner = radiusPx * 0.34;
        const outer = radiusPx * (1.06 + waveValue(progress, i * 0.05) * 0.28);
        drawLightningBetween(
          { x: x + Math.cos(angle) * inner, y: y + Math.sin(angle) * inner * 0.74 },
          { x: x + Math.cos(angle + 0.18) * outer, y: y + Math.sin(angle + 0.18) * outer * 0.74 },
          progress + i * 0.04,
          i % 4 === 0 ? "#ffffff" : paletteColor(character, i),
          1.15,
          5
        );
      }
    }

    function drawHexBurst(x, y, radiusPx, progress, color, line) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(progress * Math.PI * 2);
      for (let ring = 0; ring < 3; ring += 1) {
        const size = radiusPx * (0.28 + progress * 0.42 + ring * 0.16);
        drawLocalHex(size);
        ctx.strokeStyle = hexToRgba(ring ? line : color, (1 - progress) * (ring ? 0.58 : 0.88));
        ctx.lineWidth = Math.max(1.4, cellSize * (ring ? 0.045 : 0.072));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawLightningBetween(start, end, progress, color, widthScale = 1, segments = 7) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const jitter = (i === 0 || i === segments) ? 0 : Math.sin((progress * 8 + i * 1.7) * Math.PI) * cellSize * 0.18;
        const px = start.x + dx * t + nx * jitter;
        const py = start.y + dy * t + ny * jitter;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = hexToRgba(color, 0.96);
      ctx.lineWidth = Math.max(1.8, cellSize * 0.075 * widthScale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    }

    function drawFeatherShape(x, y, size, angle, color, line, alpha = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.quadraticCurveTo(size * 0.58, -size * 0.15, size * 0.12, size);
      ctx.quadraticCurveTo(-size * 0.42, size * 0.12, 0, -size);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.62 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(line, 0.96 * alpha);
      ctx.lineWidth = Math.max(1.2, cellSize * 0.045);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.72);
      ctx.lineTo(size * 0.02, size * 0.74);
      ctx.stroke();
      ctx.restore();
    }

    function drawDustCloud(x, y, radiusPx, progress, color, line) {
      ctx.save();
      for (let i = 0; i < 7; i += 1) {
        const angle = progress * Math.PI * 1.4 + i * Math.PI * 2 / 7;
        const distance = radiusPx * (0.16 + progress * 0.42 + (i % 2) * 0.07);
        ctx.beginPath();
        ctx.arc(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance * 0.72,
          Math.max(2, cellSize * (0.1 + (i % 3) * 0.025)) * (1 - progress * 0.25),
          0,
          Math.PI * 2
        );
        ctx.fillStyle = hexToRgba(i % 2 ? line : color, 0.46 * (1 - progress));
        ctx.fill();
      }
      ctx.restore();
    }

    function drawClawArc(x, y, radiusPx, progress, color, line, mirror = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(mirror, 1);
      ctx.rotate(-0.45 + progress * 0.3);
      ctx.beginPath();
      ctx.arc(0, 0, radiusPx * 0.56, -0.82, 0.82);
      ctx.strokeStyle = hexToRgba(color, 0.94 * (1 - progress * 0.38));
      ctx.lineWidth = Math.max(2.5, cellSize * 0.16);
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(radiusPx * 0.32, 0, radiusPx * 0.22, -1.2, 1.2);
      ctx.strokeStyle = hexToRgba(line, 0.92 * (1 - progress * 0.25));
      ctx.lineWidth = Math.max(1.8, cellSize * 0.085);
      ctx.stroke();
      ctx.restore();
    }

    function drawBugSwarm(x, y, radiusPx, progress, color, line) {
      ctx.save();
      for (let i = 0; i < 10; i += 1) {
        const angle = progress * Math.PI * 4 + i * Math.PI * 2 / 10;
        const distance = radiusPx * (0.18 + ((i * 7) % 5) * 0.08 + progress * 0.2);
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle * 1.13) * distance;
        ctx.beginPath();
        ctx.ellipse(px, py, cellSize * 0.07, cellSize * 0.035, angle, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(i % 2 ? color : line, 0.86 * (1 - progress * 0.24));
        ctx.fill();
      }
      ctx.restore();
    }

    function drawSandSpike(x, y, radiusPx, progress, color, line) {
      ctx.save();
      ctx.translate(x, y);
      for (let i = 0; i < 9; i += 1) {
        const angle = i * Math.PI * 2 / 9 + progress * 0.42;
        const inner = radiusPx * (0.18 + progress * 0.18);
        const outer = radiusPx * (0.48 + waveValue(progress, i * 0.13) * 0.16);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle - 0.08) * inner, Math.sin(angle - 0.08) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.lineTo(Math.cos(angle + 0.08) * inner, Math.sin(angle + 0.08) * inner);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(i % 2 ? color : line, 0.64 * (1 - progress * 0.12));
        ctx.fill();
      }
      ctx.restore();
    }

    function drawEnergyBeamBurst(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.82 + waveValue(progress, 0.16) * 0.24;
      const gradient = ctx.createRadialGradient(x, y, radiusPx * 0.04, x, y, radiusPx * 0.72 * pulse);
      gradient.addColorStop(0, hexToRgba("#ffffff", 0.88 * alpha));
      gradient.addColorStop(0.24, hexToRgba(element.glow, 0.58 * alpha));
      gradient.addColorStop(0.62, hexToRgba(element.deep, 0.22 * alpha));
      gradient.addColorStop(1, hexToRgba(element.primary, 0));
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * 0.72 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      for (let i = 0; i < 18; i += 1) {
        const angle = i * Math.PI * 2 / 18 + progress * Math.PI * 1.8;
        const inner = radiusPx * (0.2 + (i % 3) * 0.035);
        const outer = radiusPx * (0.78 + waveValue(progress, i * 0.07) * 0.28);
        drawLightningBetween(
          { x: x + Math.cos(angle) * inner, y: y + Math.sin(angle) * inner },
          { x: x + Math.cos(angle) * outer, y: y + Math.sin(angle) * outer },
          progress + i * 0.05,
          i % 2 ? element.glow : element.secondary,
          1.5,
          5
        );
      }
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.28 + progress * 0.54), 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba("#ffffff", 0.86 * alpha * (1 - progress * 0.28));
      ctx.lineWidth = Math.max(3, cellSize * 0.12);
      ctx.stroke();
      ctx.restore();
    }

    function drawDragonBigBurst(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const flash = Math.max(0, 1 - progress * 1.4);
      const core = radiusPx * (0.3 + waveValue(progress, 0.2) * 0.2);
      const halo = radiusPx * (0.54 + progress * 1.05);
      const gradient = ctx.createRadialGradient(x, y, core * 0.12, x, y, halo);
      gradient.addColorStop(0, hexToRgba("#ffffff", 0.96 * alpha));
      gradient.addColorStop(0.28, hexToRgba("#fff7ed", 0.78 * alpha));
      gradient.addColorStop(0.5, hexToRgba(element.secondary, 0.54 * alpha));
      gradient.addColorStop(0.72, hexToRgba(element.glow, 0.22 * alpha));
      gradient.addColorStop(1, hexToRgba(element.deep, 0));
      ctx.beginPath();
      ctx.arc(x, y, halo, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      for (let ring = 0; ring < 5; ring += 1) {
        ctx.beginPath();
        ctx.arc(x, y, radiusPx * (0.22 + progress * 1.08 + ring * 0.14), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(ring % 2 ? element.secondary : "#ffffff", alpha * (0.94 - ring * 0.14) * (1 - progress * 0.28));
        ctx.lineWidth = Math.max(2, cellSize * (0.19 - ring * 0.024));
        ctx.stroke();
      }
      for (let i = 0; i < 34; i += 1) {
        const angle = progress * Math.PI * 5.4 + i * Math.PI * 2 / 34;
        const inner = radiusPx * (0.18 + (i % 4) * 0.035);
        const outer = radiusPx * (0.82 + waveValue(progress, i * 0.05) * 0.5);
        drawLightningBetween(
          { x: x + Math.cos(angle) * inner, y: y + Math.sin(angle) * inner },
          { x: x + Math.cos(angle) * outer, y: y + Math.sin(angle) * outer },
          progress + i * 0.04,
          i % 4 ? (i % 2 ? element.secondary : element.glow) : "#ffffff",
          1.85,
          6
        );
      }
      for (let i = 0; i < 12; i += 1) {
        const angle = i * Math.PI * 2 / 12 - progress * Math.PI;
        drawElementShard(
          x + Math.cos(angle) * radiusPx * (0.46 + progress * 0.24),
          y + Math.sin(angle) * radiusPx * (0.34 + progress * 0.18),
          cellSize * 0.34,
          angle,
          i % 2 ? element.secondary : "#ffffff",
          alpha * (1 - progress * 0.24)
        );
      }
      ctx.beginPath();
      ctx.arc(x, y, core, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba("#ffffff", (0.72 + flash * 0.24) * alpha);
      ctx.fill();
      ctx.restore();
    }

    function drawSuperBlackHole(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const pull = Math.max(0, Math.min(1, progress));
      for (let ring = 0; ring < 5; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(
          x,
          y,
          radiusPx * (0.34 + ring * 0.14 - pull * 0.08),
          radiusPx * (0.18 + ring * 0.08 - pull * 0.04),
          -pull * Math.PI * 2 + ring * 0.48,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = hexToRgba(ring % 2 ? element.deep : "#020617", alpha * (0.78 - ring * 0.1));
        ctx.lineWidth = Math.max(2, cellSize * (0.1 - ring * 0.01));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 22; i += 1) {
        const angle = i * Math.PI * 2 / 22 - pull * Math.PI * 3;
        const outer = radiusPx * (0.9 - pull * 0.42 + (i % 3) * 0.06);
        const inner = radiusPx * (0.2 + pull * 0.08);
        drawLightningBetween(
          { x: x + Math.cos(angle) * outer, y: y + Math.sin(angle) * outer * 0.72 },
          { x: x + Math.cos(angle + 0.32) * inner, y: y + Math.sin(angle + 0.32) * inner * 0.72 },
          progress + i * 0.07,
          i % 2 ? element.secondary : element.glow,
          0.72,
          4
        );
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.24 + pull * 0.08), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba("#000000", 0.94 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(element.glow, 0.7 * alpha);
      ctx.lineWidth = Math.max(2, cellSize * 0.08);
      ctx.stroke();
      ctx.restore();
    }

    function drawSandBurial(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.ellipse(x, y + radiusPx * 0.1, radiusPx * 1.18, radiusPx * 0.52, 0, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba("#4a2a12", 0.34 * alpha);
      ctx.fill();
      drawDustCloud(x, y, radiusPx * 1.7, progress, element.dust || element.primary, element.deep);
      for (let i = 0; i < 34; i += 1) {
        const angle = i * Math.PI * 2 / 34 + progress * Math.PI * 0.85;
        const spread = radiusPx * (0.22 + (i % 4) * 0.1);
        const height = radiusPx * (0.55 + waveValue(progress, i * 0.09) * 0.95);
        const baseX = x + Math.cos(angle) * spread;
        const baseY = y + Math.sin(angle) * spread * 0.54;
        ctx.beginPath();
        ctx.moveTo(baseX - cellSize * 0.18, baseY + height * 0.24);
        ctx.quadraticCurveTo(baseX - cellSize * 0.28, baseY - height * 0.35, baseX, baseY - height);
        ctx.quadraticCurveTo(baseX + cellSize * 0.28, baseY - height * 0.35, baseX + cellSize * 0.18, baseY + height * 0.24);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(i % 2 ? element.primary : element.secondary, 0.6 * alpha * (1 - progress * 0.1));
        ctx.fill();
        ctx.strokeStyle = hexToRgba(i % 3 ? element.glow : "#fff7ed", 0.52 * alpha);
        ctx.lineWidth = Math.max(1.1, cellSize * 0.035);
        ctx.stroke();
      }
      for (let i = 0; i < 26; i += 1) {
        const angle = progress * Math.PI * 1.8 + i * Math.PI * 2 / 26;
        const distance = radiusPx * (0.64 + (i % 5) * 0.12 + progress * 0.28);
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.66, cellSize * (0.11 + (i % 3) * 0.04), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(i % 2 ? element.dust || element.primary : "#7c2d12", 0.34 * alpha * (1 - progress * 0.32));
        ctx.fill();
      }
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(x, y + radiusPx * 0.08, radiusPx * (0.36 + ring * 0.22 + progress * 0.28), radiusPx * (0.18 + ring * 0.11), progress * Math.PI + ring * 0.4, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(ring % 2 ? element.primary : element.glow, 0.52 * alpha * (1 - progress * 0.22));
        ctx.lineWidth = Math.max(2, cellSize * 0.07);
        ctx.stroke();
      }
      drawSandSpike(x, y, radiusPx * 1.35, progress, element.secondary, element.glow);
      ctx.restore();
    }

    function drawQuetzalFlowerPatch(x, y, radiusPx, progress, character, alpha, kind) {
      const element = elementColorsFor(character);
      const flowerPalettes = [
        ["#f472b6", "#fef3c7", "#22c55e"],
        ["#fb7185", "#fde68a", "#16a34a"],
        ["#facc15", "#f97316", "#15803d"],
        ["#c084fc", "#f0abfc", "#22c55e"],
        ["#60a5fa", "#bfdbfe", "#16a34a"],
        ["#2dd4bf", "#a7f3d0", "#15803d"],
        ["#f9a8d4", "#ffffff", "#22c55e"],
        ["#fb923c", "#fed7aa", "#166534"]
      ];
      const palette = flowerPalettes[kind % flowerPalettes.length];
      const blooms = 2 + (kind % 5);
      const petals = 4 + (kind % 7);
      const shape = Math.floor(kind / 4);
      for (let bloom = 0; bloom < blooms; bloom += 1) {
        const orbit = radiusPx * (0.08 + (bloom % 4) * 0.13);
        const centerAngle = bloom * Math.PI * 2 / blooms + kind * 0.47 + progress * (shape === 3 ? 0.32 : 0.08);
        const cx = x + Math.cos(centerAngle) * orbit;
        const cy = y + Math.sin(centerAngle) * orbit * 0.58;
        for (let petal = 0; petal < petals; petal += 1) {
          const angle = petal * Math.PI * 2 / petals + progress * 0.42 + bloom * 0.2;
          const petalSize = cellSize * (0.17 + (kind % 6) * 0.018 + (shape === 2 ? 0.08 : 0));
          if (shape === 0 || shape === 3) {
            drawFeatherShape(
              cx + Math.cos(angle) * cellSize * 0.08,
              cy + Math.sin(angle) * cellSize * 0.06,
              petalSize,
              angle + Math.PI / 2,
              palette[petal % 2],
              palette[2],
              0.78 * alpha
            );
          } else if (shape === 1) {
            ctx.beginPath();
            ctx.ellipse(
              cx + Math.cos(angle) * cellSize * 0.16,
              cy + Math.sin(angle) * cellSize * 0.12,
              petalSize * 0.46,
              petalSize * 0.24,
              angle,
              0,
              Math.PI * 2
            );
            ctx.fillStyle = hexToRgba(palette[petal % 2], 0.78 * alpha);
            ctx.fill();
            ctx.strokeStyle = hexToRgba(palette[2], 0.58 * alpha);
            ctx.lineWidth = Math.max(1, cellSize * 0.024);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(angle - 0.16) * petalSize, cy + Math.sin(angle - 0.16) * petalSize * 0.72);
            ctx.lineTo(cx + Math.cos(angle + 0.16) * petalSize, cy + Math.sin(angle + 0.16) * petalSize * 0.72);
            ctx.closePath();
            ctx.fillStyle = hexToRgba(palette[petal % 2], 0.7 * alpha);
            ctx.fill();
          }
        }
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * (0.06 + (kind % 4) * 0.014), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(kind % 2 ? "#fef08a" : "#ffffff", 0.88 * alpha);
        ctx.fill();
      }
      drawQuetzalGrassPatch(x, y, radiusPx * 0.68, progress, character, alpha * 0.45, kind % 16);
    }

    function drawQuetzalGrassPatch(x, y, radiusPx, progress, character, alpha, kind) {
      const element = elementColorsFor(character);
      const blades = 8 + kind * 3;
      const mode = Math.floor(kind / 4);
      const greens = ["#14532d", "#15803d", "#16a34a", "#22c55e", "#65a30d", "#84cc16"];
      for (let i = 0; i < blades; i += 1) {
        const angle = i * Math.PI * 2 / blades + kind * 0.23;
        const baseRadius = radiusPx * (0.1 + ((i * 5 + kind) % 9) * 0.055);
        const baseX = x + Math.cos(angle) * baseRadius;
        const baseY = y + Math.sin(angle) * baseRadius * 0.6 + radiusPx * 0.05;
        const height = radiusPx * (0.18 + (kind % 6) * 0.04 + waveValue(progress, i * 0.07) * (mode === 2 ? 0.28 : 0.16));
        const bend = mode === 0 ? 0.7 : mode === 1 ? -0.9 : mode === 2 ? Math.sin(i) * 1.4 : 0.1;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        if (mode === 3) {
          ctx.lineTo(baseX + Math.cos(angle - 0.16) * cellSize * 0.18, baseY - height * 0.52);
          ctx.lineTo(baseX + Math.cos(angle + 0.12) * cellSize * 0.07, baseY - height);
        } else {
          ctx.quadraticCurveTo(
            baseX + Math.cos(angle + bend) * cellSize * (0.1 + (kind % 4) * 0.04),
            baseY - height * 0.58,
            baseX + Math.cos(angle) * cellSize * (mode === 2 ? 0.32 : 0.18),
            baseY - height
          );
        }
        ctx.strokeStyle = hexToRgba(greens[(i + kind) % greens.length], 0.7 * alpha);
        ctx.lineWidth = Math.max(1.2, cellSize * (0.035 + (i % 5) * 0.01));
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        if (mode === 1 && i % 4 === 0) {
          ctx.beginPath();
          ctx.arc(baseX + Math.cos(angle) * cellSize * 0.14, baseY - height * 0.64, cellSize * 0.04, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(element.glow, 0.5 * alpha);
          ctx.fill();
        }
      }
    }

    function drawQuetzalTreePatch(x, y, radiusPx, progress, character, alpha, kind) {
      const element = elementColorsFor(character);
      const treePalettes = [
        { trunk: "#6b4423", leaves: ["#16a34a", "#22c55e", "#86efac"] },
        { trunk: "#854d0e", leaves: ["#a3e635", "#ca8a04", "#facc15"] },
        { trunk: "#78350f", leaves: ["#b91c1c", "#ef4444", "#f97316"] },
        { trunk: "#4b2e18", leaves: ["#a8a29e", "#78716c", "#d6d3d1"] }
      ];
      const palette = treePalettes[Math.floor(kind / 4)];
      const trees = 1 + (kind % 3);
      for (let tree = 0; tree < trees; tree += 1) {
        const angle = tree * Math.PI * 2 / trees + kind * 0.61;
        const tx = x + Math.cos(angle) * radiusPx * (0.08 + tree * 0.12);
        const ty = y + Math.sin(angle) * radiusPx * 0.28 + radiusPx * 0.18;
        const height = radiusPx * (0.42 + (kind % 5) * 0.055 + tree * 0.08);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.bezierCurveTo(tx - cellSize * 0.12, ty - height * 0.3, tx + cellSize * 0.14, ty - height * 0.7, tx, ty - height);
        ctx.strokeStyle = hexToRgba(palette.trunk, 0.84 * alpha);
        ctx.lineWidth = Math.max(2.4, cellSize * (0.07 + (kind % 3) * 0.014));
        ctx.lineCap = "round";
        ctx.stroke();
        if (Math.floor(kind / 4) === 3) {
          for (let branch = 0; branch < 5 + (kind % 4); branch += 1) {
            const branchAngle = -Math.PI / 2 + (branch - 2) * 0.42 + progress * 0.05;
            drawLightningBetween(
              { x: tx, y: ty - height * (0.45 + branch * 0.07) },
              { x: tx + Math.cos(branchAngle) * cellSize * (0.3 + branch * 0.05), y: ty - height + Math.sin(branchAngle) * cellSize * 0.28 },
              progress + branch * 0.05,
              palette.leaves[branch % palette.leaves.length],
              0.3,
              3
            );
          }
        } else {
          const canopy = 5 + (kind % 6);
          for (let leaf = 0; leaf < canopy; leaf += 1) {
            const leafAngle = leaf * Math.PI * 2 / canopy + progress * 0.34;
            drawFeatherShape(
              tx + Math.cos(leafAngle) * cellSize * (0.16 + (leaf % 2) * 0.08),
              ty - height + Math.sin(leafAngle) * cellSize * 0.14,
              cellSize * (0.26 + (kind % 4) * 0.024),
              leafAngle + Math.PI / 2,
              palette.leaves[leaf % palette.leaves.length],
              element.glow,
              0.78 * alpha
            );
          }
        }
      }
    }

    function drawQuetzalMushroomPatch(x, y, radiusPx, progress, character, alpha, kind) {
      const glowPalettes = [
        ["#7c2d12", "#22d3ee", "#a7f3d0"],
        ["#78350f", "#f0abfc", "#c084fc"],
        ["#5c2e0e", "#bef264", "#84cc16"],
        ["#6b4423", "#fb7185", "#f9a8d4"],
        ["#4b2e18", "#60a5fa", "#bfdbfe"],
        ["#7f1d1d", "#facc15", "#fde68a"],
        ["#3f2a1d", "#2dd4bf", "#99f6e4"],
        ["#5f3b16", "#e879f9", "#f5d0fe"]
      ];
      const palette = glowPalettes[kind % glowPalettes.length];
      const caps = 3 + (kind % 5);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      for (let cap = 0; cap < caps; cap += 1) {
        const angle = cap * Math.PI * 2 / caps + kind * 0.39;
        const mx = x + Math.cos(angle) * radiusPx * (0.08 + (cap % 3) * 0.13);
        const my = y + Math.sin(angle) * radiusPx * 0.48 + radiusPx * 0.1;
        const size = cellSize * (0.22 + (kind % 4) * 0.035 + cap * 0.01);
        ctx.beginPath();
        ctx.roundRect?.(mx - size * 0.15, my - size * 0.08, size * 0.3, size * 0.58, size * 0.12);
        if (!ctx.roundRect) ctx.rect(mx - size * 0.15, my - size * 0.08, size * 0.3, size * 0.58);
        ctx.fillStyle = hexToRgba("#b08968", 0.66 * alpha);
        ctx.fill();
        ctx.beginPath();
        if (kind % 4 === 0) ctx.arc(mx, my - size * 0.12, size * 0.42, Math.PI, Math.PI * 2);
        else if (kind % 4 === 1) ctx.ellipse(mx, my - size * 0.1, size * 0.52, size * 0.28, 0, Math.PI, Math.PI * 2);
        else if (kind % 4 === 2) {
          ctx.moveTo(mx - size * 0.48, my - size * 0.02);
          ctx.quadraticCurveTo(mx, my - size * 0.68, mx + size * 0.48, my - size * 0.02);
        } else {
          ctx.moveTo(mx - size * 0.42, my - size * 0.02);
          ctx.lineTo(mx, my - size * 0.58);
          ctx.lineTo(mx + size * 0.42, my - size * 0.02);
        }
        ctx.closePath();
        ctx.fillStyle = hexToRgba(palette[0], 0.82 * alpha);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(palette[1], 0.72 * alpha);
        ctx.lineWidth = Math.max(1.2, cellSize * 0.035);
        ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.arc(mx, my - size * 0.18, size * (0.22 + waveValue(progress, cap * 0.13) * 0.1), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(palette[1 + (cap % 2)], 0.28 * alpha);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    }

    function drawSwampForestBloom(x, y, radiusPx, progress, character, alpha = 1, variant = 0) {
      const element = elementColorsFor(character);
      const normalizedVariant = Math.abs(Math.floor(variant)) % 64;
      const category = Math.floor(normalizedVariant / 16);
      const kind = normalizedVariant % 16;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.ellipse(x, y + radiusPx * 0.2, radiusPx * 0.95, radiusPx * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(category === 3 ? "#6b4423" : element.mud || "#6b4423", category === 3 ? 0.42 * alpha : 0.32 * alpha);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y + radiusPx * 0.12, radiusPx * 0.78, radiusPx * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(category === 3 ? "#4b2e18" : element.deep, category === 3 ? 0.28 * alpha : 0.22 * alpha);
      ctx.fill();
      if (category === 0) drawQuetzalFlowerPatch(x, y, radiusPx, progress, character, alpha, kind);
      else if (category === 1) drawQuetzalGrassPatch(x, y, radiusPx, progress, character, alpha, kind);
      else if (category === 2) drawQuetzalTreePatch(x, y, radiusPx, progress, character, alpha, kind);
      else drawQuetzalMushroomPatch(x, y, radiusPx, progress, character, alpha, kind);
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.55 + progress * 0.2), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(category === 3 ? "#7c2d12" : element.deep, 0.14 * alpha);
      ctx.fill();
      drawElementMotifs(x, y, radiusPx * 0.72, progress, character, 0.42 * alpha, 8);
      ctx.restore();
    }

    const QUETZAL_BLOOM_VARIANTS = [
      [
        { name: "magnolia", silhouette: "bowl", palette: ["#fff7ed", "#fde68a", "#166534"], motion: "open" },
        { name: "phalaenopsis", silhouette: "orchid", palette: ["#f0abfc", "#a855f7", "#fef3c7"], motion: "flutter" },
        { name: "sunflower", silhouette: "sunhead", palette: ["#facc15", "#78350f", "#15803d"], motion: "rotate" },
        { name: "passionflower", silhouette: "filament", palette: ["#c084fc", "#67e8f9", "#fef3c7"], motion: "spark" },
        { name: "maize tassel", silhouette: "tassel", palette: ["#fbbf24", "#a16207", "#65a30d"], motion: "shake" },
        { name: "rafflesia", silhouette: "giant", palette: ["#b91c1c", "#f97316", "#fef2f2"], motion: "pulse" },
        { name: "dandelion", silhouette: "puff", palette: ["#f8fafc", "#fef3c7", "#84cc16"], motion: "scatter" },
        { name: "daisy", silhouette: "daisy", palette: ["#ffffff", "#facc15", "#16a34a"], motion: "open" },
        { name: "tulip", silhouette: "cup", palette: ["#fb7185", "#fda4af", "#15803d"], motion: "sway" },
        { name: "rose", silhouette: "spiral", palette: ["#e11d48", "#fb7185", "#166534"], motion: "unfurl" },
        { name: "lotus", silhouette: "lotus", palette: ["#f9a8d4", "#fef3c7", "#0f766e"], motion: "float" },
        { name: "iris", silhouette: "iris", palette: ["#6366f1", "#facc15", "#14532d"], motion: "fan" },
        { name: "hibiscus", silhouette: "hibiscus", palette: ["#ef4444", "#fef08a", "#166534"], motion: "flare" },
        { name: "hydrangea", silhouette: "cluster", palette: ["#93c5fd", "#dbeafe", "#15803d"], motion: "bob" },
        { name: "lily", silhouette: "starcup", palette: ["#fde68a", "#ffffff", "#16a34a"], motion: "open" },
        { name: "poppy", silhouette: "poppy", palette: ["#dc2626", "#111827", "#65a30d"], motion: "ripple" }
      ],
      [
        { name: "rice", silhouette: "drooping grain", palette: ["#84cc16", "#facc15", "#14532d"], motion: "bow" },
        { name: "wheat", silhouette: "awn spike", palette: ["#d97706", "#fde68a", "#65a30d"], motion: "shake" },
        { name: "maize", silhouette: "corn leaf", palette: ["#16a34a", "#facc15", "#166534"], motion: "fan" },
        { name: "oat", silhouette: "open panicle", palette: ["#a3e635", "#fef3c7", "#4d7c0f"], motion: "bob" },
        { name: "barley", silhouette: "long awn", palette: ["#ca8a04", "#fde68a", "#365314"], motion: "bristle" },
        { name: "millet", silhouette: "bead panicle", palette: ["#65a30d", "#facc15", "#14532d"], motion: "bead" },
        { name: "bamboo", silhouette: "joint cane", palette: ["#15803d", "#bbf7d0", "#14532d"], motion: "joint" },
        { name: "reed", silhouette: "reed plume", palette: ["#84cc16", "#c4b5fd", "#365314"], motion: "plume" },
        { name: "lawn", silhouette: "turf", palette: ["#22c55e", "#86efac", "#166534"], motion: "crawl" },
        { name: "pasture", silhouette: "mixed blade", palette: ["#16a34a", "#bef264", "#14532d"], motion: "gust" },
        { name: "foxtail", silhouette: "foxtail", palette: ["#65a30d", "#d9f99d", "#365314"], motion: "tail" },
        { name: "silvergrass", silhouette: "arching plume", palette: ["#a8a29e", "#f5f5f4", "#365314"], motion: "arc" },
        { name: "lemongrass", silhouette: "knife fan", palette: ["#a3e635", "#fef08a", "#3f6212"], motion: "slice" },
        { name: "sugarcane", silhouette: "thick cane", palette: ["#16a34a", "#fbbf24", "#78350f"], motion: "node" },
        { name: "tussock", silhouette: "mound", palette: ["#4d7c0f", "#a3e635", "#1f2937"], motion: "tuft" },
        { name: "saltgrass", silhouette: "low runner", palette: ["#14b8a6", "#ccfbf1", "#155e75"], motion: "runner" }
      ],
      [
        { name: "ash", silhouette: "compound crown", palette: ["#166534", "#86efac", "#6b4423"], motion: "leaf" },
        { name: "larch", silhouette: "deciduous conifer", palette: ["#65a30d", "#facc15", "#78350f"], motion: "needle" },
        { name: "pine", silhouette: "pine tier", palette: ["#14532d", "#22c55e", "#6b4423"], motion: "tier" },
        { name: "fir", silhouette: "fir spire", palette: ["#064e3b", "#bbf7d0", "#4b2e18"], motion: "spire" },
        { name: "oak", silhouette: "round crown", palette: ["#15803d", "#84cc16", "#78350f"], motion: "breath" },
        { name: "maple", silhouette: "lobed leaf", palette: ["#ef4444", "#f97316", "#78350f"], motion: "spin" },
        { name: "willow", silhouette: "weeping", palette: ["#84cc16", "#bbf7d0", "#6b4423"], motion: "drip" },
        { name: "palm", silhouette: "palm", palette: ["#16a34a", "#bef264", "#854d0e"], motion: "fan" },
        { name: "tree fern", silhouette: "fern crown", palette: ["#22c55e", "#a7f3d0", "#4b2e18"], motion: "frond" },
        { name: "banana", silhouette: "banana leaf", palette: ["#65a30d", "#bef264", "#78350f"], motion: "fold" },
        { name: "bamboo grove", silhouette: "grove", palette: ["#15803d", "#bbf7d0", "#14532d"], motion: "joint" },
        { name: "mangrove", silhouette: "prop root", palette: ["#0f766e", "#67e8f9", "#6b4423"], motion: "root" },
        { name: "baobab", silhouette: "bottle trunk", palette: ["#84cc16", "#d9f99d", "#7c2d12"], motion: "pulse" },
        { name: "banyan", silhouette: "aerial root", palette: ["#166534", "#86efac", "#4b2e18"], motion: "drop" },
        { name: "kapok", silhouette: "cotton pod", palette: ["#16a34a", "#f8fafc", "#854d0e"], motion: "seed" },
        { name: "flame tree", silhouette: "flame crown", palette: ["#ef4444", "#f97316", "#78350f"], motion: "flare" }
      ],
      [
        { name: "button mushroom", silhouette: "agaric", palette: ["#f5f5f4", "#a8a29e", "#7c2d12"], motion: "cap" },
        { name: "fly agaric", silhouette: "spotted cap", palette: ["#dc2626", "#ffffff", "#7c2d12"], motion: "blink" },
        { name: "shiitake", silhouette: "flat cap", palette: ["#78350f", "#d6d3d1", "#4b2e18"], motion: "cap" },
        { name: "enoki", silhouette: "pin cluster", palette: ["#fef3c7", "#ffffff", "#854d0e"], motion: "sprout" },
        { name: "oyster", silhouette: "shelf fan", palette: ["#d6d3d1", "#93c5fd", "#4b2e18"], motion: "fan" },
        { name: "chanterelle", silhouette: "trumpet", palette: ["#f59e0b", "#fde68a", "#7c2d12"], motion: "flare" },
        { name: "milk cap", silhouette: "ring cap", palette: ["#fb923c", "#fef3c7", "#7c2d12"], motion: "ring" },
        { name: "russula", silhouette: "cracked cap", palette: ["#be123c", "#fecdd3", "#4b2e18"], motion: "crack" },
        { name: "bolete", silhouette: "pore cap", palette: ["#92400e", "#facc15", "#4b2e18"], motion: "pore" },
        { name: "morel", silhouette: "honeycomb", palette: ["#a16207", "#fde68a", "#4b2e18"], motion: "cell" },
        { name: "puffball", silhouette: "puffball", palette: ["#f5f5f4", "#bef264", "#78716c"], motion: "spore" },
        { name: "stinkhorn", silhouette: "stinkhorn", palette: ["#f97316", "#4b2e18", "#fef3c7"], motion: "rise" },
        { name: "truffle", silhouette: "truffle", palette: ["#3f2a1d", "#a16207", "#facc15"], motion: "burrow" },
        { name: "coral fungus", silhouette: "coral", palette: ["#fb7185", "#f9a8d4", "#7c2d12"], motion: "branch" },
        { name: "bracket fungus", silhouette: "bracket", palette: ["#b45309", "#fef3c7", "#4b2e18"], motion: "shelf" },
        { name: "jelly fungus", silhouette: "jelly", palette: ["#facc15", "#f0abfc", "#7c2d12"], motion: "wobble" }
      ]
    ];

    let quetzalBloomPreviewUntil = 0;

    function quetzalBloomVariant(category, kind) {
      return QUETZAL_BLOOM_VARIANTS[category]?.[kind] || QUETZAL_BLOOM_VARIANTS[0][0];
    }

    function drawQuetzalGlowDust(x, y, radiusPx, progress, palette, alpha, count = 8) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < count; i += 1) {
        const angle = progress * Math.PI * 2 + i * Math.PI * 2 / count;
        const distance = radiusPx * (0.12 + ((i * 5) % 8) * 0.075);
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.68, cellSize * (0.035 + (i % 3) * 0.014), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(palette[i % palette.length], alpha * (0.5 + waveValue(progress, i * 0.09) * 0.28));
        ctx.fill();
      }
      ctx.restore();
    }

    function drawQuetzalPetal(cx, cy, size, angle, palette, alpha, style = "oval") {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.beginPath();
      if (style === "point") {
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.34, size * 0.28);
        ctx.lineTo(0, size * 0.82);
        ctx.lineTo(-size * 0.34, size * 0.28);
      } else if (style === "cup") {
        ctx.moveTo(-size * 0.52, size * 0.2);
        ctx.quadraticCurveTo(0, -size * 1.08, size * 0.52, size * 0.2);
        ctx.quadraticCurveTo(0, size * 0.56, -size * 0.52, size * 0.2);
      } else if (style === "ribbon") {
        ctx.moveTo(0, -size);
        ctx.bezierCurveTo(size * 0.64, -size * 0.5, size * 0.18, size * 0.45, 0, size);
        ctx.bezierCurveTo(-size * 0.48, size * 0.28, -size * 0.38, -size * 0.42, 0, -size);
      } else {
        ctx.ellipse(0, 0, size * 0.36, size * 0.78, 0, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(palette[0], 0.74 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(palette[1], 0.78 * alpha);
      ctx.lineWidth = Math.max(1, cellSize * 0.025);
      ctx.stroke();
      ctx.restore();
    }

    function drawQuetzalLeafBlade(x, y, length, angle, palette, alpha, width = 0.28) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(length * width, -length * 0.48, 0, -length);
      ctx.quadraticCurveTo(-length * width * 0.72, -length * 0.4, 0, 0);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(palette[0], 0.58 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(palette[1], 0.72 * alpha);
      ctx.lineWidth = Math.max(1, cellSize * 0.028);
      ctx.stroke();
      ctx.restore();
    }

    function drawQuetzalFlowerPatch(x, y, radiusPx, progress, character, alpha, kind) {
      const variant = quetzalBloomVariant(0, kind);
      const palette = variant.palette;
      radiusPx *= 1.14;
      const pulse = 0.88 + waveValue(progress, kind * 0.03) * 0.22;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const centerY = y + radiusPx * 0.02;
      if (variant.silhouette === "bowl" || variant.silhouette === "cup" || variant.silhouette === "starcup") {
        const petals = variant.silhouette === "starcup" ? 6 : 5;
        for (let i = 0; i < petals; i += 1) {
          const angle = -Math.PI / 2 + (i - (petals - 1) / 2) * 0.36;
          drawQuetzalPetal(x + Math.cos(angle) * radiusPx * 0.12, centerY + Math.sin(angle) * radiusPx * 0.08, radiusPx * 0.32 * pulse, angle + Math.PI / 2, palette, alpha, variant.silhouette === "starcup" ? "point" : "cup");
        }
      } else if (variant.silhouette === "orchid") {
        [0, 1, 2, 3, 4].forEach(i => {
          const angle = -Math.PI / 2 + i * Math.PI * 2 / 5 + progress * 0.12;
          drawQuetzalPetal(x + Math.cos(angle) * radiusPx * 0.12, centerY + Math.sin(angle) * radiusPx * 0.08, radiusPx * (i === 2 ? 0.42 : 0.28), angle, palette, alpha, i === 2 ? "ribbon" : "oval");
        });
      } else if (variant.silhouette === "sunhead" || variant.silhouette === "daisy") {
        const petals = variant.silhouette === "sunhead" ? 18 : 12;
        for (let i = 0; i < petals; i += 1) {
          const angle = i * Math.PI * 2 / petals + progress * 0.22;
          drawQuetzalPetal(x + Math.cos(angle) * radiusPx * 0.28, centerY + Math.sin(angle) * radiusPx * 0.2, radiusPx * 0.18, angle + Math.PI / 2, palette, alpha, "oval");
        }
        ctx.beginPath();
        ctx.arc(x, centerY, radiusPx * (variant.silhouette === "sunhead" ? 0.22 : 0.14), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(palette[1], 0.9 * alpha);
        ctx.fill();
      } else if (variant.silhouette === "filament") {
        for (let i = 0; i < 24; i += 1) {
          const angle = i * Math.PI * 2 / 24 + progress * 0.8;
          ctx.beginPath();
          ctx.moveTo(x, centerY);
          ctx.quadraticCurveTo(x + Math.cos(angle) * radiusPx * 0.32, centerY + Math.sin(angle) * radiusPx * 0.22, x + Math.cos(angle) * radiusPx * 0.48, centerY + Math.sin(angle) * radiusPx * 0.34);
          ctx.strokeStyle = hexToRgba(palette[i % 2], 0.64 * alpha);
          ctx.lineWidth = Math.max(1, cellSize * 0.025);
          ctx.stroke();
        }
      } else if (variant.silhouette === "tassel") {
        for (let i = 0; i < 9; i += 1) {
          const bx = x + (i - 4) * radiusPx * 0.07;
          ctx.beginPath();
          ctx.moveTo(bx, y + radiusPx * 0.28);
          ctx.lineTo(bx + Math.sin(progress * 5 + i) * radiusPx * 0.06, y - radiusPx * (0.18 + (i % 3) * 0.08));
          ctx.strokeStyle = hexToRgba(palette[i % 2], 0.72 * alpha);
          ctx.lineWidth = Math.max(1.2, cellSize * 0.034);
          ctx.stroke();
        }
      } else if (variant.silhouette === "giant") {
        for (let i = 0; i < 5; i += 1) {
          const angle = i * Math.PI * 2 / 5 + progress * 0.08;
          drawQuetzalPetal(x + Math.cos(angle) * radiusPx * 0.2, centerY + Math.sin(angle) * radiusPx * 0.15, radiusPx * 0.44 * pulse, angle + Math.PI / 2, palette, alpha, "cup");
        }
        ctx.beginPath();
        ctx.arc(x, centerY, radiusPx * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba("#3f1d1d", 0.88 * alpha);
        ctx.fill();
      } else if (variant.silhouette === "puff") {
        for (let i = 0; i < 28; i += 1) {
          const angle = i * Math.PI * 2 / 28;
          drawLightningBetween({ x, y: centerY }, { x: x + Math.cos(angle) * radiusPx * 0.42, y: centerY + Math.sin(angle) * radiusPx * 0.32 }, progress + i * 0.03, palette[0], 0.18, 2);
        }
      } else if (variant.silhouette === "spiral") {
        for (let i = 0; i < 13; i += 1) {
          const angle = i * 0.72 + progress * 0.28;
          const distance = radiusPx * (0.05 + i * 0.025);
          drawQuetzalPetal(x + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance * 0.72, radiusPx * (0.13 + i * 0.01), angle + Math.PI / 2, palette, alpha, "cup");
        }
      } else if (variant.silhouette === "lotus") {
        for (let row = 0; row < 2; row += 1) {
          for (let i = 0; i < 7 - row; i += 1) {
            const angle = -Math.PI * 0.82 + i * Math.PI * 1.64 / (6 - row);
            drawQuetzalPetal(x + Math.cos(angle) * radiusPx * (0.22 + row * 0.08), centerY + Math.sin(angle) * radiusPx * 0.14, radiusPx * (0.22 + row * 0.04), angle + Math.PI / 2, palette, alpha, "point");
          }
        }
      } else if (variant.silhouette === "iris" || variant.silhouette === "hibiscus" || variant.silhouette === "poppy") {
        const petals = variant.silhouette === "iris" ? 3 : 5;
        for (let i = 0; i < petals; i += 1) {
          const angle = i * Math.PI * 2 / petals - Math.PI / 2 + progress * 0.1;
          drawQuetzalPetal(x + Math.cos(angle) * radiusPx * 0.12, centerY + Math.sin(angle) * radiusPx * 0.08, radiusPx * 0.38, angle + Math.PI / 2, palette, alpha, variant.silhouette === "iris" ? "ribbon" : "oval");
        }
        if (variant.silhouette === "hibiscus") drawLightningBetween({ x, y: centerY }, { x: x + radiusPx * 0.34, y: centerY - radiusPx * 0.08 }, progress, palette[1], 0.28, 4);
      } else if (variant.silhouette === "cluster") {
        for (let i = 0; i < 14; i += 1) {
          const angle = i * Math.PI * 2 / 14;
          const distance = radiusPx * (0.08 + (i % 4) * 0.07);
          for (let p = 0; p < 4; p += 1) drawQuetzalPetal(x + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance * 0.68, radiusPx * 0.07, p * Math.PI / 2 + progress, palette, alpha, "oval");
        }
      }
      ctx.beginPath();
      ctx.arc(x, centerY, radiusPx * 0.055, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(palette[1], 0.9 * alpha);
      ctx.fill();
      drawQuetzalGlowDust(x, y, radiusPx, progress, palette, alpha, variant.motion === "scatter" ? 22 : 12);
      ctx.restore();
      drawQuetzalGrassPatch(x, y + radiusPx * 0.19, radiusPx * 0.64, progress, character, alpha * 0.42, 8 + (kind % 4));
    }

    function drawQuetzalGrassPatch(x, y, radiusPx, progress, character, alpha, kind) {
      const variant = quetzalBloomVariant(1, kind);
      const palette = variant.palette;
      radiusPx *= 1.12;
      const sway = Math.sin(progress * Math.PI * 2 + kind) * radiusPx * 0.08;
      const drawBlade = (baseX, baseY, height, angle, width = 1) => {
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(baseX + Math.cos(angle) * radiusPx * 0.18 + sway, baseY - height * 0.54, baseX + Math.cos(angle) * radiusPx * 0.28 + sway, baseY - height);
        ctx.strokeStyle = hexToRgba(palette[0], 0.72 * alpha);
        ctx.lineWidth = Math.max(1.1, cellSize * 0.028 * width);
        ctx.lineCap = "round";
        ctx.stroke();
      };
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      if (variant.silhouette === "joint cane" || variant.silhouette === "thick cane") {
        const canes = variant.silhouette === "thick cane" ? 4 : 7;
        for (let c = 0; c < canes; c += 1) {
          const bx = x + (c - (canes - 1) / 2) * radiusPx * 0.16;
          const top = y - radiusPx * (0.48 + (c % 2) * 0.14);
          ctx.beginPath();
          ctx.moveTo(bx, y + radiusPx * 0.34);
          ctx.lineTo(bx + sway * 0.4, top);
          ctx.strokeStyle = hexToRgba(palette[0], 0.82 * alpha);
          ctx.lineWidth = Math.max(2, cellSize * (variant.silhouette === "thick cane" ? 0.072 : 0.046));
          ctx.stroke();
          for (let n = 0; n < 4; n += 1) {
            const ny = y + radiusPx * 0.2 - n * radiusPx * 0.18;
            ctx.beginPath();
            ctx.arc(bx + sway * 0.12, ny, cellSize * 0.025, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(palette[1], 0.64 * alpha);
            ctx.fill();
          }
        }
      } else if (variant.silhouette.includes("spike") || variant.silhouette.includes("grain") || variant.silhouette.includes("awn")) {
        ctx.beginPath();
        ctx.moveTo(x, y + radiusPx * 0.36);
        ctx.lineTo(x + sway, y - radiusPx * 0.5);
        ctx.strokeStyle = hexToRgba(palette[2], 0.78 * alpha);
        ctx.lineWidth = Math.max(1.4, cellSize * 0.035);
        ctx.stroke();
        const grains = variant.silhouette === "long awn" ? 12 : 10;
        for (let i = 0; i < grains; i += 1) {
          const gy = y + radiusPx * 0.18 - i * radiusPx * 0.095;
          const side = i % 2 ? 1 : -1;
          drawQuetzalPetal(x + sway + side * radiusPx * 0.07, gy, radiusPx * 0.075, side * 0.85, palette, alpha, "point");
          if (variant.silhouette === "long awn" || variant.silhouette === "awn spike") drawLightningBetween({ x: x + sway, y: gy }, { x: x + sway + side * radiusPx * 0.32, y: gy - radiusPx * 0.18 }, progress + i * 0.04, palette[1], 0.16, 2);
        }
      } else if (variant.silhouette.includes("panicle") || variant.silhouette === "bead panicle") {
        for (let branch = 0; branch < 11; branch += 1) {
          const angle = -Math.PI / 2 + (branch - 5) * 0.18;
          drawLightningBetween({ x, y: y + radiusPx * 0.24 }, { x: x + Math.cos(angle) * radiusPx * 0.48 + sway, y: y + Math.sin(angle) * radiusPx * 0.56 }, progress + branch * 0.05, palette[0], 0.24, 3);
          if (variant.silhouette === "bead panicle") {
            ctx.beginPath();
            ctx.arc(x + Math.cos(angle) * radiusPx * 0.42 + sway, y + Math.sin(angle) * radiusPx * 0.5, cellSize * 0.045, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(palette[1], 0.78 * alpha);
            ctx.fill();
          }
        }
      } else if (variant.silhouette.includes("plume") || variant.silhouette === "foxtail" || variant.silhouette === "arching plume") {
        const stemTop = { x: x + sway, y: y - radiusPx * 0.45 };
        drawBlade(x, y + radiusPx * 0.32, radiusPx * 0.75, -Math.PI / 2, 1.4);
        for (let i = 0; i < 24; i += 1) {
          const angle = -Math.PI / 2 + (i - 8) * 0.12;
          ctx.beginPath();
          ctx.ellipse(stemTop.x + Math.cos(angle) * radiusPx * 0.12, stemTop.y + Math.sin(angle) * radiusPx * 0.16, cellSize * 0.035, cellSize * 0.09, angle, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(i % 2 ? palette[1] : palette[0], 0.58 * alpha);
          ctx.fill();
        }
      } else if (variant.silhouette === "low runner") {
        for (let i = 0; i < 8; i += 1) {
          const sx = x - radiusPx * 0.56 + i * radiusPx * 0.16;
          drawLightningBetween({ x: sx, y: y + radiusPx * 0.2 }, { x: sx + radiusPx * 0.22, y: y + radiusPx * 0.16 + Math.sin(progress * 6 + i) * radiusPx * 0.03 }, progress + i * 0.04, palette[0], 0.2, 3);
          drawBlade(sx + radiusPx * 0.1, y + radiusPx * 0.22, radiusPx * 0.28, -Math.PI / 2 + (i % 2 ? 0.4 : -0.4));
        }
      } else {
        const blades = variant.silhouette === "turf" ? 38 : variant.silhouette === "mound" ? 34 : 22;
        for (let i = 0; i < blades; i += 1) {
          const angle = -Math.PI / 2 + (i / Math.max(1, blades - 1) - 0.5) * (variant.silhouette === "knife fan" ? 1.8 : 2.8);
          const bx = x + Math.cos(i * 2.7) * radiusPx * (variant.silhouette === "mound" ? 0.22 : 0.36);
          const by = y + radiusPx * (0.32 - (i % 4) * 0.02);
          drawBlade(bx, by, radiusPx * (0.28 + (i % 5) * 0.05), angle, variant.silhouette === "knife fan" ? 1.6 : 1);
        }
      }
      drawQuetzalGlowDust(x, y, radiusPx, progress, palette, alpha * 0.82, 10);
      ctx.restore();
    }

    function drawQuetzalTreePatch(x, y, radiusPx, progress, character, alpha, kind) {
      const variant = quetzalBloomVariant(2, kind);
      const palette = variant.palette;
      radiusPx *= 1.1;
      const sway = Math.sin(progress * Math.PI * 2 + kind) * radiusPx * 0.035;
      const trunkHeight = radiusPx * (variant.silhouette === "bottle trunk" ? 0.76 : 0.6);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      if (variant.silhouette === "bottle trunk") {
        ctx.moveTo(x - radiusPx * 0.18, y + radiusPx * 0.35);
        ctx.quadraticCurveTo(x - radiusPx * 0.32, y - radiusPx * 0.04, x - radiusPx * 0.08, y - trunkHeight);
        ctx.lineTo(x + radiusPx * 0.08, y - trunkHeight);
        ctx.quadraticCurveTo(x + radiusPx * 0.32, y - radiusPx * 0.04, x + radiusPx * 0.18, y + radiusPx * 0.35);
      } else {
        ctx.moveTo(x, y + radiusPx * 0.35);
        ctx.bezierCurveTo(x - radiusPx * 0.08, y, x + radiusPx * 0.08 + sway, y - radiusPx * 0.28, x + sway, y - trunkHeight);
      }
      ctx.strokeStyle = hexToRgba(palette[2], 0.86 * alpha);
      ctx.lineWidth = Math.max(2.2, cellSize * (variant.silhouette === "bottle trunk" ? 0.12 : 0.07));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      const crownY = y - trunkHeight;
      if (variant.silhouette.includes("conifer") || variant.silhouette.includes("pine") || variant.silhouette.includes("fir")) {
        const tiers = variant.silhouette === "fir spire" ? 6 : 5;
        for (let t = 0; t < tiers; t += 1) {
          const cy = crownY + t * radiusPx * 0.14;
          ctx.beginPath();
          ctx.moveTo(x + sway, cy - radiusPx * 0.18);
          ctx.lineTo(x - radiusPx * (0.34 - t * 0.035), cy + radiusPx * 0.12);
          ctx.lineTo(x + radiusPx * (0.34 - t * 0.035), cy + radiusPx * 0.12);
          ctx.closePath();
          ctx.fillStyle = hexToRgba(palette[t % 2], 0.66 * alpha);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(palette[1], 0.48 * alpha);
          ctx.stroke();
        }
      } else if (variant.silhouette === "palm" || variant.silhouette === "fern crown" || variant.silhouette === "banana leaf") {
        const fronds = variant.silhouette === "banana leaf" ? 9 : 12;
        for (let i = 0; i < fronds; i += 1) {
          const angle = -Math.PI / 2 + (i - (fronds - 1) / 2) * (variant.silhouette === "banana leaf" ? 0.34 : 0.26);
          drawQuetzalLeafBlade(x + sway, crownY, radiusPx * (variant.silhouette === "banana leaf" ? 0.52 : 0.46), angle, palette, alpha, variant.silhouette === "banana leaf" ? 0.48 : 0.22);
        }
      } else if (variant.silhouette === "weeping") {
        for (let i = 0; i < 20; i += 1) {
          const angle = i * Math.PI * 2 / 20;
          drawLightningBetween({ x: x + Math.cos(angle) * radiusPx * 0.2, y: crownY + Math.sin(angle) * radiusPx * 0.12 }, { x: x + Math.cos(angle) * radiusPx * 0.36, y: crownY + radiusPx * (0.42 + (i % 3) * 0.06) }, progress + i * 0.04, palette[0], 0.18, 3);
        }
      } else if (variant.silhouette === "prop root" || variant.silhouette === "aerial root") {
        for (let i = 0; i < 11; i += 1) {
          const side = i - 5;
          drawLightningBetween({ x: x + side * radiusPx * 0.04, y: y - radiusPx * 0.15 }, { x: x + side * radiusPx * 0.12, y: y + radiusPx * 0.38 }, progress + i * 0.04, palette[2], 0.28, 3);
        }
        for (let i = 0; i < 14; i += 1) drawQuetzalLeafBlade(x + Math.cos(i) * radiusPx * 0.24, crownY + Math.sin(i) * radiusPx * 0.13, radiusPx * 0.24, i, palette, alpha, 0.34);
      } else if (variant.silhouette === "grove") {
        for (let c = 0; c < 8; c += 1) {
          const bx = x + (c - 3.5) * radiusPx * 0.09;
          ctx.beginPath();
          ctx.moveTo(bx, y + radiusPx * 0.34);
          ctx.lineTo(bx + sway, y - radiusPx * (0.42 + (c % 2) * 0.12));
          ctx.strokeStyle = hexToRgba(palette[0], 0.74 * alpha);
          ctx.lineWidth = Math.max(1.4, cellSize * 0.04);
          ctx.stroke();
        }
      } else {
        const leaves = variant.silhouette === "flame crown" ? 24 : 18;
        for (let i = 0; i < leaves; i += 1) {
          const angle = i * Math.PI * 2 / leaves + progress * (variant.silhouette === "lobed leaf" ? 0.4 : 0.1);
          if (variant.silhouette === "lobed leaf") drawElementShard(x + Math.cos(angle) * radiusPx * 0.28, crownY + Math.sin(angle) * radiusPx * 0.18, radiusPx * 0.12, angle, palette[i % 2], alpha);
          else drawQuetzalLeafBlade(x + Math.cos(angle) * radiusPx * 0.24, crownY + Math.sin(angle) * radiusPx * 0.16, radiusPx * 0.18, angle + Math.PI / 2, palette, alpha, 0.42);
        }
      }
      drawQuetzalGlowDust(x, crownY, radiusPx * 0.9, progress, palette, alpha, variant.motion === "seed" ? 18 : 9);
      ctx.restore();
    }

    function drawQuetzalMushroomPatch(x, y, radiusPx, progress, character, alpha, kind) {
      const variant = quetzalBloomVariant(3, kind);
      const palette = variant.palette;
      radiusPx *= 1.14;
      const pulse = 0.92 + waveValue(progress, kind * 0.05) * 0.18;
      const drawStem = (mx, my, height, width = 0.16) => {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(mx - radiusPx * width * 0.5, my - height, radiusPx * width, height, radiusPx * width * 0.5);
        else ctx.rect(mx - radiusPx * width * 0.5, my - height, radiusPx * width, height);
        ctx.fillStyle = hexToRgba("#d6d3d1", 0.62 * alpha);
        ctx.fill();
      };
      const drawCap = (mx, my, width, height, style = "dome") => {
        ctx.beginPath();
        if (style === "cone") {
          ctx.moveTo(mx - width * 0.5, my);
          ctx.lineTo(mx, my - height);
          ctx.lineTo(mx + width * 0.5, my);
        } else if (style === "flat") {
          ctx.ellipse(mx, my - height * 0.35, width * 0.52, height * 0.28, 0, Math.PI, Math.PI * 2);
          ctx.lineTo(mx + width * 0.46, my);
          ctx.lineTo(mx - width * 0.46, my);
        } else {
          ctx.ellipse(mx, my, width * 0.5, height * 0.42, 0, Math.PI, Math.PI * 2);
          ctx.lineTo(mx + width * 0.5, my);
          ctx.lineTo(mx - width * 0.5, my);
        }
        ctx.closePath();
        ctx.fillStyle = hexToRgba(palette[0], 0.82 * alpha);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(palette[1], 0.7 * alpha);
        ctx.lineWidth = Math.max(1.1, cellSize * 0.03);
        ctx.stroke();
      };
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      if (variant.silhouette === "puffball") {
        for (let i = 0; i < 7; i += 1) {
          const mx = x + Math.cos(i * 1.8) * radiusPx * 0.2;
          const my = y + Math.sin(i * 1.8) * radiusPx * 0.12;
          ctx.beginPath();
          ctx.arc(mx, my, radiusPx * (0.16 + i * 0.025) * pulse, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(palette[0], 0.74 * alpha);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(palette[1], 0.46 * alpha);
          ctx.stroke();
        }
        drawQuetzalGlowDust(x, y, radiusPx, progress, palette, alpha, 24);
      } else if (variant.silhouette === "honeycomb") {
        drawStem(x, y + radiusPx * 0.34, radiusPx * 0.45, 0.18);
        ctx.beginPath();
        ctx.ellipse(x, y - radiusPx * 0.2, radiusPx * 0.26, radiusPx * 0.46, 0, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(palette[0], 0.82 * alpha);
        ctx.fill();
        for (let i = 0; i < 12; i += 1) {
          ctx.beginPath();
          ctx.arc(x + ((i % 3) - 1) * radiusPx * 0.1, y - radiusPx * (0.48 - Math.floor(i / 3) * 0.16), cellSize * 0.035, 0, Math.PI * 2);
          ctx.strokeStyle = hexToRgba(palette[1], 0.64 * alpha);
          ctx.stroke();
        }
      } else if (variant.silhouette === "stinkhorn") {
        drawStem(x, y + radiusPx * 0.34, radiusPx * 0.78 * pulse, 0.18);
        drawCap(x, y - radiusPx * 0.44, radiusPx * 0.28, radiusPx * 0.42, "cone");
      } else if (variant.silhouette === "truffle") {
        for (let i = 0; i < 8; i += 1) {
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(i) * radiusPx * 0.14, y + Math.sin(i * 1.7) * radiusPx * 0.12, radiusPx * 0.2, radiusPx * 0.14, i, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(i % 2 ? palette[0] : palette[1], 0.66 * alpha);
          ctx.fill();
        }
      } else if (variant.silhouette === "coral") {
        for (let b = 0; b < 18; b += 1) {
          const angle = -Math.PI / 2 + (b - 8.5) * 0.12;
          drawLightningBetween({ x, y: y + radiusPx * 0.32 }, { x: x + Math.cos(angle) * radiusPx * (0.34 + (b % 3) * 0.05), y: y + Math.sin(angle) * radiusPx * 0.78 }, progress + b * 0.03, palette[b % 2], 0.34, 4);
        }
      } else if (variant.silhouette === "bracket" || variant.silhouette === "shelf fan") {
        for (let s = 0; s < 6; s += 1) {
          ctx.beginPath();
          ctx.ellipse(x - radiusPx * 0.12 + s * radiusPx * 0.08, y - radiusPx * (0.14 - s * 0.08), radiusPx * (0.35 - s * 0.035), radiusPx * 0.13, -0.12, Math.PI, Math.PI * 2);
          ctx.fillStyle = hexToRgba(s % 2 ? palette[1] : palette[0], 0.72 * alpha);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(palette[2], 0.54 * alpha);
          ctx.stroke();
        }
      } else if (variant.silhouette === "jelly") {
        for (let j = 0; j < 8; j += 1) {
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(j * 1.6) * radiusPx * 0.18, y + Math.sin(j) * radiusPx * 0.1, radiusPx * 0.18 * pulse, radiusPx * 0.12, progress + j, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(j % 2 ? palette[1] : palette[0], 0.52 * alpha);
          ctx.fill();
        }
      } else {
        const count = variant.silhouette === "pin cluster" ? 14 : 5 + (kind % 4);
        for (let i = 0; i < count; i += 1) {
          const angle = i * Math.PI * 2 / count + kind * 0.21;
          const mx = x + Math.cos(angle) * radiusPx * (variant.silhouette === "pin cluster" ? 0.28 : 0.16);
          const my = y + Math.sin(angle) * radiusPx * 0.22 + radiusPx * 0.24;
          const height = radiusPx * (variant.silhouette === "pin cluster" ? 0.44 + (i % 3) * 0.08 : 0.34);
          drawStem(mx, my, height, variant.silhouette === "pin cluster" ? 0.08 : 0.15);
          const capStyle = variant.silhouette === "spotted cap" || variant.silhouette === "trumpet" ? "cone" : variant.silhouette === "flat cap" || variant.silhouette === "pore cap" ? "flat" : "dome";
          drawCap(mx, my - height, radiusPx * (variant.silhouette === "pin cluster" ? 0.14 : 0.32) * pulse, radiusPx * 0.2, capStyle);
          if (variant.silhouette === "spotted cap" || variant.silhouette === "pore cap" || variant.silhouette === "cracked cap") {
            for (let dot = 0; dot < 5; dot += 1) {
              ctx.beginPath();
              ctx.arc(mx + Math.cos(dot * 1.7) * radiusPx * 0.08, my - height - radiusPx * 0.05 + Math.sin(dot) * radiusPx * 0.04, cellSize * 0.025, 0, Math.PI * 2);
              ctx.fillStyle = hexToRgba(palette[1], 0.8 * alpha);
              ctx.fill();
            }
          }
        }
        drawQuetzalGlowDust(x, y, radiusPx, progress, palette, alpha, variant.motion === "pore" ? 18 : 12);
      }
      ctx.restore();
    }

    function drawSwampForestBloom(x, y, radiusPx, progress, character, alpha = 1, variant = 0) {
      const element = elementColorsFor(character);
      const normalizedVariant = Math.abs(Math.floor(variant)) % 64;
      const category = Math.floor(normalizedVariant / 16);
      const kind = normalizedVariant % 16;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.ellipse(x, y + radiusPx * 0.18, radiusPx * 1.08, radiusPx * 0.58, 0, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(category === 3 ? "#6b4423" : element.mud || "#6b4423", category === 3 ? 0.48 * alpha : 0.36 * alpha);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y + radiusPx * 0.1, radiusPx * 0.88, radiusPx * 0.48, 0, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(category === 3 ? "#4b2e18" : element.deep, category === 3 ? 0.34 * alpha : 0.24 * alpha);
      ctx.fill();
      const groundPalette = category === 3 ? ["#7c2d12", "#facc15", "#4b2e18"] : [element.primary, element.glow, element.deep];
      for (let sprig = 0; sprig < 12; sprig += 1) {
        const angle = sprig * Math.PI * 2 / 12 + normalizedVariant * 0.19;
        const sx = x + Math.cos(angle) * radiusPx * (0.36 + (sprig % 3) * 0.1);
        const sy = y + Math.sin(angle) * radiusPx * 0.28 + radiusPx * 0.22;
        drawQuetzalLeafBlade(sx, sy, radiusPx * (0.13 + (sprig % 4) * 0.025), angle - Math.PI / 2, groundPalette, alpha * 0.42, 0.32);
      }
      if (category === 0) drawQuetzalFlowerPatch(x, y, radiusPx, progress, character, alpha, kind);
      else if (category === 1) drawQuetzalGrassPatch(x, y, radiusPx, progress, character, alpha, kind);
      else if (category === 2) drawQuetzalTreePatch(x, y, radiusPx, progress, character, alpha, kind);
      else drawQuetzalMushroomPatch(x, y, radiusPx, progress, character, alpha, kind);
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.44 + waveValue(progress, normalizedVariant * 0.01) * 0.18), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(category === 3 ? "#7c2d12" : element.glow, 0.08 * alpha);
      ctx.fill();
      drawElementMotifs(x, y, radiusPx * 0.74, progress, character, 0.3 * alpha, 6);
      ctx.restore();
    }

    function drawQuetzalBloomPreview(now) {
      if (!quetzalBloomPreviewUntil || now > quetzalBloomPreviewUntil) return;
      const previewCharacter = characters.find(character => character.id === "quetzal") || characterFor("player");
      const rect = playArea.getBoundingClientRect();
      const cols = 8;
      const rows = 8;
      const gapX = rect.width / (cols + 1);
      const gapY = rect.height / (rows + 1);
      const previewSize = Math.min(gapX, gapY) * 0.38;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(2, 6, 23, 0.62)";
      ctx.fillRect(0, 0, rect.width, rect.height);
      for (let index = 0; index < 64; index += 1) {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const px = gapX * (col + 1);
        const py = gapY * (row + 1);
        drawSwampForestBloom(px, py, previewSize, (now / 2200 + index * 0.013) % 1, previewCharacter, 0.96, index);
      }
      ctx.restore();
    }

    window.previewQuetzalBloomVariants = function previewQuetzalBloomVariants(durationMs = 8000) {
      quetzalBloomPreviewUntil = performance.now() + Math.max(1000, Number(durationMs) || 8000);
      draw();
    };

    function drawRailgunLine(blast, progress, alpha, character) {
      const element = elementColorsFor(character);
      const cells = blast.lineCells || [];
      if (!cells.length) return;
      const start = axialToPixel(cells[0]);
      const end = axialToPixel(cells[cells.length - 1]);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let band = 0; band < 7; band += 1) {
        const offset = (band - 3) * cellSize * 0.2;
        ctx.beginPath();
        ctx.moveTo(start.x + nx * offset, start.y + ny * offset);
        ctx.lineTo(end.x + nx * offset, end.y + ny * offset);
        ctx.strokeStyle = hexToRgba(band === 3 ? element.primary : paletteColor(character, band), alpha * (band === 3 ? 0.98 : 0.48));
        ctx.lineWidth = Math.max(2, cellSize * (band === 3 ? 0.22 : 0.075));
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = hexToRgba("#ffffff", alpha * 0.74);
      ctx.lineWidth = Math.max(1.6, cellSize * 0.07);
      ctx.lineCap = "round";
      ctx.stroke();
      cells.forEach((cell, index) => {
        const point = axialToPixel(cell);
        if (index % 2 === 0) drawPulseRing(point.x, point.y, cellSize * (0.78 + progress * 0.55), progress, element.deep, element.glow, 0.9);
        drawLightningBetween(
          { x: point.x - nx * cellSize * 0.62, y: point.y - ny * cellSize * 0.62 },
          { x: point.x + nx * cellSize * 0.62, y: point.y + ny * cellSize * 0.62 },
          progress + index * 0.12,
          index % 4 === 0 ? "#ffffff" : index % 2 ? element.violet || element.secondary : element.primary,
          1.18,
          5
        );
      });
      for (let i = 0; i < 26; i += 1) {
        const t = (i + waveValue(progress, i * 0.03)) / 26;
        const point = { x: start.x + dx * t, y: start.y + dy * t };
        const side = i % 2 ? 1 : -1;
        const reach = cellSize * (0.62 + (i % 4) * 0.18);
        drawLightningBetween(
          { x: point.x + nx * reach * side, y: point.y + ny * reach * side },
          { x: point.x - nx * reach * side * 0.55, y: point.y - ny * reach * side * 0.55 },
          progress + i * 0.13,
          i % 5 === 0 ? "#ffffff" : i % 2 ? element.violet || element.secondary : element.primary,
          0.98,
          6
        );
      }
      ctx.restore();
    }

    function drawNuclearBloom(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const flash = Math.max(0, 1 - progress * 1.5);
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.34 + progress * 1.08), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba("#ffffff", 0.46 * flash * alpha);
      ctx.fill();
      for (let ring = 0; ring < 7; ring += 1) {
        ctx.beginPath();
        ctx.arc(x, y, radiusPx * (0.14 + progress * 0.9 + ring * 0.075), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(ring % 2 ? element.secondary : element.primary, alpha * (0.78 - ring * 0.085) * (1 - progress * 0.18));
        ctx.lineWidth = Math.max(2, cellSize * (0.15 - ring * 0.012));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      const stemHeight = radiusPx * (0.5 + progress * 0.3);
      ctx.beginPath();
      ctx.ellipse(x, y - stemHeight * 0.45, radiusPx * (0.22 + progress * 0.18), radiusPx * (0.18 + progress * 0.14), 0, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(element.secondary, 0.34 * alpha);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect?.(x - radiusPx * 0.16, y - stemHeight * 0.42, radiusPx * 0.32, stemHeight * 0.78, cellSize * 0.18);
      if (!ctx.roundRect) ctx.rect(x - radiusPx * 0.16, y - stemHeight * 0.42, radiusPx * 0.32, stemHeight * 0.78);
      ctx.fillStyle = hexToRgba(element.primary, 0.28 * alpha);
      ctx.fill();
      for (let i = 0; i < 34; i += 1) {
        const angle = i * Math.PI * 2 / 34;
        drawFlameTongue(
          x + Math.cos(angle) * radiusPx * (0.24 + progress * 0.5),
          y + Math.sin(angle) * radiusPx * (0.24 + progress * 0.34),
          cellSize * 0.42,
          angle,
          i % 2 ? element.primary : element.secondary,
          element.glow,
          0.76 * alpha
        );
      }
      ctx.restore();
    }

    function drawGhostFireBurn(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const fade = Math.max(0, 1 - progress * 0.14);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const ember = ctx.createRadialGradient(x, y, radiusPx * 0.06, x, y, radiusPx * 1.08);
      ember.addColorStop(0, hexToRgba("#fff7ed", 0.28 * alpha));
      ember.addColorStop(0.32, hexToRgba("#f97316", 0.34 * alpha));
      ember.addColorStop(0.62, hexToRgba("#7f1d1d", 0.38 * alpha));
      ember.addColorStop(1, hexToRgba("#020617", 0));
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * 1.04, 0, Math.PI * 2);
      ctx.fillStyle = ember;
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      for (let flame = 0; flame < 24; flame += 1) {
        const angle = flame * Math.PI * 2 / 24 + progress * Math.PI * 0.72;
        const orbit = radiusPx * (0.18 + (flame % 6) * 0.085);
        const fx = x + Math.cos(angle) * orbit;
        const fy = y + Math.sin(angle) * orbit * 0.62 - radiusPx * (0.06 + waveValue(progress, flame * 0.04) * 0.18);
        const size = cellSize * (0.28 + (flame % 5) * 0.045);
        drawFlameTongue(
          fx,
          fy,
          size,
          angle + Math.PI,
          flame % 3 === 0 ? "#a78bfa" : flame % 3 === 1 ? element.secondary : element.primary,
          flame % 2 ? element.glow : "#fff7ed",
          alpha * fade * (0.54 + (flame % 4) * 0.045)
        );
      }
      for (let smoke = 0; smoke < 18; smoke += 1) {
        const angle = smoke * Math.PI * 2 / 18 - progress * Math.PI * 0.55;
        const distance = radiusPx * (0.24 + (smoke % 5) * 0.09 + progress * 0.08);
        ctx.beginPath();
        ctx.ellipse(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance * 0.66 - radiusPx * 0.16,
          cellSize * (0.16 + (smoke % 3) * 0.035),
          cellSize * (0.09 + (smoke % 3) * 0.024),
          angle,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = hexToRgba(smoke % 2 ? "#7f1d1d" : "#312e81", alpha * fade * 0.2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawLobsterPalmUltimate(x, y, radiusPx, progress, character, alpha = 1, hand = "right") {
      drawGhostFireBurn(x, y, radiusPx * 1.08, progress, character, alpha * 0.82);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawPulseRing(x, y, radiusPx * 0.92, progress, "#7f1d1d", "#fff7ed", 1.15);
      ctx.restore();
      drawBuddhaPalmSeal(x, y - radiusPx * 0.04, radiusPx * 1.08, progress, character, alpha * 1.25, hand);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.arc(x, y - radiusPx * 0.04, radiusPx * (0.46 + waveValue(progress, 0.18) * 0.08), 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba("#ffffff", 0.62 * alpha);
      ctx.lineWidth = Math.max(2, cellSize * 0.075);
      ctx.stroke();
      ctx.restore();
    }

    function drawRadiationDust(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const fade = Math.max(0, 1 - progress);
      const dirty = ctx.createRadialGradient(x, y, radiusPx * 0.08, x, y, radiusPx * (0.95 + progress * 0.16));
      dirty.addColorStop(0, hexToRgba(element.secondary, 0.28 * alpha * fade));
      dirty.addColorStop(0.38, hexToRgba("#7f1d1d", 0.24 * alpha * fade));
      dirty.addColorStop(0.72, hexToRgba("#111827", 0.34 * alpha * fade));
      dirty.addColorStop(1, hexToRgba("#020617", 0));
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.96 + progress * 0.18), 0, Math.PI * 2);
      ctx.fillStyle = dirty;
      ctx.fill();
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.beginPath();
        ctx.arc(x, y, radiusPx * (0.28 + ring * 0.18 + progress * 0.12), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(ring % 2 ? "#27272a" : element.secondary, alpha * fade * (0.46 - ring * 0.06));
        ctx.lineWidth = Math.max(1.5, cellSize * (0.08 - ring * 0.008));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 42; i += 1) {
        const angle = i * Math.PI * 2 / 42 + progress * Math.PI * (i % 2 ? 0.8 : -0.6);
        const distance = radiusPx * (0.16 + ((i * 7) % 13) * 0.055 + progress * 0.2);
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.72, cellSize * (0.045 + (i % 4) * 0.022), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(i % 3 ? element.secondary : "#fef3c7", alpha * fade * 0.72);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawSpellGlyphRing(x, y, radiusPx, progress, alpha = 1) {
      const glyphs = ["KA", "RA", "LUX", "SOL", "OR", "AUM", "VE", "ZEN", "YU", "HA"];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(progress * Math.PI * 1.6);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(9, cellSize * 0.24)}px serif`;
      for (let i = 0; i < glyphs.length; i += 1) {
        const angle = i * Math.PI * 2 / glyphs.length;
        const gx = Math.cos(angle) * radiusPx;
        const gy = Math.sin(angle) * radiusPx * 0.72;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = hexToRgba(i % 2 ? "#fef3c7" : "#ffffff", alpha * (0.58 + waveValue(progress, i * 0.08) * 0.22));
        ctx.fillText(glyphs[i], 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    function drawWhiteGoldMagicCircle(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const fade = Math.max(0, 1 - progress * 0.45);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let ring = 0; ring < 5; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(
          x,
          y,
          radiusPx * (0.34 + ring * 0.16 + waveValue(progress, ring * 0.09) * 0.025),
          radiusPx * (0.24 + ring * 0.105),
          progress * Math.PI * (ring % 2 ? -0.85 : 0.85),
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = hexToRgba(ring % 2 ? "#fbbf24" : "#ffffff", alpha * fade * (0.7 - ring * 0.08));
        ctx.lineWidth = Math.max(1.4, cellSize * (0.07 - ring * 0.006));
        ctx.stroke();
      }
      for (let i = 0; i < 18; i += 1) {
        const angle = i * Math.PI * 2 / 18 + progress * Math.PI * 2.2;
        const inner = radiusPx * 0.24;
        const outer = radiusPx * (0.88 + waveValue(progress, i * 0.06) * 0.1);
        drawLightningBetween(
          { x: x + Math.cos(angle) * inner, y: y + Math.sin(angle) * inner * 0.64 },
          { x: x + Math.cos(angle) * outer, y: y + Math.sin(angle) * outer * 0.64 },
          progress + i * 0.04,
          i % 3 ? "#fef3c7" : element.hot,
          0.42,
          3
        );
      }
      drawSpellGlyphRing(x, y, radiusPx * 0.78, progress, alpha * fade);
      drawSpellGlyphRing(x, y, radiusPx * 1.03, 1 - progress, alpha * fade * 0.72);
      ctx.restore();
    }

    function drawFrostShard(x, y, size, angle, alpha = 1) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.28, -size * 0.12);
      ctx.lineTo(size * 0.12, size * 0.82);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.12, size * 0.82);
      ctx.lineTo(-size * 0.28, -size * 0.12);
      ctx.closePath();
      ctx.fillStyle = hexToRgba("#e0f2fe", 0.64 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba("#ffffff", 0.86 * alpha);
      ctx.lineWidth = Math.max(1.1, cellSize * 0.032);
      ctx.stroke();
      ctx.restore();
    }

    function drawFrostFreezeBurst(x, y, radiusPx, progress, character, alpha = 1) {
      const freeze = Math.max(0, 1 - progress * 0.18);
      const pulse = 0.9 + waveValue(progress, 0.2) * 0.12;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const frost = ctx.createRadialGradient(x, y, radiusPx * 0.04, x, y, radiusPx * 1.15);
      frost.addColorStop(0, hexToRgba("#ffffff", 0.92 * alpha));
      frost.addColorStop(0.28, hexToRgba("#e0f2fe", 0.78 * alpha));
      frost.addColorStop(0.6, hexToRgba("#7dd3fc", 0.38 * alpha));
      frost.addColorStop(1, hexToRgba("#0f172a", 0));
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.94 + progress * 0.22) * pulse, 0, Math.PI * 2);
      ctx.fillStyle = frost;
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      for (let arm = 0; arm < 12; arm += 1) {
        const angle = arm * Math.PI * 2 / 12 + progress * 0.16;
        const inner = radiusPx * 0.18;
        const outer = radiusPx * (0.68 + waveValue(progress, arm * 0.04) * 0.24);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        ctx.strokeStyle = hexToRgba(arm % 2 ? "#bae6fd" : "#ffffff", alpha * freeze * 0.78);
        ctx.lineWidth = Math.max(1.4, cellSize * (0.045 + (arm % 3) * 0.014));
        ctx.lineCap = "round";
        ctx.stroke();
        drawFrostShard(
          x + Math.cos(angle) * radiusPx * (0.48 + progress * 0.08),
          y + Math.sin(angle) * radiusPx * (0.48 + progress * 0.08),
          cellSize * (0.2 + (arm % 3) * 0.035),
          angle,
          alpha * freeze
        );
      }
      for (let ring = 0; ring < 3; ring += 1) {
        ctx.beginPath();
        ctx.arc(x, y, radiusPx * (0.28 + ring * 0.2 + progress * 0.18), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(ring % 2 ? "#7dd3fc" : "#ffffff", alpha * freeze * (0.58 - ring * 0.1));
        ctx.lineWidth = Math.max(1.4, cellSize * (0.06 - ring * 0.008));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawFrostMagicCircle(x, y, radiusPx, progress, character, alpha = 1) {
      const fade = Math.max(0, 1 - progress * 0.28);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let ring = 0; ring < 5; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(
          x,
          y,
          radiusPx * (0.34 + ring * 0.15 + waveValue(progress, ring * 0.08) * 0.025),
          radiusPx * (0.22 + ring * 0.095),
          progress * Math.PI * (ring % 2 ? -0.52 : 0.52),
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = hexToRgba(ring % 2 ? "#7dd3fc" : "#e0f2fe", alpha * fade * (0.64 - ring * 0.07));
        ctx.lineWidth = Math.max(1.4, cellSize * (0.062 - ring * 0.005));
        ctx.stroke();
      }
      for (let i = 0; i < 18; i += 1) {
        const angle = i * Math.PI * 2 / 18 + progress * Math.PI * 0.8;
        const sx = x + Math.cos(angle) * radiusPx * 0.74;
        const sy = y + Math.sin(angle) * radiusPx * 0.52;
        drawFrostShard(sx, sy, cellSize * (0.14 + (i % 3) * 0.026), angle + Math.PI, alpha * fade * 0.72);
      }
      for (let wisp = 0; wisp < 24; wisp += 1) {
        const angle = wisp * Math.PI * 2 / 24 + progress * Math.PI * 1.2;
        const base = radiusPx * (0.18 + (wisp % 6) * 0.09);
        const lift = radiusPx * (0.16 + waveValue(progress, wisp * 0.05) * 0.24);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * base, y + Math.sin(angle) * base * 0.58);
        ctx.quadraticCurveTo(
          x + Math.cos(angle + 0.28) * (base * 0.8),
          y + Math.sin(angle + 0.28) * base * 0.48 - lift * 0.55,
          x + Math.cos(angle + 0.5) * (base * 0.6),
          y + Math.sin(angle + 0.5) * base * 0.38 - lift
        );
        ctx.strokeStyle = hexToRgba(wisp % 2 ? "#bae6fd" : "#ffffff", alpha * fade * (0.34 + (wisp % 3) * 0.04));
        ctx.lineWidth = Math.max(1.1, cellSize * 0.032);
        ctx.lineCap = "round";
        ctx.stroke();
      }
      drawSpellGlyphRing(x, y, radiusPx * 0.86, progress, alpha * fade * 0.7);
      ctx.restore();
    }

    function drawDragonSpiritRadiance(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const fade = Math.max(0, 1 - progress * 0.28);
      const pulse = 0.9 + waveValue(progress, 0.12) * 0.16;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const gradient = ctx.createRadialGradient(x, y, radiusPx * 0.04, x, y, radiusPx * (1.12 + progress * 0.44));
      gradient.addColorStop(0, hexToRgba("#ffffff", 0.96 * alpha));
      gradient.addColorStop(0.25, hexToRgba("#fefce8", 0.72 * alpha));
      gradient.addColorStop(0.52, hexToRgba(element.glow, 0.36 * alpha * fade));
      gradient.addColorStop(1, hexToRgba(element.deep, 0));
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (1.08 + progress * 0.42) * pulse, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      for (let i = 0; i < 42; i += 1) {
        const angle = i * Math.PI * 2 / 42 + progress * Math.PI * 0.9;
        const inner = radiusPx * (0.16 + (i % 4) * 0.035);
        const outer = radiusPx * (0.95 + waveValue(progress, i * 0.05) * 0.46);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        ctx.strokeStyle = hexToRgba(i % 3 ? "#ffffff" : "#fbbf24", alpha * fade * (0.58 + (i % 5) * 0.035));
        ctx.lineWidth = Math.max(1.4, cellSize * (0.045 + (i % 3) * 0.018));
        ctx.lineCap = "round";
        ctx.stroke();
      }
      drawWhiteGoldMagicCircle(x, y, radiusPx * 0.86, progress, character, alpha * 0.88);
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * (0.22 + waveValue(progress, 0.2) * 0.08), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba("#ffffff", 0.94 * alpha);
      ctx.fill();
      ctx.restore();
    }

    function drawSandTornadoProjectile(x, y, size, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      for (let layer = 0; layer < 5; layer += 1) {
        ctx.beginPath();
        for (let step = 0; step < 34; step += 1) {
          const t = step / 33;
          const turn = progress * Math.PI * 7 + layer * 0.7 + t * Math.PI * 3.6;
          const width = size * (0.12 + t * 0.48) * (1 - layer * 0.075);
          const px = Math.cos(turn) * width;
          const py = size * (0.62 - t * 1.18);
          if (step === 0) ctx.moveTo(x + px, y + py);
          else ctx.lineTo(x + px, y + py);
        }
        ctx.strokeStyle = hexToRgba(layer % 2 ? element.secondary : element.dust || element.primary, alpha * (0.74 - layer * 0.08));
        ctx.lineWidth = Math.max(1.6, cellSize * (0.09 - layer * 0.008));
        ctx.lineCap = "round";
        ctx.stroke();
      }
      for (let i = 0; i < 16; i += 1) {
        const angle = progress * Math.PI * 5 + i * Math.PI * 2 / 16;
        const distance = size * (0.12 + (i % 5) * 0.065);
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.72, cellSize * (0.045 + (i % 3) * 0.018), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(i % 2 ? element.glow : element.deep, alpha * 0.62);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawFlyingFist(x, y, size, progress, character, mirror = 1, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, mirror);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = hexToRgba(element.glow, 0.68);
      ctx.shadowBlur = cellSize * 0.18;
      ctx.beginPath();
      ctx.roundRect?.(-size * 0.18, -size * 0.32, size * 0.68, size * 0.64, size * 0.18);
      if (!ctx.roundRect) ctx.rect(-size * 0.18, -size * 0.32, size * 0.68, size * 0.64);
      ctx.fillStyle = hexToRgba(element.primary, 0.92 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(element.deep, 0.96 * alpha);
      ctx.lineWidth = Math.max(1.6, cellSize * 0.06);
      ctx.stroke();
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(size * (0.2 + i * 0.13), -size * 0.26, size * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(i % 2 ? element.secondary : element.hot, 0.88 * alpha);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.deep, 0.82 * alpha);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-size * 0.2, 0);
      ctx.quadraticCurveTo(-size * 0.54, -size * 0.16, -size * 0.82, -size * 0.04);
      ctx.quadraticCurveTo(-size * 0.5, size * 0.24, -size * 0.12, size * 0.18);
      ctx.fillStyle = hexToRgba(element.secondary, 0.74 * alpha);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 5; i += 1) {
        const trail = size * (0.46 + i * 0.16);
        ctx.beginPath();
        ctx.moveTo(-trail, -size * (0.22 - i * 0.025));
        ctx.quadraticCurveTo(-trail - size * 0.28, 0, -trail, size * (0.2 - i * 0.018));
        ctx.strokeStyle = hexToRgba(i % 2 ? element.secondary : element.glow, alpha * (0.52 - i * 0.06));
        ctx.lineWidth = Math.max(1.2, cellSize * (0.05 - i * 0.004));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawBuddhaPalmSeal(x, y, radiusPx, progress, character, alpha = 1, hand = "right") {
      const element = elementColorsFor(character);
      const mirror = hand === "left" ? -1 : 1;
      const fade = Math.max(0, 1 - progress * 0.18);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(mirror, 1);
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.ellipse(0, 0, radiusPx * 0.46, radiusPx * 0.72, -0.12, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba("#fff7ed", 0.34 * alpha * fade);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(element.secondary, 0.92 * alpha * fade);
      ctx.lineWidth = Math.max(2.2, cellSize * 0.095);
      ctx.stroke();
      for (let finger = 0; finger < 5; finger += 1) {
        const fx = radiusPx * (-0.32 + finger * 0.16);
        const length = radiusPx * (0.44 + (finger === 2 ? 0.2 : finger === 1 || finger === 3 ? 0.12 : 0.02));
        ctx.beginPath();
        ctx.roundRect?.(fx - radiusPx * 0.05, -radiusPx * 0.74 - length * 0.15, radiusPx * 0.1, length, radiusPx * 0.06);
        if (!ctx.roundRect) ctx.rect(fx - radiusPx * 0.05, -radiusPx * 0.74 - length * 0.15, radiusPx * 0.1, length);
        ctx.fillStyle = hexToRgba(finger % 2 ? element.hot : element.glow, 0.32 * alpha * fade);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.secondary, 0.82 * alpha * fade);
        ctx.stroke();
      }
      for (let line = 0; line < 5; line += 1) {
        ctx.beginPath();
        const yLine = radiusPx * (-0.28 + line * 0.16);
        ctx.moveTo(-radiusPx * 0.24, yLine);
        ctx.quadraticCurveTo(radiusPx * 0.08, yLine - radiusPx * 0.1, radiusPx * 0.28, yLine + radiusPx * 0.04);
        ctx.strokeStyle = hexToRgba(line % 2 ? element.secondary : "#ffffff", 0.52 * alpha * fade);
        ctx.lineWidth = Math.max(1.1, cellSize * 0.035);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.beginPath();
        ctx.arc(x, y, radiusPx * (0.42 + ring * 0.18 + progress * 0.18), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(ring % 2 ? element.secondary : element.hot, alpha * fade * (0.58 - ring * 0.07));
        ctx.lineWidth = Math.max(1.4, cellSize * (0.065 - ring * 0.006));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawPoisonVortex(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const murk = ctx.createRadialGradient(x, y, radiusPx * 0.04, x, y, radiusPx * 1.18);
      murk.addColorStop(0, hexToRgba("#020617", 0.86 * alpha));
      murk.addColorStop(0.36, hexToRgba(element.primary, 0.64 * alpha));
      murk.addColorStop(0.68, hexToRgba(element.bruise || "#312e81", 0.34 * alpha));
      murk.addColorStop(1, hexToRgba("#020617", 0));
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * 1.18, 0, Math.PI * 2);
      ctx.fillStyle = murk;
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      for (let arm = 0; arm < 10; arm += 1) {
        ctx.beginPath();
        for (let step = 0; step < 48; step += 1) {
          const t = step / 47;
          const angle = progress * Math.PI * 6.2 + arm * Math.PI * 2 / 10 + t * Math.PI * 3.5;
          const radius = radiusPx * (0.08 + t * 0.95);
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius * 0.72;
          if (step === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = hexToRgba(arm % 3 === 0 ? element.secondary : arm % 3 === 1 ? element.glow : element.hot, alpha * 0.62);
        ctx.lineWidth = Math.max(2.2, cellSize * 0.13);
        ctx.lineCap = "round";
        ctx.stroke();
      }
      for (let i = 0; i < 48; i += 1) {
        const angle = progress * Math.PI * 7 + i * Math.PI * 2 / 48;
        const distance = radiusPx * (0.14 + ((i * 5) % 11) * 0.068);
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance * 0.7;
        ctx.beginPath();
        ctx.arc(px, py, cellSize * (0.09 + (i % 4) * 0.035), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(i % 4 === 0 ? element.secondary : i % 4 === 1 ? element.glow : i % 4 === 2 ? element.hot : "#020617", alpha * 0.72);
        ctx.fill();
      }
      drawHexBurst(x, y, radiusPx * 0.9, progress, "#020617", element.secondary);
      ctx.restore();
    }

    function drawDarkGuKingTornado(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const fade = Math.max(0, 1 - progress * 0.2);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const shadow = ctx.createRadialGradient(x, y, radiusPx * 0.06, x, y, radiusPx * 1.34);
      shadow.addColorStop(0, hexToRgba("#000000", 0.92 * alpha));
      shadow.addColorStop(0.36, hexToRgba("#020617", 0.82 * alpha));
      shadow.addColorStop(0.7, hexToRgba("#064e3b", 0.28 * alpha));
      shadow.addColorStop(1, hexToRgba("#000000", 0));
      ctx.beginPath();
      ctx.arc(x, y, radiusPx * 1.28, 0, Math.PI * 2);
      ctx.fillStyle = shadow;
      ctx.fill();

      for (let layer = 0; layer < 8; layer += 1) {
        ctx.beginPath();
        for (let step = 0; step < 70; step += 1) {
          const t = step / 69;
          const spin = progress * Math.PI * (5.6 + layer * 0.18) + layer * 0.74 + t * Math.PI * 5.4;
          const width = radiusPx * (0.1 + t * 0.7) * (1 - layer * 0.045);
          const px = x + Math.cos(spin) * width;
          const py = y + radiusPx * (0.72 - t * 1.46) + Math.sin(spin) * radiusPx * 0.12;
          if (step === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = hexToRgba(layer % 3 === 0 ? "#000000" : layer % 3 === 1 ? "#7f1d1d" : "#064e3b", alpha * fade * (0.78 - layer * 0.055));
        ctx.lineWidth = Math.max(2, cellSize * (0.16 - layer * 0.011));
        ctx.lineCap = "round";
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 46; i += 1) {
        const angle = progress * Math.PI * (1.5 + (i % 3) * 0.28) + i * Math.PI * 2 / 46;
        const distance = radiusPx * (0.18 + ((i * 7) % 13) * 0.055 + progress * 0.14);
        const puff = cellSize * (0.09 + (i % 5) * 0.026);
        ctx.beginPath();
        ctx.ellipse(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance * 0.66 - radiusPx * (0.08 + (i % 4) * 0.025),
          puff * 1.3,
          puff * 0.72,
          angle,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = hexToRgba(i % 3 === 0 ? "#7f1d1d" : i % 3 === 1 ? "#064e3b" : "#111827", alpha * fade * (0.44 + (i % 4) * 0.04));
        ctx.fill();
      }
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.beginPath();
        ctx.ellipse(
          x,
          y + radiusPx * 0.18,
          radiusPx * (0.42 + ring * 0.18 + progress * 0.1),
          radiusPx * (0.18 + ring * 0.07),
          -progress * Math.PI * 1.2 + ring * 0.24,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = hexToRgba(ring % 2 ? "#7f1d1d" : "#064e3b", alpha * fade * (0.52 - ring * 0.08));
        ctx.lineWidth = Math.max(1.4, cellSize * (0.072 - ring * 0.008));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.beginPath();
      ctx.arc(x, y - radiusPx * 0.08, radiusPx * (0.22 + waveValue(progress, 0.18) * 0.06), 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba("#000000", 0.78 * alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(element.glow, 0.58 * alpha);
      ctx.lineWidth = Math.max(1.6, cellSize * 0.05);
      ctx.stroke();
      ctx.restore();
    }

    function drawSmallProjectileHead(x, y, projectile, progress, character, angle = 0) {
      const element = elementColorsFor(character);
      const projectileScale = projectile.kind === "dragonOrb" ? 1.45 : 1;
      const size = cellSize * Math.max(0.48, Math.min(0.86, 0.42 + (projectile.radius || 1) * 0.08)) * projectileScale;
      const pulse = 0.9 + waveValue(progress, 0.2) * 0.16;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = hexToRgba(element.glow, 0.72);
      ctx.shadowBlur = cellSize * 0.22;

      if ((projectile.visualType || "").startsWith("lobster-palm")) {
        drawGhostFireBurn(0, 0, size * 0.92, progress, character, 0.5);
        drawBuddhaPalmSeal(0, 0, size * 0.72, progress, character, 0.92, projectile.hand || "right");
        ctx.restore();
        return;
      }

      if (projectile.profile === "small") {
        drawSmallSkillIcon(0, 0, size * 1.05, progress, character, 0, 1);
        ctx.restore();
        return;
      }

      if (character.id === "dragon") {
        if (projectile.kind === "dragonOrb") {
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.48 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba("#ffffff", 0.94);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(element.secondary, 0.96);
          ctx.lineWidth = Math.max(2, cellSize * 0.07);
          ctx.stroke();
          for (let ring = 0; ring < 2; ring += 1) {
            ctx.beginPath();
            ctx.arc(0, 0, size * (0.72 + ring * 0.22 + progress * 0.12), 0, Math.PI * 2);
            ctx.strokeStyle = hexToRgba(ring ? element.glow : element.secondary, 0.72 - ring * 0.2);
            ctx.lineWidth = Math.max(1.6, cellSize * 0.045);
            ctx.stroke();
          }
          for (let i = 0; i < 6; i += 1) {
            const sparkAngle = i * Math.PI * 2 / 6 + progress * Math.PI * 2;
            drawElementShard(
              Math.cos(sparkAngle) * size * 0.7,
              Math.sin(sparkAngle) * size * 0.48,
              size * 0.18,
              sparkAngle,
              i % 2 ? element.secondary : "#ffffff",
              0.82
            );
          }
          ctx.restore();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(size * 0.78, 0);
        ctx.lineTo(-size * 0.22, -size * 0.28);
        ctx.lineTo(-size * 0.06, 0);
        ctx.lineTo(-size * 0.22, size * 0.28);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(element.hot, 0.92);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.deep, 0.95);
        ctx.lineWidth = Math.max(1.5, cellSize * 0.055);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size * 0.62, -size * 0.18);
        ctx.lineTo(-size * 0.3, 0);
        ctx.lineTo(-size * 0.62, size * 0.18);
        ctx.strokeStyle = hexToRgba(element.secondary, 0.88);
        ctx.stroke();
      } else if (character.id === "sandworm") {
        drawSandTornadoProjectile(0, 0, size * 1.1, progress, character, 0.98);
      } else if (character.id === "quetzal") {
        ctx.beginPath();
        ctx.moveTo(size * 0.78, 0);
        ctx.lineTo(-size * 0.46, -size * 0.12);
        ctx.lineTo(-size * 0.28, 0);
        ctx.lineTo(-size * 0.46, size * 0.12);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(element.secondary, 0.9);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.deep, 0.9);
        ctx.lineWidth = Math.max(1.4, cellSize * 0.05);
        ctx.stroke();
        [-1, 1].forEach(mirror => {
          ctx.beginPath();
          ctx.moveTo(-size * 0.2, 0);
          ctx.quadraticCurveTo(-size * 0.54, mirror * size * 0.34, -size * 0.86, mirror * size * 0.16);
          ctx.quadraticCurveTo(-size * 0.54, mirror * size * 0.08, -size * 0.2, 0);
          ctx.fillStyle = hexToRgba(element.primary, 0.74);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(element.glow, 0.84);
          ctx.stroke();
        });
      } else if (character.id === "moray") {
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.5 * pulse, size * 0.34 * pulse, 0, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(element.deep, 0.88);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.hot, 0.92);
        ctx.lineWidth = Math.max(1.8, cellSize * 0.065);
        ctx.stroke();
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          const offset = -0.28 + i * 0.28;
          ctx.moveTo(-size * 0.12, size * offset);
          ctx.lineTo(size * 0.1, size * (offset - 0.16));
          ctx.lineTo(size * 0.32, size * offset);
          ctx.strokeStyle = hexToRgba(i % 2 ? element.secondary : element.glow, 0.92);
          ctx.lineWidth = Math.max(1.2, cellSize * 0.044);
          ctx.stroke();
        }
      } else if (character.id === "lobster") {
        ctx.beginPath();
        ctx.moveTo(size * 0.7, 0);
        ctx.lineTo(size * 0.18, -size * 0.3);
        ctx.lineTo(-size * 0.44, -size * 0.22);
        ctx.lineTo(-size * 0.62, 0);
        ctx.lineTo(-size * 0.44, size * 0.22);
        ctx.lineTo(size * 0.18, size * 0.3);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(element.primary, 0.92);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.deep, 0.98);
        ctx.lineWidth = Math.max(1.6, cellSize * 0.06);
        ctx.stroke();
        [-1, 1].forEach(mirror => {
          ctx.beginPath();
          ctx.moveTo(size * 0.36, mirror * size * 0.08);
          ctx.quadraticCurveTo(size * 0.62, mirror * size * 0.38, size * 0.86, mirror * size * 0.18);
          ctx.strokeStyle = hexToRgba(element.secondary, 0.95);
          ctx.lineWidth = Math.max(1.8, cellSize * 0.07);
          ctx.stroke();
        });
        drawFlameTongue(-size * 0.76, 0, size * 0.3, -Math.PI / 2, element.secondary, element.glow, 0.78);
      } else if (character.id === "gu_king") {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.42 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba("#111827", 0.96);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.primary, 0.95);
        ctx.lineWidth = Math.max(1.7, cellSize * 0.062);
        ctx.stroke();
        for (let i = 0; i < 6; i += 1) {
          const legAngle = i * Math.PI / 3 + progress * Math.PI;
          ctx.beginPath();
          ctx.moveTo(Math.cos(legAngle) * size * 0.24, Math.sin(legAngle) * size * 0.24);
          ctx.lineTo(Math.cos(legAngle) * size * 0.62, Math.sin(legAngle) * size * 0.48);
          ctx.strokeStyle = hexToRgba(i % 2 ? element.glow : element.primary, 0.82);
          ctx.lineWidth = Math.max(1.1, cellSize * 0.038);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(size * 0.18, -size * 0.1, size * 0.08, 0, Math.PI * 2);
        ctx.arc(size * 0.18, size * 0.1, size * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(element.hot, 0.92);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.38 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(element.primary, 0.9);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(element.glow, 0.95);
        ctx.lineWidth = Math.max(1.5, cellSize * 0.055);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawProjectileCore(x, y, projectile, progress, character, travelAngle = 0) {
      const radiusPx = cellSize * Math.max(0.7, projectile.radius || 1);
      const type = projectile.visualType || attackVisualType(projectile.owner, projectile.profile);
      const isBig = projectile.profile === "big" || isUltimateVisualType(type);
      const element = elementColorsFor(character);
      ctx.save();
      drawElementAura(x, y, radiusPx * (isBig ? 1.05 : 0.72), progress, character, isBig ? 0.72 : 0.34);
      if (type.startsWith("lobster-palm") && projectile.kind === "dragonOrb") {
        drawElementAura(x, y, radiusPx * 0.86, progress, character, 0.42);
        drawSmallProjectileHead(x, y, projectile, progress, character, travelAngle);
        ctx.restore();
        return;
      }
      if (type.startsWith("dragon") && projectile.kind === "dragonOrb") {
        drawElementAura(x, y, radiusPx * 0.86, progress, character, 0.46);
        drawSmallProjectileHead(x, y, projectile, progress, character, travelAngle);
        ctx.restore();
        return;
      }
      if (!isBig) {
        drawSmallCastFrame(x, y, radiusPx, progress, character, 0.92);
        drawSmallProjectileHead(x, y, projectile, progress, character, travelAngle);
        ctx.restore();
        return;
      }
      drawUltimateImpactFrame(x, y, radiusPx * 0.9, progress, character, 0.62);
      drawElementMotifs(x, y, radiusPx * 1.08, progress, character, 0.95, 16);
      if (type.startsWith("dragon-spirit")) {
        drawFrostFreezeBurst(x, y, radiusPx * 0.9, progress, character, 0.86);
      } else if (type.startsWith("dragon")) {
        drawEnergyBeamBurst(x, y, radiusPx * 0.78, progress, character, 0.82);
      } else if (type.startsWith("sandworm")) {
        drawSandBurial(x, y, radiusPx * 0.94, progress, character, 0.72);
      } else if (type.startsWith("quetzal")) {
        drawSwampForestBloom(x, y, radiusPx * 0.72, progress, character, 0.72);
      } else if (type.startsWith("moray")) {
        drawPulseRing(x, y, radiusPx * 0.82, progress, character.color, character.line, 1.28);
        for (let i = 0; i < 8; i += 1) {
          const angle = progress * Math.PI * 6 + i * Math.PI * 2 / 8;
          drawLightningBetween(
            { x: x + Math.cos(angle) * radiusPx * 0.16, y: y + Math.sin(angle) * radiusPx * 0.16 },
            { x: x + Math.cos(angle) * radiusPx * 0.64, y: y + Math.sin(angle) * radiusPx * 0.64 },
            progress + i * 0.09,
            paletteColor(character, i),
            1.24,
            5
          );
        }
      } else if (type.startsWith("lobster-palm")) {
        drawGhostFireBurn(x, y, radiusPx * 0.82, progress, character, 0.48);
        drawBuddhaPalmSeal(x, y, radiusPx * 0.92, progress, character, 0.92, projectile.hand || "right");
      } else if (type.startsWith("lobster")) {
        drawNuclearBloom(x, y, radiusPx * 0.74, progress, character, 0.68);
      } else if (type.startsWith("gu_king")) {
        drawDarkGuKingTornado(x, y, radiusPx * 0.92, progress, character, 0.82);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(5, cellSize * 0.16), 0, Math.PI * 2);
        ctx.fillStyle = character.color;
        ctx.fill();
      }
      ctx.restore();
    }

    function drawProjectiles() {
      const now = performance.now();
      projectiles.forEach(projectile => {
        if (projectile.createdAt && now < projectile.createdAt) return;
        const blastCharacter = characterForVisualType(projectile.owner, projectile.visualType);
        if (projectile.hidden) {
          const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || baseAttackDelayMs)));
          const timeToImpact = projectile.impactAt - now;
          const target = axialToPixel(projectile.target);
          if ((projectile.visualType || "").startsWith("sandworm")) {
            if (timeToImpact > sandwormRevealBeforeImpactMs) return;
            const warningProgress = Math.max(0, 1 - timeToImpact / sandwormRevealBeforeImpactMs);
            const warningRadius = cellSize * Math.max(2.4, (projectile.radius || 1) * 4.4);
            const warningPlan = effectVisualPlanFor(projectile.visualType, "warning", blastCharacter);
            drawElementCircleTexture(target.x, target.y, warningRadius, warningProgress, blastCharacter, warningPlan.textureAlpha, {
              seed: `${projectile.visualType}:${projectile.impactAt}:warning`,
              density: warningPlan.density,
              size: warningPlan.size,
              maxParticles: warningPlan.maxParticles,
              spin: warningPlan.spin,
              ellipse: warningPlan.ellipse
            });
            drawUltimateImpactFrame(target.x, target.y, warningRadius * 0.72, warningProgress, blastCharacter, 0.62 + warningProgress * 0.28);
            drawSuperBlackHole(target.x, target.y, warningRadius, warningProgress, blastCharacter, 0.74 + warningProgress * 0.26);
          }
          return;
        }
        if (projectile.kind === "dragonOrb") {
          const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || baseAttackDelayMs)));
          const point = pointAlongPath(projectile.source || projectile.target, projectile.pathCells || [projectile.target], progress);
          drawPathTextureTrail(projectile.source || projectile.target, projectile.pathCells || [projectile.target], progress, blastCharacter, {
            visualType: projectile.visualType,
            seed: projectile.createdAt,
            alpha: (projectile.visualType || "").startsWith("lobster-palm") ? 0.88 : 0.72
          });
          drawProjectileCore(point.x, point.y, projectile, progress, blastCharacter, point.angle || 0);
          return;
        }
        if (projectile.kind === "line") {
          const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || baseAttackDelayMs)));
          const lineTextureCells = cellsNearCells(projectile.lineCells, projectile.width, projectile.excludedCells);
          const linePlan = effectVisualPlanFor(projectile.visualType, "line", blastCharacter);
          if ((projectile.visualType || "").startsWith("moray")) {
            drawElementCellTextureWash(lineTextureCells, blastCharacter, progress, linePlan.textureAlpha, {
              seed: `${projectile.visualType}:${projectile.createdAt}`,
              maxParticles: linePlan.maxParticles,
              perCell: linePlan.perCell,
              size: linePlan.size,
              spin: linePlan.spin,
              drift: linePlan.drift
            });
            drawRailgunLine(projectile, progress, 0.64 + progress * 0.28, blastCharacter);
            return;
          }
          if ((projectile.visualType || "").startsWith("dragon")) {
            drawElementCellTextureWash(lineTextureCells, blastCharacter, progress, linePlan.textureAlpha, {
              seed: `${projectile.visualType}:${projectile.createdAt}`,
              maxParticles: linePlan.maxParticles,
              perCell: linePlan.perCell,
              size: linePlan.size,
              spin: linePlan.spin,
              drift: linePlan.drift
            });
            const start = axialToPixel(projectile.source || projectile.lineCells[0]);
            const end = axialToPixel(projectile.target || projectile.lineCells[projectile.lineCells.length - 1]);
            const x = start.x + (end.x - start.x) * progress;
            const y = start.y + (end.y - start.y) * progress;
            const radiusPx = cellSize * Math.max(1.25, (projectile.width || 1) + 1.05);
            drawEnergyBeamBurst(x, y, radiusPx, progress, blastCharacter, 0.94);
            drawPulseRing(x, y, radiusPx * 0.78, progress, blastCharacter.color, blastCharacter.line, 1.2);
            return;
          }
          const alpha = 0.3 + progress * 0.48;
          drawElementCellTextureWash(lineTextureCells, blastCharacter, progress, linePlan.textureAlpha * 0.86, {
            seed: `${projectile.visualType}:${projectile.createdAt}`,
            maxParticles: linePlan.maxParticles,
            perCell: linePlan.perCell,
            size: linePlan.size,
            spin: linePlan.spin,
            drift: linePlan.drift
          });
          lineTextureCells.forEach(cell => {
            const { x, y } = axialToPixel(cell);
            drawElementAura(x, y, cellSize * 0.7, progress + cell.q * 0.02, blastCharacter, 0.22);
            hexPath(x, y, cellSize * 0.88);
            ctx.fillStyle = hexToRgba(blastCharacter.accent || blastCharacter.color, alpha);
            ctx.fill();
            ctx.strokeStyle = hexToRgba(blastCharacter.line, alpha + 0.16);
            ctx.lineWidth = Math.max(1, cellSize * 0.035);
            ctx.stroke();
            if (cell.q % 2 === 0) drawElementMotifs(x, y, cellSize * 0.62, progress + cell.r * 0.03, blastCharacter, 0.62, 6);
          });
          const visibleCells = projectile.lineCells.slice(0, Math.max(0, Math.floor(projectile.lineCells.length * progress)));
          for (let i = 1; i < visibleCells.length; i += 1) {
            drawLightningBetween(axialToPixel(visibleCells[i - 1]), axialToPixel(visibleCells[i]), progress + i * 0.07, blastCharacter.accent, 1.3, 5);
          }
          return;
        }
        if (projectile.kind === "headCircle") {
          const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || baseAttackDelayMs)));
          const target = axialToPixel(projectile.followHead ? ownerHead(projectile.owner) : projectile.target);
          const type = projectile.visualType || "";
          const headCirclePlan = effectVisualPlanFor(type, type.startsWith("dragon-spirit") ? "warning" : "radiation", blastCharacter);
          const warningRadius = cellSize * Math.max(1.35, projectile.radius || 1) * 1.04;
          drawElementCircleTexture(target.x, target.y, warningRadius, progress, blastCharacter, headCirclePlan.textureAlpha * 0.7, {
            seed: `${projectile.visualType}:${projectile.createdAt}:headCircle`,
            density: headCirclePlan.density,
            size: headCirclePlan.size,
            maxParticles: headCirclePlan.maxParticles,
            spin: headCirclePlan.spin,
            ellipse: headCirclePlan.ellipse
          });
          if (type.startsWith("dragon-spirit")) {
            drawFrostFreezeBurst(target.x, target.y, cellSize * Math.max(1.35, projectile.radius || 1) * 1.08, progress, blastCharacter, 0.72 + progress * 0.2);
          } else {
            drawUltimateImpactFrame(target.x, target.y, cellSize * Math.max(1.35, projectile.radius || 1) * 1.04, progress, blastCharacter, 0.58 + progress * 0.22);
            drawNuclearBloom(target.x, target.y, cellSize * Math.max(1.2, projectile.radius || 1) * 0.96, progress, blastCharacter, 0.36 + progress * 0.32);
            drawPulseRing(target.x, target.y, cellSize * Math.max(1.2, projectile.radius || 1) * (0.72 + progress * 0.5), progress, blastCharacter.color, blastCharacter.line, 1.08);
          }
          return;
        }
        const start = axialToPixel(projectile.source || projectile.target);
        const end = axialToPixel(projectile.target);
        const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || baseAttackDelayMs)));
        const x = start.x + (end.x - start.x) * progress;
        const y = start.y + (end.y - start.y) * progress;
        const isSmallProjectile = projectile.profile === "small";
        const arcHeight = Math.sin(progress * Math.PI) * cellSize * (isSmallProjectile ? 0.82 : 1.5);
        const projectilePoint = { x, y: y - arcHeight };
        const travelAngle = Math.atan2(end.y - start.y, end.x - start.x);
        if (!isSmallProjectile) {
          drawLightningBetween(start, projectilePoint, progress, blastCharacter.line, 0.85, 5);
          drawElementWake(start, projectilePoint, progress, blastCharacter);
        } else {
          drawSmallSkillTrail(start, projectilePoint, progress, blastCharacter, 0.88);
        }
        drawProjectileCore(projectilePoint.x, projectilePoint.y, projectile, progress, blastCharacter, travelAngle);
        ctx.beginPath();
        ctx.arc(end.x, end.y, cellSize * Math.max(0.52, (projectile.radius || 1) * 0.32), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(blastCharacter.line, 0.56);
        ctx.lineWidth = Math.max(2, cellSize * 0.055);
        ctx.stroke();
      });
    }

    function activeAttackPreviewProfile() {
      if (controlAttackPointer) return "big";
      return attackPointer?.previewProfile || selectedAttackProfile;
    }

    function drawTarget() {
      if (replayMode && !targetActive) return;
      if (!targetCell || !snake) return;
      const profile = activeAttackPreviewProfile();
      if (!targetActive && !canAttack("player", profile)) return;
      if (profile === "big" && characterFor("player").id === "sandworm") return;
      const { x, y } = axialToPixel(targetCell);
      ctx.beginPath();
      const previewRadius = Math.max(1, blastRadius(playerStock) + (profile === "small" ? -1 : 0));
      ctx.arc(x, y, cellSize * previewRadius * 1.52, 0, Math.PI * 2);
      ctx.fillStyle = canAttack("player", profile) ? "rgba(245,158,11,0.1)" : "rgba(168,179,194,0.08)";
      ctx.fill();
      ctx.strokeStyle = canAttack("player", profile) ? "rgba(253,230,138,0.78)" : "rgba(168,179,194,0.36)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      hexPath(x, y, cellSize * 0.55);
      ctx.strokeStyle = colors.target;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    function directionalPreviewState() {
      if (!snake?.length) return null;
      const character = characterFor("player");
      if (activeAttackPreviewProfile() !== "big" || !bigAttackUsesDrawnDirection(character.id)) return null;
      if (controlAttackPointer) {
        return {
          character,
          direction: controlAttackPointer.direction,
          origin: snake[0],
          target: opponentHeadTarget(),
          fromControlPad: true
        };
      }
      if (!attackPointer) return null;
      const target = character.id === "moray" && attackPointer.moved
        ? attackPointer.currentCell
        : opponentHeadTarget();
      const direction = attackPointer.moved
        ? directionFromSourceToTarget(attackPointer.startCell, attackPointer.currentCell, directionFromSourceToTarget(snake[0], target, ownerDirection("player")))
        : directionFromSourceToTarget(snake[0], target, ownerDirection("player"));
      const origin = character.id === "moray" && attackPointer.moved ? target : snake[0];
      return {
        character,
        direction,
        origin,
        target,
        dragStart: attackPointer.moved ? attackPointer.startCell : null,
        dragTarget: attackPointer.moved ? attackPointer.currentCell : null
      };
    }

    function directionalPreviewPath(origin, direction, character) {
      if (!origin || !Number.isInteger(direction)) return [];
      if (character.id === "moray") return boardLineThrough(origin, direction);
      const targetSnake = computerSnake || [];
      const predictedPath = character.id === "lobster"
        ? lobsterFistPath(snake[0], direction, targetSnake)
        : [];
      if (predictedPath.length) return predictedPath;
      const path = [];
      let cursor = { q: origin.q, r: origin.r };
      for (let step = 0; step < targetMaxHex; step += 1) {
        cursor = nextWrappedCell(cursor, direction);
        path.push({ q: cursor.q, r: cursor.r });
      }
      return path;
    }

    function directionBetweenCells(source, target, fallbackDirection = 0) {
      if (!source || !target) return fallbackDirection;
      for (let direction = 0; direction < directions.length; direction += 1) {
        if (keyOf(nextWrappedCell(source, direction)) === keyOf(target)) return direction;
      }
      return fallbackDirection;
    }

    function lobsterFistTurnPathIndex() {
      const maxSteps = Math.max(1, Math.ceil((radius * 2 + 1) / 2));
      return Math.ceil(maxSteps / 2);
    }

    function drawDirectionalPreviewArrow(cell, direction, lineColor, canCast) {
      if (!cell || !Number.isInteger(direction)) return;
      const point = axialToPixel(cell);
      const angle = directionScreenAngle(direction);
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(angle * Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(cellSize * 0.5, 0);
      ctx.lineTo(-cellSize * 0.2, -cellSize * 0.32);
      ctx.lineTo(-cellSize * 0.08, 0);
      ctx.lineTo(-cellSize * 0.2, cellSize * 0.32);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(lineColor, canCast ? 0.9 : 0.56);
      ctx.fill();
      ctx.strokeStyle = hexToRgba("#ffffff", canCast ? 0.72 : 0.34);
      ctx.lineWidth = Math.max(1.2, cellSize * 0.035);
      ctx.stroke();
      ctx.restore();
    }

    function drawDirectionalPreviewArrows(preview, path, lineColor, canCast) {
      if (preview.character.id !== "lobster") {
        drawDirectionalPreviewArrow(path[path.length - 1] || preview.target || preview.origin, preview.direction, lineColor, canCast);
        return;
      }
      const turnIndex = lobsterFistTurnPathIndex();
      const firstArrowIndex = Math.min(path.length - 1, Math.max(0, Math.floor(Math.max(1, turnIndex) / 2)));
      drawDirectionalPreviewArrow(path[firstArrowIndex], preview.direction, lineColor, canCast);
      if (turnIndex < path.length) {
        const beforeTurn = turnIndex > 0 ? path[turnIndex - 1] : preview.origin;
        const turnDirection = directionBetweenCells(beforeTurn, path[turnIndex], preview.direction);
        drawDirectionalPreviewArrow(path[turnIndex], turnDirection, lineColor, canCast);
      }
    }

    function drawDragDirectionLine(preview, lineColor, fillColor, canCast, now = performance.now()) {
      if (!["lobster", "moray"].includes(preview.character.id) || !preview.dragStart || !preview.dragTarget) return;
      const start = axialToPixel(preview.dragStart);
      const end = axialToPixel(preview.dragTarget);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy);
      if (distance < cellSize * 0.25) return;
      const pulse = waveValue(now / 680);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = hexToRgba(lineColor, canCast ? 0.72 + pulse * 0.16 : 0.36);
      ctx.lineWidth = Math.max(2, cellSize * 0.07);
      ctx.lineCap = "round";
      ctx.setLineDash([cellSize * 0.18, cellSize * 0.14]);
      ctx.lineDashOffset = -now / 38;
      ctx.stroke();
      ctx.setLineDash([]);

      [start, end].forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, cellSize * (index ? 0.22 : 0.18), 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(fillColor, index ? 0.42 : 0.26);
        ctx.fill();
        ctx.strokeStyle = hexToRgba("#ffffff", index ? 0.5 : 0.34);
        ctx.lineWidth = Math.max(1, cellSize * 0.026);
        ctx.stroke();
      });

      ctx.restore();
    }

    function drawDirectionalAttackPreview(now = performance.now()) {
      const preview = directionalPreviewState();
      if (!preview) return;
      const canCast = canAttack("player", "big");
      const character = preview.character;
      const lineColor = canCast ? (character.line || colors.target) : "#94a3b8";
      const fillColor = canCast ? (character.accent || character.color || colors.target) : "#94a3b8";
      const path = directionalPreviewPath(preview.origin, preview.direction, character);
      if (!path.length) return;

      const width = character.id === "moray"
        ? Math.max(0, bandDistanceFromTotalWidth(attackStats(playerStock, "small").radius))
        : 0;
      const cellsForPreview = character.id === "moray"
        ? cellsNearCells(path, width, snake)
        : path;
      const pulse = waveValue(now / 820);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      cellsForPreview.forEach((cell, index) => {
        const { x, y } = axialToPixel(cell);
        const distanceFade = Math.max(0.22, 1 - index / Math.max(6, cellsForPreview.length + 2));
        hexPath(x, y, cellSize * (character.id === "moray" ? 0.92 : 0.72));
        ctx.fillStyle = hexToRgba(fillColor, (0.12 + pulse * 0.08) * distanceFade);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(lineColor, (0.38 + pulse * 0.18) * distanceFade);
        ctx.lineWidth = Math.max(1.2, cellSize * 0.035);
        ctx.stroke();
      });

      const sourcePoint = axialToPixel(preview.origin);
      ctx.beginPath();
      ctx.moveTo(sourcePoint.x, sourcePoint.y);
      path.forEach(cell => {
        const point = axialToPixel(cell);
        ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = hexToRgba(lineColor, canCast ? 0.82 : 0.46);
      ctx.lineWidth = Math.max(3, cellSize * 0.1);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([cellSize * 0.36, cellSize * 0.2]);
      ctx.lineDashOffset = -now / 48;
      ctx.stroke();
      ctx.setLineDash([]);

      drawDragDirectionLine(preview, lineColor, fillColor, canCast, now);
      drawDirectionalPreviewArrows(preview, path, lineColor, canCast);

      ctx.beginPath();
      ctx.arc(sourcePoint.x, sourcePoint.y, cellSize * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(fillColor, canCast ? 0.22 : 0.12);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(lineColor, canCast ? 0.86 : 0.42);
      ctx.lineWidth = Math.max(1.5, cellSize * 0.05);
      ctx.stroke();
      ctx.restore();
    }

    function drawHazards() {
      const now = performance.now();
      hazards.forEach(hazard => {
        if (now < hazard.startedAt || now > hazard.endAt) return;
        const progress = (now - hazard.startedAt) / Math.max(1, hazard.endAt - hazard.startedAt);
        const alpha = 0.24 * (1 - progress * 0.55);
        const blastCharacter = characterForVisualType(hazard.owner, hazard.visualType);
        if (hazard.kind === "radiation") {
          const { x, y } = axialToPixel(hazard.target);
          const radiusPx = cellSize * Math.max(1, hazard.radius || hazard.width || 1) * 1.52;
          const radiationPlan = effectVisualPlanFor(hazard.visualType, "radiation", blastCharacter);
          drawElementCircleTexture(x, y, radiusPx, progress, blastCharacter, radiationPlan.textureAlpha, {
            seed: `${hazard.visualType}:${hazard.startedAt}`,
            density: radiationPlan.density,
            size: radiationPlan.size,
            maxParticles: radiationPlan.maxParticles,
            spin: radiationPlan.spin,
            ellipse: radiationPlan.ellipse
          });
          if ((hazard.visualType || "").startsWith("dragon-spirit")) {
            drawFrostMagicCircle(x, y, radiusPx, progress, blastCharacter, 0.92);
          } else if ((hazard.visualType || "").startsWith("lobster")) {
            drawGhostFireBurn(x, y, radiusPx * 0.92, progress, blastCharacter, 0.86);
          } else {
            drawRadiationDust(x, y, radiusPx, progress, blastCharacter, 0.92);
          }
          return;
        }
        const hazardCells = cellsNearCells(hazard.cells, hazard.width, hazard.visualExcludedCells || [], hazard.minDistance || 0);
        const hazardPlan = effectVisualPlanFor(hazard.visualType, "hazard", blastCharacter);
        drawElementCellTextureWash(hazardCells, blastCharacter, progress, hazardPlan.textureAlpha * (1 - progress * 0.18), {
          seed: `${hazard.visualType}:${hazard.startedAt}`,
          persistent: hazardPlan.persistent,
          maxParticles: hazardPlan.maxParticles,
          perCell: hazardPlan.perCell,
          size: hazardPlan.size,
          drift: hazardPlan.drift,
          spin: hazardPlan.spin
        });
        hazardCells.forEach(cell => {
          const { x, y } = axialToPixel(cell);
          if ((hazard.visualType || "").startsWith("quetzal")) {
            const variant = stableVariantIndex(cell, hazard.startedAt || 0, 64);
            drawSwampForestBloom(x, y, cellSize * 1.34, progress + (cell.q + cell.r) * 0.035, blastCharacter, 0.94 * (1 - progress * 0.08), variant);
            return;
          }
          drawElementAura(x, y, cellSize * 0.86, progress + (cell.q - cell.r) * 0.03, blastCharacter, 0.24);
          hexPath(x, y, cellSize * 0.9);
          ctx.fillStyle = hexToRgba(blastCharacter.accent || blastCharacter.color, alpha + 0.08);
          ctx.fill();
          ctx.strokeStyle = hexToRgba(blastCharacter.line, alpha + 0.34);
          ctx.lineWidth = Math.max(1.5, cellSize * 0.045);
          ctx.stroke();
        });
      });
    }

    function drawLineBlast(blast, progress, alpha, character) {
      const textureCells = cellsNearCells(blast.lineCells, blast.width, blast.excludedCells);
      const linePlan = effectVisualPlanFor(blast.visualType, "line", character);
      drawElementCellTextureWash(textureCells, character, progress, linePlan.textureAlpha * alpha, {
        seed: `${blast.visualType}:${blast.startedAt}`,
        maxParticles: linePlan.maxParticles,
        perCell: linePlan.perCell,
        size: linePlan.size,
        spin: linePlan.spin,
        drift: linePlan.drift
      });
      if ((blast.visualType || "").startsWith("moray")) {
        drawRailgunLine(blast, progress, alpha, character);
        return;
      }
      if ((blast.visualType || "").startsWith("dragon")) {
        const cells = blast.lineCells || [];
        cells.forEach((cell, index) => {
          const { x, y } = axialToPixel(cell);
          drawElementAura(x, y, cellSize * 1.04, progress + index * 0.04, character, 0.36 * alpha);
          if (index % 2 === 0) drawPulseRing(x, y, cellSize * 0.84, progress, character.color, character.line, 0.86);
        });
        if (cells.length) {
          const head = axialToPixel(cells[Math.min(cells.length - 1, Math.floor(cells.length * (0.58 + progress * 0.42)))]);
          drawEnergyBeamBurst(head.x, head.y, cellSize * Math.max(1.9, (blast.width || 1) + 1.2), progress, character, alpha);
        }
        return;
      }
      textureCells.forEach(cell => {
        const { x, y } = axialToPixel(cell);
        drawElementAura(x, y, cellSize * 0.86, progress + cell.r * 0.04, character, 0.32 * alpha);
        hexPath(x, y, cellSize * 0.94);
        ctx.fillStyle = hexToRgba(character.accent || character.color, 0.5 * alpha);
        ctx.fill();
        ctx.strokeStyle = hexToRgba("#ffffff", 0.82 * alpha);
        ctx.lineWidth = Math.max(2, cellSize * 0.06);
        ctx.stroke();
      });
    }

    function drawCircleImpactAt(x, y, radiusPx, progress, alpha, character, type, hand = "right") {
      const isBig = isUltimateVisualType(type);
      const element = elementColorsFor(character);
      const visualRadius = radiusPx * (isBig ? 1.18 : 1);
      const circlePlan = effectVisualPlanFor(type, "impact", character);
      drawElementCircleTexture(x, y, visualRadius, progress, character, alpha * circlePlan.textureAlpha * (isBig ? 1 : 0.78), {
        seed: `${type}:${Math.round(x)}:${Math.round(y)}`,
        density: isBig ? circlePlan.density : Math.max(8, circlePlan.density * 0.62),
        size: isBig ? circlePlan.size * 1.12 : circlePlan.size * 0.72,
        maxParticles: isBig ? circlePlan.maxParticles : Math.min(48, circlePlan.maxParticles),
        spin: circlePlan.spin,
        ellipse: circlePlan.ellipse
      });
      if (!isBig) {
        drawSmallImpactFrame(x, y, visualRadius, progress, character, alpha);
        return;
      }
      if (type.startsWith("dragon-spirit")) {
        drawFrostFreezeBurst(x, y, visualRadius * 1.05, progress, character, alpha);
        return;
      }
      if (type.startsWith("lobster-palm")) {
        drawLobsterPalmUltimate(x, y, visualRadius * (type.includes("burst") ? 1.08 : 0.96), progress, character, alpha, hand);
        return;
      }
      if (type.startsWith("gu_king")) {
        drawDarkGuKingTornado(x, y, visualRadius * 1.08, progress, character, alpha);
        return;
      }
      drawUltimateImpactFrame(x, y, visualRadius, progress, character, alpha);
      drawElementAura(x, y, visualRadius * (isBig ? 1.04 : 0.86), progress, character, (isBig ? 0.92 : 0.68) * alpha);
      drawPulseRing(x, y, visualRadius, progress, character.color, character.line, isBig ? 1.35 : 1);
      drawElementMotifs(x, y, visualRadius * (isBig ? 0.94 : 0.82), progress, character, (isBig ? 1.05 : 0.84) * alpha, isBig ? 22 : 14);
      if (type.startsWith("dragon-spirit") && type.includes("burst")) {
        drawDragonSpiritRadiance(x, y, visualRadius * 1.12, progress, character, alpha);
      } else if (type.startsWith("dragon") && type.includes("burst")) {
        drawDragonBigBurst(x, y, visualRadius * 1.15, progress, character, alpha);
      } else if (type.startsWith("dragon")) {
        drawEnergyBeamBurst(x, y, visualRadius * 1.08, progress, character, alpha);
      } else if (type.startsWith("sandworm")) {
        drawSandBurial(x, y, visualRadius * 1.7, progress, character, alpha);
      } else if (type.startsWith("quetzal")) {
        drawSwampForestBloom(x, y, visualRadius * 1.02, progress, character, alpha);
      } else if (type.startsWith("moray")) {
        drawEnergyBeamBurst(x, y, visualRadius * 1.02, progress, character, alpha);
      } else if (type.startsWith("lobster-palm") && type.includes("burst")) {
        drawBuddhaPalmSeal(x, y, visualRadius * 0.95, progress, character, alpha, hand);
      } else if (type.startsWith("lobster-palm")) {
        drawBuddhaPalmSeal(x, y, visualRadius * 0.78, progress, character, alpha, hand);
      } else if (type.startsWith("lobster")) {
        drawNuclearBloom(x, y, visualRadius, progress, character, alpha);
      } else if (type.startsWith("gu_king")) {
        drawPoisonVortex(x, y, visualRadius * 1.34, progress, character, alpha);
        drawPulseRing(x, y, visualRadius * (0.72 + progress * 0.42), progress * 1.4, "#020617", element.secondary, 1.5);
        for (let i = 0; i < 16; i += 1) {
          const angle = progress * Math.PI * 5 + i * Math.PI * 2 / 16;
          const inner = visualRadius * 0.34;
          const outer = visualRadius * (1.06 + (i % 3) * 0.08);
          drawLightningBetween(
            { x: x + Math.cos(angle) * inner, y: y + Math.sin(angle) * inner * 0.72 },
            { x: x + Math.cos(angle + 0.42) * outer, y: y + Math.sin(angle + 0.42) * outer * 0.72 },
            progress + i * 0.08,
            i % 3 === 0 ? element.secondary : i % 3 === 1 ? element.glow : element.hot,
            0.96,
            5
          );
        }
      }
    }

    function drawCircleBlast(blast, progress, alpha, character) {
      const { x, y } = axialToPixel(blast.target);
      const radiusPx = cellSize * (blast.radius || baseBlastHexRadius) * 1.52;
      const type = blast.visualType || attackVisualType(blast.owner, "big");
      drawCircleImpactAt(x, y, radiusPx, progress, alpha, character, type, blast.hand || "right");
    }

    function drawBlasts() {
      const now = performance.now();
      blasts.forEach(blast => {
        const progress = Math.min(1, (now - blast.startedAt) / blastDurationMs);
        const alpha = 1 - progress;
        const blastCharacter = characterForVisualType(blast.owner, blast.visualType);
        if (blast.kind === "line") {
          drawLineBlast(blast, progress, alpha, blastCharacter);
          return;
        }
        drawCircleBlast(blast, progress, alpha, blastCharacter);
      });
    }

    function isEffectComparisonMode() {
      return new URLSearchParams(window.location.search).has("effectCompare");
    }

    function comparisonBigVisualType(character) {
      if (character.id === "dragon") return "dragon-spirit-big";
      if (character.id === "lobster") return "lobster-palm-big";
      return `${character.id}-big`;
    }

    function drawEffectComparisonBoard(now = performance.now()) {
      const rect = playArea.getBoundingClientRect();
      const progress = (now % 1400) / 1400;
      const oldCellSize = cellSize;
      const rowCount = Math.max(1, characters.length);
      const compactComparison = rect.width < 560;
      const headerHeight = compactComparison ? 54 : Math.min(64, Math.max(50, rect.height * 0.09));
      const rowHeight = (rect.height - headerHeight - 16) / rowCount;
      const labelWidth = compactComparison ? Math.min(96, rect.width * 0.25) : Math.min(150, rect.width * 0.2);
      const smallX = labelWidth + (rect.width - labelWidth) * 0.28;
      const bigX = labelWidth + (rect.width - labelWidth) * 0.72;
      cellSize = Math.max(11, Math.min(28, rowHeight * 0.18, rect.width * 0.018));

      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#111720";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#e5e7eb";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `${compactComparison ? "700 18px" : "700 18px"} system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillText("Skill Effect Comparison", 18, compactComparison ? headerHeight * 0.36 : headerHeight * 0.38);
      if (!compactComparison) {
        ctx.font = "600 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText("Small: cast + projectile + impact", 18, headerHeight * 0.72);
      }
      ctx.textAlign = "center";
      ctx.fillStyle = "#fde68a";
      ctx.fillText("Small", smallX, headerHeight - 12);
      ctx.fillStyle = "#fca5a5";
      ctx.fillText("Ultimate", bigX, headerHeight - 12);

      characters.forEach((character, index) => {
        const y = headerHeight + rowHeight * (index + 0.5);
        const radiusPx = Math.max(22, rowHeight * 0.2);
        ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(12, headerHeight + rowHeight * index);
        ctx.lineTo(rect.width - 12, headerHeight + rowHeight * index);
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "700 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(character.id, 18, y - 10);
        ctx.fillStyle = character.accent || character.line || "#cbd5e1";
        ctx.font = "600 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(character.smallMove || "small", 18, y + 10);

        ctx.save();
        ctx.beginPath();
        ctx.rect(labelWidth, headerHeight + rowHeight * index + 1, rect.width - labelWidth - 12, rowHeight - 2);
        ctx.clip();
        const smallProjectile = {
          owner: "player",
          profile: "small",
          kind: "circle",
          radius: 2,
          visualType: `${character.id}-small`
        };
        const castPoint = { x: smallX - radiusPx * 1.0, y };
        const headPoint = { x: smallX - radiusPx * 0.44, y: y - Math.sin(progress * Math.PI) * radiusPx * 0.12 };
        drawSmallCastFrame(castPoint.x, castPoint.y, radiusPx * 0.78, progress, character, 0.9);
        drawSmallSkillTrail(castPoint, headPoint, Math.max(0.2, progress), character, 0.8);
        drawSmallProjectileHead(headPoint.x, headPoint.y, smallProjectile, progress, character, 0);
        drawCircleImpactAt(smallX + radiusPx * 0.7, y, radiusPx * 0.74, progress, 0.92, character, `${character.id}-small`);

        const bigType = comparisonBigVisualType(character);
        drawCircleImpactAt(bigX, y, radiusPx * 1.06, progress, 0.96, character, bigType);
        ctx.restore();
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(248, 250, 252, 0.78)";
        ctx.font = "600 10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillText(bigType.replace(`${character.id}-`, ""), bigX, y + rowHeight * 0.33);
      });
      cellSize = oldCellSize;
    }

    function drawStatusStar(x, y, size, angle, color, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const r = i % 2 === 0 ? size : size * 0.42;
        const a = -Math.PI / 2 + i * Math.PI / 4;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, alpha);
      ctx.fill();
      ctx.restore();
    }

    function drawStatusEffects(now) {
      drawOwnerStatus("computer", now);
      drawOwnerStatus("player", now);
    }

    function drawOwnerStatus(owner, now) {
      const parts = ownerSnake(owner);
      if (!parts || !parts.length) return;
      const head = axialToPixel(parts[0]);
      const character = characterFor(owner);
      const stunned = now < ownerStunUntil(owner);
      const slowed = now < ownerSlowUntil(owner);
      const collisionLocked = ownerCollisionParalysis(owner) > 0 && stunned;
      if (!stunned && !slowed && !collisionLocked) return;

      ctx.save();
      if (slowed) {
        const pulse = waveValue(now / 1400);
        ctx.beginPath();
        ctx.ellipse(head.x, head.y + cellSize * 0.06, cellSize * (0.74 + pulse * 0.18), cellSize * 0.46, 0, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba("#93c5fd", 0.54);
        ctx.lineWidth = Math.max(1.2, cellSize * 0.045);
        ctx.setLineDash([cellSize * 0.16, cellSize * 0.12]);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 1; i < Math.min(parts.length, 4); i += 1) {
          const cell = axialToPixel(parts[i]);
          ctx.beginPath();
          ctx.moveTo(cell.x - cellSize * 0.26, cell.y - cellSize * 0.16);
          ctx.quadraticCurveTo(cell.x, cell.y + cellSize * 0.2, cell.x + cellSize * 0.26, cell.y - cellSize * 0.1);
          ctx.strokeStyle = hexToRgba("#bfdbfe", 0.22);
          ctx.lineWidth = Math.max(1, cellSize * 0.035);
          ctx.stroke();
        }
      }

      if (stunned) {
        const spin = now / 620;
        const orbit = cellSize * 0.92;
        ctx.beginPath();
        ctx.arc(head.x, head.y, orbit, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(character.line, 0.42);
        ctx.lineWidth = Math.max(1.2, cellSize * 0.035);
        ctx.stroke();
        for (let i = 0; i < 5; i += 1) {
          const angle = spin + i * Math.PI * 2 / 5;
          drawStatusStar(
            head.x + Math.cos(angle) * orbit,
            head.y + Math.sin(angle) * orbit * 0.72,
            cellSize * 0.14,
            angle,
            i % 2 ? character.accent : character.line,
            0.84
          );
        }
      }

      if (collisionLocked) {
        for (let i = 0; i < 6; i += 1) {
          const angle = i * Math.PI * 2 / 6 + waveValue(now / 420, i * 0.1) * 0.28;
          const inner = cellSize * 0.42;
          const outer = cellSize * 0.92;
          ctx.beginPath();
          ctx.moveTo(head.x + Math.cos(angle) * inner, head.y + Math.sin(angle) * inner);
          ctx.lineTo(head.x + Math.cos(angle + 0.13) * outer, head.y + Math.sin(angle + 0.13) * outer);
          ctx.strokeStyle = hexToRgba("#fef3c7", 0.58);
          ctx.lineWidth = Math.max(1.2, cellSize * 0.04);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawFoodToken(x, y, tokenTypes) {
      const types = Array.isArray(tokenTypes) ? tokenTypes : [tokenTypes];
      const type = types[0];
      const secondaryType = types[1];
      if (!type) return;
      const size = cellSize * 0.62;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.42)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = type.color;
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = Math.max(2, cellSize * 0.09);

      if (type.id === "black") {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.78, 0, Math.PI * 2);
      } else if (type.id === "protein") {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.74, 0, Math.PI * 2);
      } else if (type.id === "fat") {
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.82);
        ctx.lineTo(x + size * 0.82, y);
        ctx.lineTo(x, y + size * 0.82);
        ctx.lineTo(x - size * 0.82, y);
        ctx.closePath();
      } else if (type.id === "fiber") {
        ctx.beginPath();
        for (let i = 0; i < 5; i += 1) {
          const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
          const px = x + Math.cos(angle) * size * 0.82;
          const py = y + Math.sin(angle) * size * 0.82;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.9);
        ctx.lineTo(x + size * 0.82, y + size * 0.58);
        ctx.lineTo(x - size * 0.82, y + size * 0.58);
        ctx.closePath();
      }

      if (secondaryType) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = type.color;
        ctx.fillRect(x - size, y - size, size, size * 2);
        ctx.fillStyle = secondaryType.color;
        ctx.fillRect(x, y - size, size, size * 2);
        ctx.restore();
      } else {
        ctx.fill();
      }
      ctx.stroke();
      ctx.shadowColor = "transparent";

      ctx.strokeStyle = "#111720";
      ctx.fillStyle = "#111720";
      ctx.lineWidth = Math.max(2, cellSize * 0.08);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (type.id === "black") {
        ctx.strokeStyle = "#e5e7eb";
        ctx.lineWidth = Math.max(2, cellSize * 0.07);
        ctx.beginPath();
        ctx.moveTo(x - size * 0.38, y);
        for (let i = 0; i < 6; i += 1) {
          const px = x - size * 0.28 + i * size * 0.12;
          const py = y + (i % 2 === 0 ? -size * 0.16 : size * 0.16);
          ctx.lineTo(px, py);
        }
        ctx.lineTo(x + size * 0.38, y);
        ctx.stroke();
        ctx.fillStyle = "#e5e7eb";
        ctx.beginPath();
        ctx.arc(x - size * 0.38, y, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
      } else if (type.id === "protein") {
        ctx.beginPath();
        ctx.moveTo(x - size * 0.32, y - size * 0.08);
        ctx.bezierCurveTo(x - size * 0.18, y - size * 0.36, x + size * 0.22, y - size * 0.36, x + size * 0.34, y - size * 0.04);
        ctx.bezierCurveTo(x + size * 0.14, y + size * 0.1, x - size * 0.12, y + size * 0.24, x - size * 0.3, y + size * 0.36);
        ctx.stroke();
      } else if (type.id === "fat") {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (type.id === "fiber") {
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.44);
        ctx.quadraticCurveTo(x - size * 0.18, y - size * 0.06, x + size * 0.34, y - size * 0.42);
        ctx.moveTo(x - size * 0.02, y + size * 0.1);
        ctx.lineTo(x - size * 0.34, y - size * 0.16);
        ctx.moveTo(x + size * 0.08, y - size * 0.1);
        ctx.lineTo(x + size * 0.38, y + size * 0.02);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x - size * 0.3, y - size * 0.08);
        ctx.lineTo(x, y + size * 0.24);
        ctx.lineTo(x + size * 0.3, y - size * 0.08);
        ctx.stroke();
      }
      ctx.restore();
    }

    function hexToRgba(hex, alpha) {
      const value = hex.replace("#", "");
      const bigint = Number.parseInt(value, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r},${g},${b},${alpha})`;
    }

    function drawLocalHex(size) {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.PI / 180 * (60 * i - 30);
        const px = size * Math.cos(angle);
        const py = size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    function strokeHeadEye(x, y, radius, fill = "#111720") {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.56)";
      ctx.lineWidth = Math.max(1, cellSize * 0.028);
      ctx.stroke();
    }

    function drawMirroredPath(points, scaleY = 1) {
      ctx.beginPath();
      points.forEach(([px, py], index) => {
        if (index === 0) ctx.moveTo(px, py * scaleY);
        else ctx.lineTo(px, py * scaleY);
      });
      ctx.stroke();
    }

    function drawSnakeHeadDetail(x, y, palette) {
      const character = palette.character;
      if (!character) return;
      const headSize = cellSize * 0.82;
      const angle = directions[palette.direction ?? 0]?.angle ?? -90;
      const accent = character.accent || palette.headLine;
      const line = character.line || palette.headLine;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle * Math.PI / 180);
      drawLocalHex(headSize * 0.94);
      ctx.clip();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.fillStyle = hexToRgba("#ffffff", palette.owner === "computer" ? 0.1 : 0.16);
      ctx.beginPath();
      ctx.ellipse(headSize * 0.06, -headSize * 0.24, headSize * 0.42, headSize * 0.16, -0.25, 0, Math.PI * 2);
      ctx.fill();

      if (character.id === "dragon") {
        ctx.strokeStyle = line;
        ctx.lineWidth = Math.max(1.6, cellSize * 0.055);
        drawMirroredPath([[-headSize * 0.2, -headSize * 0.18], [headSize * 0.1, -headSize * 0.26], [headSize * 0.42, -headSize * 0.08]]);
        drawMirroredPath([[-headSize * 0.2, -headSize * 0.18], [headSize * 0.1, -headSize * 0.26], [headSize * 0.42, -headSize * 0.08]], -1);
        ctx.fillStyle = accent;
        [[-0.18, -0.46], [0.02, -0.42], [-0.18, 0.46], [0.02, 0.42]].forEach(([hx, hy]) => {
          ctx.beginPath();
          ctx.moveTo(headSize * hx, headSize * hy);
          ctx.lineTo(headSize * (hx + 0.2), headSize * (hy * 0.58));
          ctx.lineTo(headSize * (hx - 0.05), headSize * (hy * 0.22));
          ctx.closePath();
          ctx.fill();
        });
        strokeHeadEye(headSize * 0.22, -headSize * 0.18, Math.max(2, cellSize * 0.07));
      } else if (character.id === "sandworm") {
        ctx.strokeStyle = line;
        ctx.lineWidth = Math.max(1.8, cellSize * 0.065);
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.ellipse(headSize * (0.08 - i * 0.16), 0, headSize * 0.18, headSize * 0.52, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = "#111720";
        ctx.beginPath();
        ctx.ellipse(headSize * 0.42, 0, headSize * 0.18, headSize * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1.2, cellSize * 0.04);
        [-0.45, -0.15, 0.15, 0.45].forEach(offset => {
          ctx.beginPath();
          ctx.moveTo(headSize * 0.28, headSize * offset);
          ctx.lineTo(headSize * 0.48, headSize * offset * 0.55);
          ctx.stroke();
        });
      } else if (character.id === "quetzal") {
        ctx.fillStyle = accent;
        [-0.42, -0.2, 0.02, 0.24].forEach((fy, index) => {
          ctx.beginPath();
          ctx.moveTo(-headSize * 0.36 + index * headSize * 0.08, headSize * fy);
          ctx.lineTo(-headSize * 0.04 + index * headSize * 0.08, headSize * (fy - 0.22));
          ctx.lineTo(headSize * 0.06 + index * headSize * 0.05, headSize * (fy + 0.02));
          ctx.closePath();
          ctx.fill();
        });
        ctx.strokeStyle = line;
        ctx.lineWidth = Math.max(1.4, cellSize * 0.052);
        ctx.beginPath();
        ctx.moveTo(-headSize * 0.28, headSize * 0.28);
        ctx.quadraticCurveTo(headSize * 0.12, -headSize * 0.24, headSize * 0.42, -headSize * 0.02);
        ctx.stroke();
        strokeHeadEye(headSize * 0.18, -headSize * 0.16, Math.max(2, cellSize * 0.065));
      } else if (character.id === "moray") {
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(2, cellSize * 0.075);
        ctx.beginPath();
        ctx.moveTo(-headSize * 0.44, headSize * 0.12);
        ctx.quadraticCurveTo(-headSize * 0.02, -headSize * 0.2, headSize * 0.48, -headSize * 0.04);
        ctx.stroke();
        ctx.strokeStyle = line;
        ctx.lineWidth = Math.max(1.4, cellSize * 0.046);
        ctx.beginPath();
        ctx.moveTo(headSize * 0.12, headSize * 0.16);
        ctx.lineTo(headSize * 0.48, headSize * 0.16);
        ctx.stroke();
        ctx.fillStyle = "#f8fafc";
        [-0.02, 0.12, 0.26].forEach(tx => {
          ctx.beginPath();
          ctx.moveTo(headSize * tx, headSize * 0.16);
          ctx.lineTo(headSize * (tx + 0.07), headSize * 0.29);
          ctx.lineTo(headSize * (tx + 0.13), headSize * 0.16);
          ctx.closePath();
          ctx.fill();
        });
        strokeHeadEye(headSize * 0.22, -headSize * 0.16, Math.max(2, cellSize * 0.065));
      } else if (character.id === "gu_king") {
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(1.6, cellSize * 0.06);
        [-0.36, -0.18, 0, 0.18, 0.36].forEach(offset => {
          ctx.beginPath();
          ctx.moveTo(-headSize * 0.36, headSize * offset);
          ctx.lineTo(-headSize * 0.5, headSize * (offset + Math.sign(offset || 1) * 0.14));
          ctx.stroke();
        });
        ctx.fillStyle = hexToRgba(accent, 0.84);
        ctx.beginPath();
        ctx.moveTo(headSize * 0.02, -headSize * 0.36);
        ctx.lineTo(headSize * 0.18, -headSize * 0.16);
        ctx.lineTo(headSize * 0.34, -headSize * 0.36);
        ctx.lineTo(headSize * 0.42, -headSize * 0.1);
        ctx.lineTo(headSize * 0.1, headSize * 0.02);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(headSize * 0.02, headSize * 0.36);
        ctx.lineTo(headSize * 0.18, headSize * 0.16);
        ctx.lineTo(headSize * 0.34, headSize * 0.36);
        ctx.lineTo(headSize * 0.42, headSize * 0.1);
        ctx.lineTo(headSize * 0.1, -headSize * 0.02);
        ctx.closePath();
        ctx.fill();
        strokeHeadEye(headSize * 0.2, -headSize * 0.12, Math.max(2, cellSize * 0.06), "#0f172a");
        strokeHeadEye(headSize * 0.2, headSize * 0.12, Math.max(2, cellSize * 0.06), "#0f172a");
      } else {
        ctx.strokeStyle = line;
        ctx.lineWidth = Math.max(1.7, cellSize * 0.062);
        ctx.beginPath();
        ctx.moveTo(-headSize * 0.16, -headSize * 0.36);
        ctx.quadraticCurveTo(headSize * 0.18, -headSize * 0.34, headSize * 0.38, -headSize * 0.08);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-headSize * 0.16, headSize * 0.36);
        ctx.quadraticCurveTo(headSize * 0.18, headSize * 0.34, headSize * 0.38, headSize * 0.08);
        ctx.stroke();
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(2, cellSize * 0.07);
        ctx.beginPath();
        ctx.moveTo(-headSize * 0.42, -headSize * 0.18);
        ctx.lineTo(-headSize * 0.1, -headSize * 0.02);
        ctx.lineTo(-headSize * 0.42, headSize * 0.18);
        ctx.stroke();
        strokeHeadEye(headSize * 0.18, -headSize * 0.12, Math.max(2, cellSize * 0.06));
        strokeHeadEye(headSize * 0.18, headSize * 0.12, Math.max(2, cellSize * 0.06));
      }

      ctx.restore();
    }

    function drawSnake(parts, palette) {
      ctx.save();
      ctx.globalAlpha *= palette.alpha ?? 1;
      parts.forEach((segment, index) => {
        const { x, y } = axialToPixel(segment);
        hexPath(x, y, cellSize * (index === 0 ? 0.82 : 0.76));
        ctx.fillStyle = index === 0 ? palette.head : palette.body;
        ctx.fill();
        ctx.strokeStyle = index === 0 ? palette.headLine : palette.bodyLine;
        ctx.lineWidth = index === 0 ? 3 : 1.5;
        ctx.stroke();
        drawSnakeOwnerMark(x, y, index, palette);
        if (index === 0) {
          drawSnakeHeadDetail(x, y, palette);
        }
        drawSnakeSegmentDetail(x, y, index, palette);

      });
      ctx.restore();
    }

    function drawSnakeOwnerMark(x, y, index, palette) {
      ctx.save();
      ctx.strokeStyle = palette.ownerColor || palette.headLine;
      ctx.lineWidth = index === 0 ? Math.max(2, cellSize * 0.1) : Math.max(1.2, cellSize * 0.055);
      ctx.setLineDash(palette.owner === "computer" ? [Math.max(3, cellSize * 0.14), Math.max(2, cellSize * 0.1)] : []);
      hexPath(x, y, cellSize * (index === 0 ? 0.9 : 0.82));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function drawSnakeSegmentDetail(x, y, index, palette) {
      const character = palette.character;
      if (!character || index === 0) return;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = index === 0 ? character.accent : hexToRgba(character.line, 0.88);
      ctx.fillStyle = hexToRgba(character.accent, index === 0 ? 0.95 : 0.72);
      ctx.lineWidth = Math.max(1.4, cellSize * 0.055);

      if (palette.owner === "computer") {
        ctx.beginPath();
        ctx.arc(x, y, cellSize * (index === 0 ? 0.58 : 0.5), Math.PI * 0.18, Math.PI * 0.82);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, cellSize * (index === 0 ? 0.58 : 0.5), Math.PI * 1.18, Math.PI * 1.82);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x - cellSize * 0.42, y);
        ctx.lineTo(x + cellSize * 0.42, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, cellSize * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }

      if (index > 0 && index % 2 === 0) {
        ctx.strokeStyle = hexToRgba("#ffffff", 0.48);
        ctx.lineWidth = Math.max(1, cellSize * 0.035);
        ctx.beginPath();
        ctx.moveTo(x - cellSize * 0.22, y - cellSize * 0.26);
        ctx.lineTo(x + cellSize * 0.22, y + cellSize * 0.26);
        ctx.stroke();
      }
      ctx.restore();
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
      draw();
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
      draw();
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
      draw();
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
      if (replayMode) return;
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
      draw();
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
      draw();
    }

    function launchDirectPlayerAttack(profile = "small", pointer = null) {
      const target = playerDirectAttackTarget(profile, pointer);
      return launchPlayerAttack(target, profile, playerDirectAttackOptions(profile, pointer));
    }

    function playerAttackFailureReason(target, profile = selectedAttackProfile, now = performance.now()) {
      const moveName = profile === "small" ? characterFor("player").smallMove : characterFor("player").bigMove;
      if (replayMode) return "正在播放重播，不能施放招式。";
      if (!running || gameOver) return "尚未開局；開始後再點棋盤可施放招式。";
      if (paused) return "遊戲暫停中，請先繼續再施放招式。";
      if (!target || !snake?.length) return `${moveName} 施放失敗：沒有有效目標格。`;

      const stock = playerStock;
      const foodCost = attackFoodCost(profile);
      const missingFood = foodTypes
        .filter(type => stock[type.id] < foodCost)
        .map(type => type.label)
        .join("、");
      if (missingFood) return `${moveName} 施放失敗：${missingFood}庫存不足，需要四種庫存各 ${foodCost}。`;

      const bombCost = attackBombCost(profile);
      if (ammoFor("player") < bombCost) return `${moveName} 施放失敗：炸彈不足，需要 ${bombCost} 枚，目前 ${ammoFor("player")} 枚。`;

      const cooldownMs = attackCooldown(stock) * (profile === "small" ? 0.58 : 1);
      const remainingMs = cooldownMs - (now - lastPlayerAttackMs);
      if (remainingMs > 0) return `${moveName} 施放失敗：冷卻中，還需 ${(remainingMs / 1000).toFixed(1)} 秒。`;

      return `${moveName} 施放失敗：目前條件不允許施放。`;
    }

    function launchPlayerAttack(target, profile = selectedAttackProfile, options = {}) {
      if (replayMode) {
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
      if (replayMode) return;
      if (!running || gameOver) {
        startGame();
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
      if (replayMode) return;
      if (!running || gameOver) {
        if (computerBattleMode && relayMode) {
          setRelayMode(false, false, false);
          setStatus("接力賽已停止。");
        }
        return;
      }
      setStatus("你已投降。");
      setRelayMode(false, false, false);
      replaySurrendered = true;
      endGame(true, false);
    }

    function boardCellFromPointer(event) {
      const rect = canvas.getBoundingClientRect();
      return nearestInsideCell(pixelToAxial(event.clientX - rect.left, event.clientY - rect.top));
    }

    function beginBoardAttackPointer(event) {
      if (replayMode) return;
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
      draw();
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
      draw();
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
      draw();
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
      if (running && !gameOver && !replayMode) {
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
      if (replayMode) return;
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
      overlayText.textContent = `場上會維持 ${foodCount} 個紅黃綠藍隨機食物。`;
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

    smallAttackButton.addEventListener("pointerdown", event => handleAttackButtonDown(event, "small"));
    bigAttackButton.addEventListener("pointerdown", event => handleAttackButtonDown(event, "big"));
    smallAttackButton.addEventListener("pointerup", event => handleAttackButtonUp(event, "small"));
    bigAttackButton.addEventListener("pointerup", event => handleAttackButtonUp(event, "big"));
    smallAttackButton.addEventListener("pointercancel", handleAttackButtonCancel);
    bigAttackButton.addEventListener("pointercancel", handleAttackButtonCancel);
    smallAttackButton.addEventListener("click", event => event.preventDefault());
    bigAttackButton.addEventListener("click", event => event.preventDefault());
    controlRow.addEventListener("pointerdown", event => {
      if (joyZone.contains(event.target)) return;
      if (event.target.closest("#bigAttackButton")) previewDirectAttack("big");
    });
    leftHandModeInput.addEventListener("change", () => setLeftHandMode(leftHandModeInput.checked));
    sfxMuteToggle.addEventListener("change", () => HexSnakeAudio.setMuted(sfxMuteToggle.checked));
    surrenderButton.addEventListener("click", surrenderGame);
    rulesButton.addEventListener("click", openRulesModal);
    rulesCloseButton.addEventListener("click", closeRulesModal);
    replayArchiveButton.addEventListener("click", openReplayModal);
    settingsReplayButton.addEventListener("click", openReplayModal);
    replayModalClose.addEventListener("click", closeReplayModal);
    replayModal.addEventListener("pointerdown", event => {
      if (event.target === replayModal) closeReplayModal();
    });
    replayModal.querySelector(".replay-dialog").addEventListener("pointerdown", event => event.stopPropagation());
    replayModal.addEventListener("click", event => {
      const playButton = event.target.closest("[data-replay-play]");
      const favoriteButton = event.target.closest("[data-replay-favorite]");
      const deleteButton = event.target.closest("[data-replay-delete]");
      if (playButton) {
        const record = findReplayRecord(playButton.dataset.replayPlay);
        if (record) startReplayPlayback(record);
        return;
      }
      if (favoriteButton) {
        toggleReplayFavorite(favoriteButton.dataset.replayFavorite);
        return;
      }
      if (deleteButton) {
        deleteReplayRecord(deleteButton.dataset.replayDelete, deleteButton.dataset.replaySection);
      }
    });
    replayPlayButton.addEventListener("click", () => {
      if (!replayPlayback) return;
      replayPlayback.paused = !replayPlayback.paused;
      replayPlayback.lastFrameAt = performance.now();
      updateReplayControls();
    });
    replayReverseButton.addEventListener("click", () => {
      if (!replayPlayback) return;
      replayPlayback.direction *= -1;
      replayPlayback.paused = false;
      replayPlayback.lastFrameAt = performance.now();
      updateReplayControls();
    });
    replaySpeedSelect.addEventListener("change", () => {
      if (!replayPlayback) return;
      const speed = Number(replaySpeedSelect.value);
      replayPlayback.speed = replayPlaybackSpeeds.includes(speed) ? speed : 1;
      replayPlayback.lastFrameAt = performance.now();
    });
    replayTimeline.addEventListener("input", () => {
      if (!replayPlayback) return;
      replayPlayback.time = Number(replayTimeline.value) || 0;
      replayPlayback.paused = true;
      replayPlayback.lastFrameAt = performance.now();
      applyReplaySnapshot(snapshotForReplayTime(replayPlayback.record, replayPlayback.time), replayPlayback.record);
      updateReplayControls();
    });
    replayExitButton.addEventListener("click", exitReplayPlayback);
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

    startButton.addEventListener("click", () => {
      if (replayMode) return;
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
      overlayText.textContent = `每吃 1 個食物獲得 2 點能量，集滿 ${attackNeedTotal} 點獲得 1 枚炸彈，最多 ${maxAmmo} 枚；能量與炸彈都滿時，施放消耗炸彈的招式會立刻把滿能量轉為 1 枚炸彈；小招消耗紅黃綠藍各 1 點，大招消耗 ${bigAttackBombCost} 枚炸彈與紅黃綠藍各 2 點。`;
      startButton.textContent = "開始";
      setOverlayChromeVisible(true);
      startGame();
    });

    computerBattleButton.addEventListener("click", () => {
      if (replayMode) return;
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

    let autoBattleSpeedDrag = null;

    function applyAutoBattleSpeedIndex(index) {
      const nextIndex = Math.max(0, Math.min(autoBattleSpeeds.length - 1, index));
      if (autoBattleSpeeds[nextIndex] === computerBattleSpeed) return;
      setComputerBattleSpeed(autoBattleSpeeds[nextIndex]);
      resetAutoBattleStepTimers();
      updateAutoBattleControls();
    }

    autoBattleSpeedSelect.addEventListener("pointerdown", event => {
      event.preventDefault();
      event.stopPropagation();
      if (!isPlayerAutoControlActive()) return;
      autoBattleSpeedDrag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startIndex: autoBattleSpeeds.indexOf(computerBattleSpeed),
        moved: false
      };
      autoBattleSpeedSelect.classList.add("is-dragging");
      autoBattleSpeedSelect.setPointerCapture(event.pointerId);
    });

    autoBattleSpeedSelect.addEventListener("pointermove", event => {
      if (!autoBattleSpeedDrag || event.pointerId !== autoBattleSpeedDrag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const dragDistance = event.clientY - autoBattleSpeedDrag.startY;
      if (Math.abs(dragDistance) > 6) {
        autoBattleSpeedDrag.moved = true;
        setAutoSpeedMenuOpen(false);
      }
      const stepDelta = Math.round((event.clientY - autoBattleSpeedDrag.startY) / 28);
      applyAutoBattleSpeedIndex(autoBattleSpeedDrag.startIndex + stepDelta);
    });

    function endAutoBattleSpeedDrag(event) {
      if (!autoBattleSpeedDrag || event.pointerId !== autoBattleSpeedDrag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const shouldToggleMenu = !autoBattleSpeedDrag.moved && isPlayerAutoControlActive();
      autoBattleSpeedSelect.classList.remove("is-dragging");
      if (autoBattleSpeedSelect.hasPointerCapture(event.pointerId)) {
        autoBattleSpeedSelect.releasePointerCapture(event.pointerId);
      }
      autoBattleSpeedDrag = null;
      if (shouldToggleMenu) setAutoSpeedMenuOpen(autoSpeedMenu.hidden);
    }

    autoBattleSpeedSelect.addEventListener("pointerup", endAutoBattleSpeedDrag);
    autoBattleSpeedSelect.addEventListener("pointercancel", endAutoBattleSpeedDrag);

    autoBattleSpeedSelect.addEventListener("wheel", event => {
      if (!isPlayerAutoControlActive()) return;
      event.preventDefault();
      event.stopPropagation();
      const currentIndex = autoBattleSpeeds.indexOf(computerBattleSpeed);
      const direction = event.deltaY > 0 ? 1 : -1;
      applyAutoBattleSpeedIndex(currentIndex + direction);
    }, { passive: false });

    autoBattleSpeedSelect.addEventListener("keydown", event => {
      if (!isPlayerAutoControlActive() || !["ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Enter" || event.key === " ") {
        setAutoSpeedMenuOpen(autoSpeedMenu.hidden);
        return;
      }
      const currentIndex = autoBattleSpeeds.indexOf(computerBattleSpeed);
      applyAutoBattleSpeedIndex(currentIndex + (event.key === "ArrowDown" ? 1 : -1));
    });

    autoSpeedMenu.addEventListener("click", event => {
      event.stopPropagation();
      const button = event.target.closest("[data-auto-speed]");
      if (!button || !isPlayerAutoControlActive()) return;
      setComputerBattleSpeed(button.dataset.autoSpeed);
      resetAutoBattleStepTimers();
      updateAutoBattleControls();
      setAutoSpeedMenuOpen(false);
    });

    document.addEventListener("pointerdown", event => {
      if (autoSpeedMenu.hidden || autoBattlePanel.contains(event.target)) return;
      setAutoSpeedMenuOpen(false);
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
      beginBoardAttackPointer(event);
    });
    playArea.addEventListener("pointermove", moveBoardAttackPointer);
    playArea.addEventListener("pointerup", finishBoardAttackPointer);
    playArea.addEventListener("pointercancel", cancelBoardAttackPointer);
    window.addEventListener("pointermove", moveBoardAttackPointer);
    window.addEventListener("pointerup", finishBoardAttackPointer);
    window.addEventListener("pointercancel", cancelBoardAttackPointer);

    window.addEventListener("keydown", event => {
      if (pendingDirectionKeybind !== null) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape" || event.key === "Esc") setPendingDirectionKeybind(null);
        else commitPendingDirectionKeybind(event.key === " " ? " " : event.key);
        return;
      }
      if (replayMode) {
        if (event.key === "Escape" || event.key === "Esc") exitReplayPlayback();
        if (event.key === " " && replayPlayback) {
          event.preventDefault();
          replayPlayback.paused = !replayPlayback.paused;
          replayPlayback.lastFrameAt = performance.now();
          updateReplayControls();
        }
        return;
      }
      if (!rulesModal.hidden) {
        if (event.key === "Escape" || event.key === "Esc") closeRulesModal();
        return;
      }
      if (!replayModal.hidden) {
        if (event.key === "Escape" || event.key === "Esc") closeReplayModal();
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
      if (pressedKey === keybinds.smallAttack || pressedKey === keybinds.bigAttack) {
        event.preventDefault();
        const profile = pressedKey === keybinds.smallAttack ? "small" : "big";
        launchDirectPlayerAttack(profile);
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
          startGame();
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

    window.addEventListener("resize", resize);

    async function bootstrap() {
      await loadBalanceConfig();
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
