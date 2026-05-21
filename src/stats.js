const HexSnakeStats = (() => {
  const statsKey = "hexSnakeMatchStatsV1";
  const statsVersion = 1;
  const recentLimit = 10;
  const characterLimit = 8;

  function emptyStats() {
    return {
      version: statsVersion,
      totals: {
        matches: 0,
        playerWins: 0,
        computerWins: 0,
        draws: 0,
        playerScore: 0,
        computerScore: 0,
        totalDurationMs: 0,
        bestPlayerScore: 0
      },
      recent: [],
      characters: {}
    };
  }

  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeRecord(record) {
    if (!record || typeof record !== "object") return null;
    const id = String(record.id || "");
    if (!id) return null;
    return {
      id,
      createdAt: record.createdAt || new Date().toISOString(),
      winnerOwner: record.winnerOwner === "player" || record.winnerOwner === "computer" ? record.winnerOwner : null,
      playerScore: numberOrZero(record.playerScore),
      computerScore: numberOrZero(record.computerScore),
      durationMs: numberOrZero(record.durationMs),
      playerCharacterId: record.playerCharacterId || "",
      computerCharacterId: record.computerCharacterId || "",
      mode: record.mode || "player",
      difficulty: record.difficulty || "",
      surrendered: Boolean(record.surrendered)
    };
  }

  function normalizeCharacterStats(entry = {}) {
    return {
      played: numberOrZero(entry.played),
      wins: numberOrZero(entry.wins),
      losses: numberOrZero(entry.losses),
      draws: numberOrZero(entry.draws),
      score: numberOrZero(entry.score),
      bestScore: numberOrZero(entry.bestScore),
      durationMs: numberOrZero(entry.durationMs),
      lastPlayedAt: entry.lastPlayedAt || ""
    };
  }

  function normalizeStats(value) {
    const stats = emptyStats();
    if (!value || typeof value !== "object") return stats;
    const totals = value.totals || {};
    stats.totals = {
      matches: numberOrZero(totals.matches),
      playerWins: numberOrZero(totals.playerWins),
      computerWins: numberOrZero(totals.computerWins),
      draws: numberOrZero(totals.draws),
      playerScore: numberOrZero(totals.playerScore),
      computerScore: numberOrZero(totals.computerScore),
      totalDurationMs: numberOrZero(totals.totalDurationMs),
      bestPlayerScore: numberOrZero(totals.bestPlayerScore)
    };
    stats.recent = Array.isArray(value.recent)
      ? value.recent.map(normalizeRecord).filter(Boolean).slice(0, recentLimit)
      : [];
    Object.entries(value.characters || {}).forEach(([characterId, entry]) => {
      if (characterId) stats.characters[characterId] = normalizeCharacterStats(entry);
    });
    return stats;
  }

  function loadStats() {
    return normalizeStats(HexSnakeStorage.getJson(statsKey, emptyStats()));
  }

  function saveStats(stats) {
    HexSnakeStorage.setJson(statsKey, normalizeStats(stats));
  }

  function saveStatsSafely(stats) {
    try {
      saveStats(stats);
    } catch (error) {
      console.warn("Unable to save full match stats, pruning recent history.", error);
      stats.recent = stats.recent.slice(0, 3);
      try {
        saveStats(stats);
      } catch (retryError) {
        console.warn("Unable to save match stats.", retryError);
      }
    }
  }

  function characterName(characterId) {
    return HexSnakeUI.characterForId(characterId)?.name || characterId || "未選擇";
  }

  function modeLabel(mode) {
    if (mode === "relay") return "接力賽";
    if (mode === "autoBattle") return "自動對弈";
    if (mode === "playerAuto") return "P1 Auto";
    return "P1 戰鬥";
  }

  function winnerLabel(winnerOwner) {
    if (winnerOwner === "player") return "P1 勝";
    if (winnerOwner === "computer") return "P2 勝";
    return "平手";
  }

  function formatPercent(part, total) {
    if (!total) return "0%";
    return `${Math.round((part / total) * 100)}%`;
  }

  function formatDate(value) {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function recordMatch(match) {
    const createdAt = new Date().toISOString();
    const record = normalizeRecord({
      id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      ...match
    });
    if (!record) return;

    const stats = loadStats();
    stats.totals.matches += 1;
    stats.totals.playerScore += record.playerScore;
    stats.totals.computerScore += record.computerScore;
    stats.totals.totalDurationMs += record.durationMs;
    stats.totals.bestPlayerScore = Math.max(stats.totals.bestPlayerScore, record.playerScore);
    if (record.winnerOwner === "player") stats.totals.playerWins += 1;
    else if (record.winnerOwner === "computer") stats.totals.computerWins += 1;
    else stats.totals.draws += 1;

    stats.recent.unshift(record);
    stats.recent = stats.recent.slice(0, recentLimit);

    if (record.playerCharacterId) {
      const row = stats.characters[record.playerCharacterId] || normalizeCharacterStats();
      row.played += 1;
      row.score += record.playerScore;
      row.bestScore = Math.max(row.bestScore, record.playerScore);
      row.durationMs += record.durationMs;
      row.lastPlayedAt = record.createdAt;
      if (record.winnerOwner === "player") row.wins += 1;
      else if (record.winnerOwner === "computer") row.losses += 1;
      else row.draws += 1;
      stats.characters[record.playerCharacterId] = row;
    }

    saveStatsSafely(stats);
  }

  function renderSummary(stats) {
    HexSnakeDOM.statsSummary.innerHTML = "";
    const totals = stats.totals;
    [
      ["對戰", totals.matches, "statsTotalMatches"],
      ["P1 勝率", formatPercent(totals.playerWins, totals.matches), "statsWinRate"],
      ["最佳分數", totals.bestPlayerScore, "statsBestScore"],
      ["總時長", HexSnakeUI.formatTime(totals.totalDurationMs), "statsTotalDuration"]
    ].forEach(([label, value, id]) => {
      const card = document.createElement("div");
      card.className = "app-stats-card";
      const valueEl = document.createElement("strong");
      valueEl.id = id;
      valueEl.textContent = String(value);
      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      card.append(valueEl, labelEl);
      HexSnakeDOM.statsSummary.append(card);
    });
  }

  function renderRecent(stats) {
    HexSnakeDOM.statsRecentList.innerHTML = "";
    HexSnakeDOM.statsRecentCount.textContent = `${stats.recent.length} / ${recentLimit}`;
    if (!stats.recent.length) {
      const empty = document.createElement("div");
      empty.className = "replay-empty";
      empty.textContent = "還沒有戰績，完成一場後會出現在這裡。";
      HexSnakeDOM.statsRecentList.append(empty);
      return;
    }

    stats.recent.forEach(record => {
      const row = document.createElement("div");
      row.className = "replay-row app-stats-row";
      row.dataset.statsRecordId = record.id;

      const details = document.createElement("div");
      const title = document.createElement("span");
      title.className = "replay-title";
      title.textContent = `${formatDate(record.createdAt)} ${winnerLabel(record.winnerOwner)} ${record.playerScore}:${record.computerScore}`;
      const meta = document.createElement("div");
      meta.className = "replay-meta";
      meta.textContent = `${modeLabel(record.mode)} · ${characterName(record.playerCharacterId)} vs ${characterName(record.computerCharacterId)} · ${HexSnakeUI.formatTime(record.durationMs)}${record.surrendered ? " · 投降" : ""}`;
      details.append(title, meta);

      const badge = document.createElement("span");
      badge.className = `app-stats-badge ${record.winnerOwner === "player" ? "is-win" : record.winnerOwner === "computer" ? "is-loss" : "is-draw"}`;
      badge.textContent = winnerLabel(record.winnerOwner);
      row.append(details, badge);
      HexSnakeDOM.statsRecentList.append(row);
    });
  }

  function characterRows(stats) {
    return Object.entries(stats.characters)
      .map(([characterId, entry]) => ({ characterId, ...normalizeCharacterStats(entry) }))
      .sort((left, right) => {
        if (right.played !== left.played) return right.played - left.played;
        if (right.wins !== left.wins) return right.wins - left.wins;
        return String(right.lastPlayedAt).localeCompare(String(left.lastPlayedAt));
      })
      .slice(0, characterLimit);
  }

  function renderCharacterMastery(stats) {
    const rows = characterRows(stats);
    HexSnakeDOM.statsCharacterList.innerHTML = "";
    HexSnakeDOM.statsCharacterCount.textContent = `${rows.length}`;
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "replay-empty";
      empty.textContent = "P1 使用角色完成對戰後會累積熟練度。";
      HexSnakeDOM.statsCharacterList.append(empty);
      return;
    }

    rows.forEach(row => {
      const item = document.createElement("div");
      item.className = "replay-row app-stats-row";
      item.dataset.statsCharacterId = row.characterId;

      const details = document.createElement("div");
      const title = document.createElement("span");
      title.className = "replay-title";
      title.textContent = characterName(row.characterId);
      const meta = document.createElement("div");
      meta.className = "replay-meta";
      meta.textContent = `${row.played} 場 · ${row.wins} 勝 ${row.losses} 敗 ${row.draws} 平 · 最高 ${row.bestScore} · ${HexSnakeUI.formatTime(row.durationMs)}`;
      details.append(title, meta);

      const badge = document.createElement("span");
      badge.className = "app-stats-badge";
      badge.textContent = formatPercent(row.wins, row.played);
      item.append(details, badge);
      HexSnakeDOM.statsCharacterList.append(item);
    });
  }

  function refreshModal() {
    const stats = loadStats();
    renderSummary(stats);
    renderRecent(stats);
    renderCharacterMastery(stats);
  }

  function openModal() {
    if (HexSnakeState.game.running && !HexSnakeState.game.gameOver) return;
    HexSnakeUI.clearRelayRestartTimer();
    refreshModal();
    HexSnakeDOM.statsModal.hidden = false;
  }

  function closeModal() {
    HexSnakeDOM.statsModal.hidden = true;
  }

  function clearStats() {
    HexSnakeStorage.remove(statsKey);
    refreshModal();
  }

  return Object.freeze({
    recordMatch,
    openModal,
    closeModal,
    clear: clearStats,
    refresh: refreshModal
  });
})();

Object.defineProperties(HexSnakeUI.stats, Object.getOwnPropertyDescriptors(HexSnakeStats));
