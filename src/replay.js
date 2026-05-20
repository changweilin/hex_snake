    const replayRecentKey = "hexSnakeReplayRecent";
    const replayFavoritesKey = "hexSnakeReplayFavorites";
    const replaySpeedKey = "hexSnakeReplaySpeed";
    const replayLimit = 5;
    const replaySnapshotIntervalMs = 200;
    const replayMaxSnapshots = 900;
    const replayPlaybackSpeeds = [0.25, 0.5, 0.75, 1, 1.5, 2, 4];
    let activeReplayRecording = null;
    let lastReplaySnapshotAt = -Infinity;
    let replayMode = false;
    let replayPlayback = null;
    let replayPlaylist = [];
    let replayPlaylistIndex = -1;
    let replayReturnState = null;
    let replayRafId = 0;
    let replaySurrendered = false;
    const GameState = HexSnakeState.game;
    const UiState = HexSnakeState.ui;
    const ReplayState = HexSnakeState.replay;
    const ReplayDom = HexSnakeDOM;
    ReplayState.mode = replayMode;
    ReplayState.surrendered = replaySurrendered;

    function replayClone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function replayLoadList(key) {
      try {
        const parsed = HexSnakeStorage.getJson(key, []);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function replaySaveList(key, list) {
      HexSnakeStorage.setJson(key, list);
    }

    function replayCharacterName(id) {
      return HexSnakeUI.characterForId(id)?.name || id || "?";
    }

    function replayTitleFor(record) {
      const date = new Date(record.createdAt || Date.now());
      const dateText = Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      const winner = record.winnerOwner === "player" ? "P1 勝" : record.winnerOwner === "computer" ? "P2 勝" : "平手";
      return `${dateText} ${winner} ${record.score}:${record.computerScore}`;
    }

    function replayMetaFor(record) {
      const mode = record.computerBattleMode ? (record.relayMode ? "連戰" : "自動對弈") : "P1 戰鬥";
      return `${mode} · ${replayCharacterName(record.playerCharacterId)} vs ${replayCharacterName(record.computerCharacterId)} · ${HexSnakeUI.formatTime(record.durationMs || 0)} · ${record.snapshots?.length || 0} frames`;
    }

    function normalizeReplayRecord(record) {
      return {
        ...record,
        snapshots: Array.isArray(record.snapshots) ? record.snapshots : []
      };
    }

    function normalizeReplaySpeed(value) {
      const speed = Number(value);
      return replayPlaybackSpeeds.includes(speed) ? speed : 1;
    }

    function storedReplaySpeed() {
      return normalizeReplaySpeed(HexSnakeStorage.get(replaySpeedKey));
    }

    function allReplayRecords() {
      const records = [...replayLoadList(replayFavoritesKey), ...replayLoadList(replayRecentKey)]
        .map(normalizeReplayRecord);
      const seen = new Set();
      return records.filter(record => {
        if (!record?.id || seen.has(record.id)) return false;
        seen.add(record.id);
        return true;
      });
    }

    function compactTimedItems(items, now, fields) {
      return replayClone(items || []).map(item => {
        fields.forEach(field => {
          if (Number.isFinite(item[field])) item[field] = Math.round(item[field] - now);
        });
        return item;
      });
    }

    function restoreTimedItems(items, now, fields) {
      return replayClone(items || []).map(item => {
        fields.forEach(field => {
          if (Number.isFinite(item[field])) item[field] = now + item[field];
        });
        return item;
      });
    }

    function createReplaySnapshot(now, final = false) {
      return {
        t: Math.round(GameState.totalElapsedMs),
        final,
        radius: GameState.radius,
        gridSize: GameState.gridSize,
        playerCharacterId: GameState.playerCharacterId,
        computerCharacterId: GameState.computerCharacterId,
        dir: GameState.dir,
        nextDir: GameState.nextDir,
        computerDir: GameState.computerDir,
        snake: replayClone(GameState.snake || []),
        computerSnake: replayClone(GameState.computerSnake || []),
        foods: replayClone(GameState.foods || []),
        projectiles: compactTimedItems(GameState.projectiles, now, ["createdAt", "impactAt"]),
        blasts: compactTimedItems(GameState.blasts, now, ["startedAt", "endAt"]),
        hazards: compactTimedItems(GameState.hazards, now, ["startedAt", "endAt", "nextTickAt"]),
        targetCell: GameState.targetCell ? { ...GameState.targetCell } : null,
        targetActive: GameState.targetActive,
        score: GameState.score,
        computerScore: GameState.computerScore,
        playerHp: GameState.playerHp,
        computerHp: GameState.computerHp,
        playerStock: replayClone(GameState.playerStock || {}),
        computerStock: replayClone(GameState.computerStock || {}),
        playerAmmo: GameState.playerAmmo,
        computerAmmo: GameState.computerAmmo,
        playerAmmoCharge: GameState.playerAmmoCharge,
        computerAmmoCharge: GameState.computerAmmoCharge,
        totalElapsedMs: GameState.totalElapsedMs,
        lastFeedElapsedMs: GameState.lastFeedElapsedMs,
        playerStunRemaining: Math.max(0, GameState.playerStunUntil - now),
        playerSlowRemaining: Math.max(0, GameState.playerSlowUntil - now),
        computerStunRemaining: Math.max(0, GameState.computerStunUntil - now),
        computerSlowRemaining: Math.max(0, GameState.computerSlowUntil - now),
        playerCollisionParalysisMs: GameState.playerCollisionParalysisMs,
        computerCollisionParalysisMs: GameState.computerCollisionParalysisMs,
        playerUndergroundRemaining: Math.max(0, GameState.playerUndergroundUntil - now),
        computerUndergroundRemaining: Math.max(0, GameState.computerUndergroundUntil - now)
      };
    }

    function startReplayRecording() {
      activeReplayRecording = {
        id: `replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        playerCharacterId: GameState.playerCharacterId,
        computerCharacterId: GameState.computerCharacterId,
        computerBattleMode: GameState.computerBattleMode,
        relayMode: GameState.relayMode,
        settings: {
          gridSize: GameState.gridSize,
          foodCount: GameState.foodCount,
          computerDifficulty: GameState.computerDifficulty,
          initialSpeed: GameState.initialSpeed,
          gmMode: GameState.gmMode,
          initialLength: GameState.initialLength,
          initialEnergy: GameState.initialEnergy,
          initialBombs: GameState.initialBombs,
          initialStock: replayClone(GameState.initialStock)
        },
        snapshots: []
      };
      lastReplaySnapshotAt = -Infinity;
      recordReplaySnapshot(performance.now(), true);
    }

    function recordReplaySnapshot(now, force = false) {
      if (!activeReplayRecording || replayMode || !GameState.snake || !GameState.computerSnake) return;
      if (!force && now - lastReplaySnapshotAt < replaySnapshotIntervalMs) return;
      activeReplayRecording.snapshots.push(createReplaySnapshot(now));
      lastReplaySnapshotAt = now;
      if (activeReplayRecording.snapshots.length > replayMaxSnapshots) {
        const keep = activeReplayRecording.snapshots.filter((_, index) => index % 2 === 0);
        activeReplayRecording.snapshots = keep;
      }
    }

    function replayWinnerOwner(playerLost, computerLost) {
      if (!playerLost && computerLost) return "player";
      if (playerLost && !computerLost) return "computer";
      if (playerLost && computerLost && GameState.score > GameState.computerScore) return "player";
      if (playerLost && computerLost && GameState.computerScore > GameState.score) return "computer";
      return null;
    }

    function finishReplayRecording(playerLost, computerLost) {
      if (!activeReplayRecording) return;
      const now = performance.now();
      recordReplaySnapshot(now, true);
      activeReplayRecording.snapshots.push(createReplaySnapshot(now, true));
      const record = normalizeReplayRecord({
        ...activeReplayRecording,
        durationMs: Math.round(GameState.totalElapsedMs),
        score: GameState.score,
        computerScore: GameState.computerScore,
        winnerOwner: replayWinnerOwner(playerLost, computerLost),
        playerLost,
        computerLost,
        surrendered: replaySurrendered,
        title: ""
      });
      record.title = replayTitleFor(record);
      activeReplayRecording = null;
      if (record.snapshots.length < 2) return;
      const recent = replayLoadList(replayRecentKey).filter(item => item.id !== record.id);
      recent.unshift(record);
      while (recent.length > replayLimit) recent.pop();
      try {
        replaySaveList(replayRecentKey, recent);
      } catch {
        while (recent.length > 1) {
          recent.pop();
          try {
            replaySaveList(replayRecentKey, recent);
            break;
          } catch {
            continue;
          }
        }
      }
    }

    function isReplayFavorite(recordId) {
      return replayLoadList(replayFavoritesKey).some(record => record.id === recordId);
    }

    function setReplayMessage(text = "") {
      ReplayDom.replayMessage.textContent = text;
    }

    function createReplayActionButton(label, dataset, className = "") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (className) button.className = className;
      Object.entries(dataset).forEach(([key, value]) => {
        button.dataset[key] = value;
      });
      return button;
    }

    function renderReplayList(container, records, favoriteSection = false) {
      container.innerHTML = "";
      if (!records.length) {
        const empty = document.createElement("div");
        empty.className = "replay-empty";
        empty.textContent = "目前沒有紀錄。";
        container.append(empty);
        return;
      }
      records.forEach(record => {
        const row = document.createElement("div");
        row.className = "replay-row";

        const details = document.createElement("div");
        const title = document.createElement("span");
        title.className = "replay-title";
        title.textContent = record.title || replayTitleFor(record);
        const meta = document.createElement("div");
        meta.className = "replay-meta";
        meta.textContent = replayMetaFor(record);
        details.append(title, meta);

        const actions = document.createElement("div");
        actions.className = "replay-actions";
        actions.append(
          createReplayActionButton("播放", { replayPlay: record.id }),
          createReplayActionButton(isReplayFavorite(record.id) ? "取消最愛" : "加入最愛", { replayFavorite: record.id }, "secondary"),
          createReplayActionButton("刪除", {
            replayDelete: record.id,
            replaySection: favoriteSection ? "favorite" : "recent"
          }, "secondary")
        );

        row.append(details, actions);
        container.append(row);
      });
    }

    function refreshReplayModal() {
      const recent = replayLoadList(replayRecentKey).map(normalizeReplayRecord);
      const favorites = replayLoadList(replayFavoritesKey).map(normalizeReplayRecord);
      ReplayDom.recentReplayCount.textContent = `${recent.length} / ${replayLimit}`;
      ReplayDom.favoriteReplayCount.textContent = `${favorites.length} / ${replayLimit}`;
      renderReplayList(ReplayDom.recentReplayList, recent, false);
      renderReplayList(ReplayDom.favoriteReplayList, favorites, true);
    }

    function openReplayModal() {
      if (GameState.running && !GameState.gameOver) return;
      HexSnakeGame.clearRelayRestartTimer();
      setReplayMessage("");
      refreshReplayModal();
      ReplayDom.replayModal.hidden = false;
    }

    function closeReplayModal() {
      ReplayDom.replayModal.hidden = true;
    }

    function findReplayRecord(recordId) {
      return allReplayRecords().find(record => record.id === recordId);
    }

    function toggleReplayFavorite(recordId) {
      const favorites = replayLoadList(replayFavoritesKey);
      const existingIndex = favorites.findIndex(record => record.id === recordId);
      if (existingIndex >= 0) {
        favorites.splice(existingIndex, 1);
        replaySaveList(replayFavoritesKey, favorites);
        setReplayMessage("已取消最愛。");
        refreshReplayModal();
        return;
      }
      if (favorites.length >= replayLimit) {
        setReplayMessage("我的最愛已滿 5 場，請先取消一場最愛。");
        return;
      }
      const record = findReplayRecord(recordId);
      if (!record) return;
      favorites.unshift(record);
      replaySaveList(replayFavoritesKey, favorites);
      setReplayMessage("已加入最愛。");
      refreshReplayModal();
    }

    function deleteReplayRecord(recordId, section) {
      const key = section === "favorite" ? replayFavoritesKey : replayRecentKey;
      replaySaveList(key, replayLoadList(key).filter(record => record.id !== recordId));
      setReplayMessage("已刪除紀錄。");
      refreshReplayModal();
    }

    function replayDuration(record) {
      const last = record.snapshots[record.snapshots.length - 1];
      return Math.max(0, last?.t || record.durationMs || 0);
    }

    function snapshotForReplayTime(record, t) {
      const snapshots = record.snapshots || [];
      if (!snapshots.length) return null;
      let low = 0;
      let high = snapshots.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if ((snapshots[mid].t || 0) <= t) low = mid;
        else high = mid - 1;
      }
      return snapshots[low] || snapshots[0];
    }

    function applyReplaySnapshot(snapshot, record) {
      if (!snapshot) return;
      const now = performance.now();
      const previousPlayerCharacterId = GameState.playerCharacterId;
      const previousComputerCharacterId = GameState.computerCharacterId;
      GameState.playerCharacterId = snapshot.playerCharacterId || record.playerCharacterId;
      GameState.computerCharacterId = snapshot.computerCharacterId || record.computerCharacterId;
      GameState.gridSize = snapshot.gridSize || record.settings?.gridSize || GameState.gridSize;
      GameState.radius = snapshot.radius ?? GameState.gridSize - 1;
      HexSnakeGame.buildCells();
      GameState.dir = snapshot.dir || 0;
      GameState.nextDir = snapshot.nextDir || GameState.dir;
      GameState.computerDir = snapshot.computerDir || 3;
      GameState.snake = replayClone(snapshot.snake || []);
      GameState.computerSnake = replayClone(snapshot.computerSnake || []);
      GameState.foods = replayClone(snapshot.foods || []);
      GameState.projectiles = restoreTimedItems(snapshot.projectiles, now, ["createdAt", "impactAt"]);
      GameState.blasts = restoreTimedItems(snapshot.blasts, now, ["startedAt", "endAt"]);
      GameState.hazards = restoreTimedItems(snapshot.hazards, now, ["startedAt", "endAt", "nextTickAt"]);
      GameState.targetCell = snapshot.targetCell ? { ...snapshot.targetCell } : null;
      GameState.targetActive = Boolean(snapshot.targetActive);
      GameState.score = snapshot.score || 0;
      GameState.computerScore = snapshot.computerScore || 0;
      GameState.playerHp = snapshot.playerHp ?? HexSnakeUI.maxHpForSnake(GameState.snake);
      GameState.computerHp = snapshot.computerHp ?? HexSnakeUI.maxHpForSnake(GameState.computerSnake);
      GameState.playerStock = replayClone(snapshot.playerStock || {});
      GameState.computerStock = replayClone(snapshot.computerStock || {});
      GameState.playerAmmo = snapshot.playerAmmo || 0;
      GameState.computerAmmo = snapshot.computerAmmo || 0;
      GameState.playerAmmoCharge = snapshot.playerAmmoCharge || 0;
      GameState.computerAmmoCharge = snapshot.computerAmmoCharge || 0;
      GameState.totalElapsedMs = snapshot.totalElapsedMs || snapshot.t || 0;
      GameState.lastFeedElapsedMs = snapshot.lastFeedElapsedMs || 0;
      GameState.playerStunUntil = now + (snapshot.playerStunRemaining || 0);
      GameState.playerSlowUntil = now + (snapshot.playerSlowRemaining || 0);
      GameState.computerStunUntil = now + (snapshot.computerStunRemaining || 0);
      GameState.computerSlowUntil = now + (snapshot.computerSlowRemaining || 0);
      GameState.playerCollisionParalysisMs = snapshot.playerCollisionParalysisMs || 0;
      GameState.computerCollisionParalysisMs = snapshot.computerCollisionParalysisMs || 0;
      GameState.playerUndergroundUntil = now + (snapshot.playerUndergroundRemaining || 0);
      GameState.computerUndergroundUntil = now + (snapshot.computerUndergroundRemaining || 0);
      if (
        previousPlayerCharacterId !== GameState.playerCharacterId ||
        previousComputerCharacterId !== GameState.computerCharacterId ||
        !ReplayDom.characterStage.innerHTML
      ) {
        HexSnakeUI.buildCharacterStage();
      }
      HexSnakeGame.updateHud();
      draw();
    }

    function replayPlaybackSpeedLabel(value) {
      return `x${Number(value).toString()}`;
    }

    function updateReplayControls() {
      if (!replayPlayback) return;
      const duration = replayPlayback.duration;
      const speedLabel = replayPlaybackSpeedLabel(replayPlayback.speed);
      const playLabel = replayPlayback.paused ? "播放" : "暫停";
      const reverseLabel = replayPlayback.direction < 0 ? "正放" : "倒放";
      ReplayDom.replayTimeline.max = String(Math.max(0, Math.round(duration)));
      ReplayDom.replayTimeline.value = String(Math.max(0, Math.min(duration, Math.round(replayPlayback.time))));
      ReplayDom.replaySpeedSelect.textContent = speedLabel;
      ReplayDom.replaySpeedSelect.dataset.value = String(replayPlayback.speed);
      ReplayDom.replaySpeedSelect.setAttribute("aria-valuenow", String(replayPlayback.speed));
      ReplayDom.replaySpeedSelect.setAttribute("aria-valuetext", speedLabel);
      ReplayDom.replayPlayButton.textContent = replayPlayback.paused ? "▶" : "⏸";
      ReplayDom.replayPlayButton.setAttribute("aria-label", playLabel);
      ReplayDom.replayPlayButton.title = playLabel;
      ReplayDom.replayReverseButton.classList.toggle("is-selected", replayPlayback.direction < 0);
      ReplayDom.replayReverseButton.textContent = replayPlayback.direction < 0 ? "↪" : "↩";
      ReplayDom.replayReverseButton.setAttribute("aria-label", reverseLabel);
      ReplayDom.replayReverseButton.title = reverseLabel;
      ReplayDom.replayPrevButton.disabled = replayPlaylist.length <= 1;
      ReplayDom.replayNextButton.disabled = replayPlaylist.length <= 1;
      ReplayDom.replayTime.textContent = `${HexSnakeUI.formatTime(replayPlayback.time)} / ${HexSnakeUI.formatTime(duration)}`;
      if (!ReplayDom.replaySpeedMenu.hidden) {
        ReplayDom.replaySpeedMenu.querySelectorAll("[data-replay-speed]").forEach(button => {
          button.classList.toggle("is-selected", Number(button.dataset.replaySpeed) === replayPlayback.speed);
        });
      }
    }

    function captureReplayReturnState() {
      return {
        snapshot: GameState.snake && GameState.computerSnake ? createReplaySnapshot(performance.now(), true) : null,
        overlayClassName: ReplayDom.overlay.className,
        overlayTitleHidden: ReplayDom.overlayTitle.hidden,
        overlayTextHidden: ReplayDom.overlayText.hidden,
        startButtonHidden: ReplayDom.startButton.hidden,
        computerBattleButtonHidden: ReplayDom.computerBattleButton.hidden,
        replayArchiveButtonHidden: ReplayDom.replayArchiveButton.hidden,
        introCloseButtonHidden: ReplayDom.introCloseButton.hidden,
        title: ReplayDom.overlayTitle.textContent,
        text: ReplayDom.overlayText.textContent,
        startText: ReplayDom.startButton.textContent,
        winnerPortraitHidden: ReplayDom.winnerPortrait.hidden,
        winnerPortraitHtml: ReplayDom.winnerPortrait.innerHTML,
        characterStageClassName: ReplayDom.characterStage.className,
        characterStageHidden: ReplayDom.characterStage.hidden,
        characterStageHtml: ReplayDom.characterStage.innerHTML,
        statusText: ReplayDom.statusEl.textContent,
        gameOver: GameState.gameOver,
        running: GameState.running,
        paused: GameState.paused,
        computerBattleMode: GameState.computerBattleMode,
        playerAutoMode: GameState.playerAutoMode,
        computerBattleManualOverride: GameState.computerBattleManualOverride,
        relayMode: GameState.relayMode,
        playerCharacterId: GameState.playerCharacterId,
        computerCharacterId: GameState.computerCharacterId,
        playerCharacterChoice: GameState.playerCharacterChoice,
        computerCharacterChoice: GameState.computerCharacterChoice,
        selectedPortraitOwner: UiState.selectedPortraitOwner,
        introDetailsOpen: UiState.introDetailsOpen
      };
    }

    function restoreReplayReturnState(state) {
      if (!state) {
        HexSnakeGame.returnToStartScreen();
        return;
      }
      GameState.playerCharacterId = state.playerCharacterId;
      GameState.computerCharacterId = state.computerCharacterId;
      GameState.playerCharacterChoice = state.playerCharacterChoice;
      GameState.computerCharacterChoice = state.computerCharacterChoice;
      UiState.selectedPortraitOwner = state.selectedPortraitOwner;
      UiState.introDetailsOpen = state.introDetailsOpen;
      GameState.running = state.running;
      GameState.paused = state.paused;
      GameState.gameOver = state.gameOver;
      GameState.computerBattleMode = state.computerBattleMode;
      GameState.playerAutoMode = Boolean(state.playerAutoMode);
      GameState.computerBattleManualOverride = Boolean(state.computerBattleManualOverride);
      GameState.relayMode = state.relayMode;
      if (state.snapshot) applyReplaySnapshot(state.snapshot, state);
      ReplayDom.overlay.className = state.overlayClassName;
      ReplayDom.overlayTitle.hidden = state.overlayTitleHidden;
      ReplayDom.overlayText.hidden = state.overlayTextHidden;
      ReplayDom.startButton.hidden = state.startButtonHidden;
      ReplayDom.computerBattleButton.hidden = state.computerBattleButtonHidden;
      ReplayDom.replayArchiveButton.hidden = state.replayArchiveButtonHidden;
      ReplayDom.introCloseButton.hidden = state.introCloseButtonHidden;
      ReplayDom.overlayTitle.textContent = state.title;
      ReplayDom.overlayText.textContent = state.text;
      ReplayDom.startButton.textContent = state.startText;
      ReplayDom.winnerPortrait.hidden = state.winnerPortraitHidden;
      ReplayDom.winnerPortrait.innerHTML = state.winnerPortraitHtml;
      ReplayDom.characterStage.className = state.characterStageClassName || "character-stage";
      ReplayDom.characterStage.hidden = state.characterStageHidden;
      ReplayDom.characterStage.innerHTML = state.characterStageHtml;
      HexSnakeGame.setStatus(state.statusText);
      HexSnakeGame.updateHud();
      HexSnakeGame.updateSettingsActionMode();
      HexSnakeGame.updateAutoBattleControls();
      draw();
    }

    function renderReplayFrame() {
      if (!replayPlayback) return;
      const now = performance.now();
      const delta = replayPlayback.lastFrameAt ? now - replayPlayback.lastFrameAt : 0;
      replayPlayback.lastFrameAt = now;
      if (!replayPlayback.paused) {
        replayPlayback.time += delta * replayPlayback.speed * replayPlayback.direction;
        if (replayPlayback.time <= 0) {
          replayPlayback.time = 0;
          replayPlayback.paused = true;
        }
        if (replayPlayback.time >= replayPlayback.duration) {
          replayPlayback.time = replayPlayback.duration;
          replayPlayback.paused = true;
        }
      }
      applyReplaySnapshot(snapshotForReplayTime(replayPlayback.record, replayPlayback.time), replayPlayback.record);
      updateReplayControls();
      replayRafId = requestAnimationFrame(renderReplayFrame);
    }

    function prepareReplayPlaylist(record) {
      const current = normalizeReplayRecord(record);
      replayPlaylist = allReplayRecords();
      if (!replayPlaylist.some(item => item.id === current.id)) {
        replayPlaylist.unshift(current);
      }
      replayPlaylistIndex = replayPlaylist.findIndex(item => item.id === current.id);
      if (replayPlaylistIndex < 0) replayPlaylistIndex = 0;
    }

    function loadReplayPlaybackRecord(record) {
      record = normalizeReplayRecord(record);
      if (!record.snapshots.length) return;
      ReplayDom.replaySpeedMenu.hidden = true;
      ReplayDom.replaySpeedSelect.setAttribute("aria-expanded", "false");
      replayPlayback = {
        record,
        time: 0,
        duration: replayDuration(record),
        speed: storedReplaySpeed(),
        direction: 1,
        paused: false,
        lastFrameAt: performance.now()
      };
      applyReplaySnapshot(record.snapshots[0], record);
      updateReplayControls();
      cancelAnimationFrame(replayRafId);
      replayRafId = requestAnimationFrame(renderReplayFrame);
      return true;
    }

    function startReplayPlayback(record) {
      record = normalizeReplayRecord(record);
      if (!record.snapshots.length) return false;
      closeReplayModal();
      cancelAnimationFrame(GameState.rafId);
      HexSnakeGame.clearRelayRestartTimer();
      replayReturnState = captureReplayReturnState();
      replayMode = true;
      ReplayState.mode = replayMode;
      GameState.running = false;
      GameState.paused = true;
      GameState.gameOver = false;
      GameState.computerBattleMode = false;
      GameState.playerAutoMode = false;
      GameState.computerBattleManualOverride = false;
      HexSnakeGame.updateAutoBattleControls();
      HexSnakeGame.setSettingsLocked(true);
      HexSnakeUI.setOverlayChromeVisible(false);
      ReplayDom.overlay.classList.remove("show");
      HexSnakeUI.setCharacterStageOverlayMode(false);
      ReplayDom.replayControls.hidden = false;
      prepareReplayPlaylist(record);
      loadReplayPlaybackRecord(record);
      return true;
    }

    function switchReplayPlayback(delta) {
      if (!replayPlayback) return false;
      if (!replayPlaylist.length) prepareReplayPlaylist(replayPlayback.record);
      if (replayPlaylist.length <= 1) return false;
      replayPlaylistIndex = (replayPlaylistIndex + delta + replayPlaylist.length) % replayPlaylist.length;
      return loadReplayPlaybackRecord(replayPlaylist[replayPlaylistIndex]);
    }

    function exitReplayPlayback() {
      if (!replayMode) return;
      cancelAnimationFrame(replayRafId);
      replayRafId = 0;
      replayMode = false;
      replayPlayback = null;
      replayPlaylist = [];
      replayPlaylistIndex = -1;
      ReplayState.mode = replayMode;
      ReplayDom.replayControls.hidden = true;
      ReplayDom.replaySpeedMenu.hidden = true;
      ReplayDom.replaySpeedSelect.setAttribute("aria-expanded", "false");
      HexSnakeGame.setSettingsLocked(false);
      restoreReplayReturnState(replayReturnState);
      replayReturnState = null;
    }

    HexSnakePlatform.lifecycle.onPause(() => {
      if (!replayRafId) return;
      cancelAnimationFrame(replayRafId);
      replayRafId = 0;
      if (replayPlayback) replayPlayback.lastFrameAt = performance.now();
    });

    HexSnakePlatform.lifecycle.onResume(() => {
      if (!replayPlayback || replayRafId) return;
      replayPlayback.lastFrameAt = performance.now();
      replayRafId = requestAnimationFrame(renderReplayFrame);
    });

    const HexSnakeReplay = Object.freeze({
      get playback() {
        return replayPlayback;
      },
      get playbackSpeeds() {
        return replayPlaybackSpeeds;
      },
      isPlaybackMode() {
        return replayMode;
      },
      resetSurrendered() {
        replaySurrendered = false;
        ReplayState.surrendered = replaySurrendered;
      },
      markSurrendered() {
        replaySurrendered = true;
        ReplayState.surrendered = replaySurrendered;
      },
      startRecording: startReplayRecording,
      recordSnapshot: recordReplaySnapshot,
      finishRecording: finishReplayRecording,
      createSnapshot(now = performance.now(), final = false) {
        return createReplaySnapshot(now, final);
      },
      applySnapshot(snapshot, record = {}) {
        applyReplaySnapshot(snapshot, record);
      },
      openModal: openReplayModal,
      closeModal: closeReplayModal,
      findRecord: findReplayRecord,
      toggleFavorite: toggleReplayFavorite,
      deleteRecord: deleteReplayRecord,
      startPlayback: startReplayPlayback,
      exitPlayback: exitReplayPlayback,
      switchPlayback: switchReplayPlayback,
      updateControls: updateReplayControls,
      togglePlaybackPaused() {
        if (!replayPlayback) return false;
        replayPlayback.paused = !replayPlayback.paused;
        replayPlayback.lastFrameAt = performance.now();
        updateReplayControls();
        return true;
      },
      reversePlayback() {
        if (!replayPlayback) return false;
        replayPlayback.direction *= -1;
        replayPlayback.paused = false;
        replayPlayback.lastFrameAt = performance.now();
        updateReplayControls();
        return true;
      },
      setPlaybackSpeed(value) {
        if (!replayPlayback) return false;
        replayPlayback.speed = normalizeReplaySpeed(value);
        HexSnakeStorage.set(replaySpeedKey, String(replayPlayback.speed));
        replayPlayback.lastFrameAt = performance.now();
        updateReplayControls();
        return true;
      },
      seekPlayback(value) {
        if (!replayPlayback) return false;
        const nextTime = Number(value) || 0;
        replayPlayback.time = Math.max(0, Math.min(replayPlayback.duration, nextTime));
        replayPlayback.paused = true;
        replayPlayback.lastFrameAt = performance.now();
        applyReplaySnapshot(snapshotForReplayTime(replayPlayback.record, replayPlayback.time), replayPlayback.record);
        updateReplayControls();
        return true;
      }
    });
