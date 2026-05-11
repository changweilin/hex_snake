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
    HexSnakeState.replay.mode = replayMode;
    HexSnakeState.replay.surrendered = replaySurrendered;

    function replayClone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function replayLoadList(key) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function replaySaveList(key, list) {
      localStorage.setItem(key, JSON.stringify(list));
    }

    function replayCharacterName(id) {
      return characterById.get(id)?.name || id || "?";
    }

    function replayTitleFor(record) {
      const date = new Date(record.createdAt || Date.now());
      const dateText = Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      const winner = record.winnerOwner === "player" ? "P1 勝" : record.winnerOwner === "computer" ? "P2 勝" : "平手";
      return `${dateText} ${winner} ${record.score}:${record.computerScore}`;
    }

    function replayMetaFor(record) {
      const mode = record.computerBattleMode ? (record.relayMode ? "連戰" : "自動對弈") : "P1 戰鬥";
      return `${mode} · ${replayCharacterName(record.playerCharacterId)} vs ${replayCharacterName(record.computerCharacterId)} · ${formatTime(record.durationMs || 0)} · ${record.snapshots?.length || 0} frames`;
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
      return normalizeReplaySpeed(localStorage.getItem(replaySpeedKey));
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
        t: Math.round(totalElapsedMs),
        final,
        radius,
        gridSize,
        playerCharacterId,
        computerCharacterId,
        dir,
        nextDir,
        computerDir,
        snake: replayClone(snake || []),
        computerSnake: replayClone(computerSnake || []),
        foods: replayClone(foods || []),
        projectiles: compactTimedItems(projectiles, now, ["createdAt", "impactAt"]),
        blasts: compactTimedItems(blasts, now, ["startedAt", "endAt"]),
        hazards: compactTimedItems(hazards, now, ["startedAt", "endAt", "nextTickAt"]),
        targetCell: targetCell ? { ...targetCell } : null,
        targetActive,
        score,
        computerScore,
        playerHp,
        computerHp,
        playerStock: replayClone(playerStock || {}),
        computerStock: replayClone(computerStock || {}),
        playerAmmo,
        computerAmmo,
        playerAmmoCharge,
        computerAmmoCharge,
        totalElapsedMs,
        lastFeedElapsedMs,
        playerStunRemaining: Math.max(0, playerStunUntil - now),
        playerSlowRemaining: Math.max(0, playerSlowUntil - now),
        computerStunRemaining: Math.max(0, computerStunUntil - now),
        computerSlowRemaining: Math.max(0, computerSlowUntil - now),
        playerCollisionParalysisMs,
        computerCollisionParalysisMs,
        playerUndergroundRemaining: Math.max(0, playerUndergroundUntil - now),
        computerUndergroundRemaining: Math.max(0, computerUndergroundUntil - now)
      };
    }

    function startReplayRecording() {
      activeReplayRecording = {
        id: `replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        playerCharacterId,
        computerCharacterId,
        computerBattleMode,
        relayMode,
        settings: {
          gridSize,
          foodCount,
          computerDifficulty,
          initialSpeed,
          gmMode,
          initialLength,
          initialEnergy,
          initialBombs,
          initialStock: replayClone(initialStock)
        },
        snapshots: []
      };
      lastReplaySnapshotAt = -Infinity;
      recordReplaySnapshot(performance.now(), true);
    }

    function recordReplaySnapshot(now, force = false) {
      if (!activeReplayRecording || replayMode || !snake || !computerSnake) return;
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
      if (playerLost && computerLost && score > computerScore) return "player";
      if (playerLost && computerLost && computerScore > score) return "computer";
      return null;
    }

    function finishReplayRecording(playerLost, computerLost) {
      if (!activeReplayRecording) return;
      const now = performance.now();
      recordReplaySnapshot(now, true);
      activeReplayRecording.snapshots.push(createReplaySnapshot(now, true));
      const record = normalizeReplayRecord({
        ...activeReplayRecording,
        durationMs: Math.round(totalElapsedMs),
        score,
        computerScore,
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
      replayMessage.textContent = text;
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
        row.innerHTML = `
          <div>
            <span class="replay-title">${record.title || replayTitleFor(record)}</span>
            <div class="replay-meta">${replayMetaFor(record)}</div>
          </div>
          <div class="replay-actions">
            <button type="button" data-replay-play="${record.id}">播放</button>
            <button class="secondary" type="button" data-replay-favorite="${record.id}">${isReplayFavorite(record.id) ? "取消最愛" : "加入最愛"}</button>
            <button class="secondary" type="button" data-replay-delete="${record.id}" data-replay-section="${favoriteSection ? "favorite" : "recent"}">刪除</button>
          </div>
        `;
        container.append(row);
      });
    }

    function refreshReplayModal() {
      const recent = replayLoadList(replayRecentKey).map(normalizeReplayRecord);
      const favorites = replayLoadList(replayFavoritesKey).map(normalizeReplayRecord);
      recentReplayCount.textContent = `${recent.length} / ${replayLimit}`;
      favoriteReplayCount.textContent = `${favorites.length} / ${replayLimit}`;
      renderReplayList(recentReplayList, recent, false);
      renderReplayList(favoriteReplayList, favorites, true);
    }

    function openReplayModal() {
      if (running && !gameOver) return;
      clearRelayRestartTimer();
      setReplayMessage("");
      refreshReplayModal();
      replayModal.hidden = false;
    }

    function closeReplayModal() {
      replayModal.hidden = true;
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
      const previousPlayerCharacterId = playerCharacterId;
      const previousComputerCharacterId = computerCharacterId;
      playerCharacterId = snapshot.playerCharacterId || record.playerCharacterId;
      computerCharacterId = snapshot.computerCharacterId || record.computerCharacterId;
      gridSize = snapshot.gridSize || record.settings?.gridSize || gridSize;
      radius = snapshot.radius ?? gridSize - 1;
      buildCells();
      dir = snapshot.dir || 0;
      nextDir = snapshot.nextDir || dir;
      computerDir = snapshot.computerDir || 3;
      snake = replayClone(snapshot.snake || []);
      computerSnake = replayClone(snapshot.computerSnake || []);
      foods = replayClone(snapshot.foods || []);
      projectiles = restoreTimedItems(snapshot.projectiles, now, ["createdAt", "impactAt"]);
      blasts = restoreTimedItems(snapshot.blasts, now, ["startedAt", "endAt"]);
      hazards = restoreTimedItems(snapshot.hazards, now, ["startedAt", "endAt", "nextTickAt"]);
      targetCell = snapshot.targetCell ? { ...snapshot.targetCell } : null;
      targetActive = Boolean(snapshot.targetActive);
      score = snapshot.score || 0;
      computerScore = snapshot.computerScore || 0;
      playerHp = snapshot.playerHp ?? maxHpForSnake(snake);
      computerHp = snapshot.computerHp ?? maxHpForSnake(computerSnake);
      playerStock = replayClone(snapshot.playerStock || {});
      computerStock = replayClone(snapshot.computerStock || {});
      playerAmmo = snapshot.playerAmmo || 0;
      computerAmmo = snapshot.computerAmmo || 0;
      playerAmmoCharge = snapshot.playerAmmoCharge || 0;
      computerAmmoCharge = snapshot.computerAmmoCharge || 0;
      totalElapsedMs = snapshot.totalElapsedMs || snapshot.t || 0;
      lastFeedElapsedMs = snapshot.lastFeedElapsedMs || 0;
      playerStunUntil = now + (snapshot.playerStunRemaining || 0);
      playerSlowUntil = now + (snapshot.playerSlowRemaining || 0);
      computerStunUntil = now + (snapshot.computerStunRemaining || 0);
      computerSlowUntil = now + (snapshot.computerSlowRemaining || 0);
      playerCollisionParalysisMs = snapshot.playerCollisionParalysisMs || 0;
      computerCollisionParalysisMs = snapshot.computerCollisionParalysisMs || 0;
      playerUndergroundUntil = now + (snapshot.playerUndergroundRemaining || 0);
      computerUndergroundUntil = now + (snapshot.computerUndergroundRemaining || 0);
      if (previousPlayerCharacterId !== playerCharacterId || previousComputerCharacterId !== computerCharacterId || !characterStage.innerHTML) {
        buildCharacterStage();
      }
      updateHud();
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
      replayTimeline.max = String(Math.max(0, Math.round(duration)));
      replayTimeline.value = String(Math.max(0, Math.min(duration, Math.round(replayPlayback.time))));
      replaySpeedSelect.textContent = speedLabel;
      replaySpeedSelect.dataset.value = String(replayPlayback.speed);
      replaySpeedSelect.setAttribute("aria-valuenow", String(replayPlayback.speed));
      replaySpeedSelect.setAttribute("aria-valuetext", speedLabel);
      replayPlayButton.textContent = replayPlayback.paused ? "▶" : "⏸";
      replayPlayButton.setAttribute("aria-label", playLabel);
      replayPlayButton.title = playLabel;
      replayReverseButton.classList.toggle("is-selected", replayPlayback.direction < 0);
      replayReverseButton.textContent = replayPlayback.direction < 0 ? "↪" : "↩";
      replayReverseButton.setAttribute("aria-label", reverseLabel);
      replayReverseButton.title = reverseLabel;
      replayPrevButton.disabled = replayPlaylist.length <= 1;
      replayNextButton.disabled = replayPlaylist.length <= 1;
      replayTime.textContent = `${formatTime(replayPlayback.time)} / ${formatTime(duration)}`;
      if (!replaySpeedMenu.hidden) {
        replaySpeedMenu.querySelectorAll("[data-replay-speed]").forEach(button => {
          button.classList.toggle("is-selected", Number(button.dataset.replaySpeed) === replayPlayback.speed);
        });
      }
    }

    function captureReplayReturnState() {
      return {
        snapshot: snake && computerSnake ? createReplaySnapshot(performance.now(), true) : null,
        overlayClassName: overlay.className,
        overlayTitleHidden: overlayTitle.hidden,
        overlayTextHidden: overlayText.hidden,
        startButtonHidden: startButton.hidden,
        computerBattleButtonHidden: computerBattleButton.hidden,
        replayArchiveButtonHidden: replayArchiveButton.hidden,
        introCloseButtonHidden: introCloseButton.hidden,
        title: overlayTitle.textContent,
        text: overlayText.textContent,
        startText: startButton.textContent,
        winnerPortraitHidden: winnerPortrait.hidden,
        winnerPortraitHtml: winnerPortrait.innerHTML,
        characterStageHidden: characterStage.hidden,
        characterStageHtml: characterStage.innerHTML,
        statusText: statusEl.textContent,
        gameOver,
        running,
        paused,
        computerBattleMode,
        playerAutoMode,
        computerBattleManualOverride,
        relayMode,
        playerCharacterId,
        computerCharacterId,
        playerCharacterChoice,
        computerCharacterChoice,
        selectedPortraitOwner,
        introDetailsOpen
      };
    }

    function restoreReplayReturnState(state) {
      if (!state) {
        returnToStartScreen();
        return;
      }
      playerCharacterId = state.playerCharacterId;
      computerCharacterId = state.computerCharacterId;
      playerCharacterChoice = state.playerCharacterChoice;
      computerCharacterChoice = state.computerCharacterChoice;
      selectedPortraitOwner = state.selectedPortraitOwner;
      introDetailsOpen = state.introDetailsOpen;
      running = state.running;
      paused = state.paused;
      gameOver = state.gameOver;
      computerBattleMode = state.computerBattleMode;
      playerAutoMode = Boolean(state.playerAutoMode);
      computerBattleManualOverride = Boolean(state.computerBattleManualOverride);
      relayMode = state.relayMode;
      if (state.snapshot) applyReplaySnapshot(state.snapshot, state);
      overlay.className = state.overlayClassName;
      overlayTitle.hidden = state.overlayTitleHidden;
      overlayText.hidden = state.overlayTextHidden;
      startButton.hidden = state.startButtonHidden;
      computerBattleButton.hidden = state.computerBattleButtonHidden;
      replayArchiveButton.hidden = state.replayArchiveButtonHidden;
      introCloseButton.hidden = state.introCloseButtonHidden;
      overlayTitle.textContent = state.title;
      overlayText.textContent = state.text;
      startButton.textContent = state.startText;
      winnerPortrait.hidden = state.winnerPortraitHidden;
      winnerPortrait.innerHTML = state.winnerPortraitHtml;
      characterStage.hidden = state.characterStageHidden;
      characterStage.innerHTML = state.characterStageHtml;
      setStatus(state.statusText);
      updateHud();
      updateSettingsActionMode();
      updateAutoBattleControls();
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
      replaySpeedMenu.hidden = true;
      replaySpeedSelect.setAttribute("aria-expanded", "false");
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
      cancelAnimationFrame(rafId);
      clearRelayRestartTimer();
      replayReturnState = captureReplayReturnState();
      replayMode = true;
      HexSnakeState.replay.mode = replayMode;
      running = false;
      paused = true;
      gameOver = false;
      computerBattleMode = false;
      playerAutoMode = false;
      computerBattleManualOverride = false;
      updateAutoBattleControls();
      setSettingsLocked(true);
      setOverlayChromeVisible(false);
      overlay.classList.remove("show");
      replayControls.hidden = false;
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
      replayMode = false;
      replayPlayback = null;
      replayPlaylist = [];
      replayPlaylistIndex = -1;
      HexSnakeState.replay.mode = replayMode;
      replayControls.hidden = true;
      replaySpeedMenu.hidden = true;
      replaySpeedSelect.setAttribute("aria-expanded", "false");
      setSettingsLocked(false);
      restoreReplayReturnState(replayReturnState);
      replayReturnState = null;
    }

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
        HexSnakeState.replay.surrendered = replaySurrendered;
      },
      markSurrendered() {
        replaySurrendered = true;
        HexSnakeState.replay.surrendered = replaySurrendered;
      },
      startRecording: startReplayRecording,
      recordSnapshot: recordReplaySnapshot,
      finishRecording: finishReplayRecording,
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
        localStorage.setItem(replaySpeedKey, String(replayPlayback.speed));
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
