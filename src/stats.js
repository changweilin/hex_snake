const StatsRuntime = HexSnakeRuntime;
const StatsStorage = StatsRuntime.storage;
const StatsRootState = HexSnakeState;
const StatsGameState = StatsRootState.game;
const StatsUI = HexSnakeUI;
const StatsDom = HexSnakeDOM;

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

  function normalizeSkillCounts(value = {}) {
    return {
      small: numberOrZero(value.small),
      big: numberOrZero(value.big)
    };
  }

  function normalizeOwnerHighlights(value = {}) {
    return {
      casts: normalizeSkillCounts(value.casts),
      hits: normalizeSkillCounts(value.hits),
      damageDealt: numberOrZero(value.damageDealt),
      resourcesSpent: numberOrZero(value.resourcesSpent),
      highestDamage: numberOrZero(value.highestDamage),
      keyKills: numberOrZero(value.keyKills)
    };
  }

  function normalizeDamageEvent(value = {}) {
    if (!value || typeof value !== "object") return null;
    const amount = numberOrZero(value.amount);
    if (amount <= 0) return null;
    return {
      owner: value.owner === "player" || value.owner === "computer" ? value.owner : null,
      target: value.target === "player" || value.target === "computer" ? value.target : null,
      profile: value.profile === "small" ? "small" : "big",
      amount,
      atMs: numberOrZero(value.atMs)
    };
  }

  function normalizeHighlights(value = {}) {
    return {
      player: normalizeOwnerHighlights(value.player),
      computer: normalizeOwnerHighlights(value.computer),
      highestDamage: normalizeDamageEvent(value.highestDamage),
      keyKill: normalizeDamageEvent(value.keyKill)
    };
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
      surrendered: Boolean(record.surrendered),
      highlights: normalizeHighlights(record.highlights)
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
      skillCasts: normalizeSkillCounts(entry.skillCasts),
      skillHits: normalizeSkillCounts(entry.skillHits),
      damageDealt: numberOrZero(entry.damageDealt),
      resourcesSpent: numberOrZero(entry.resourcesSpent),
      highestDamage: numberOrZero(entry.highestDamage),
      keyKills: numberOrZero(entry.keyKills),
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
    return normalizeStats(StatsStorage.getJson(statsKey, emptyStats()));
  }

  function saveStats(stats) {
    StatsStorage.setJson(statsKey, normalizeStats(stats));
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
    return StatsUI.characterForId(characterId)?.name || characterId || "未選擇";
  }

  function modeLabel(mode) {
    if (mode === "relay") return "接力賽";
    if (mode === "autoBattle") return "自動對弈";
    if (mode === "playerAuto") return "P1 Auto";
    if (mode === "training") return "技能訓練";
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

  function skillTotal(counts = {}) {
    return numberOrZero(counts.small) + numberOrZero(counts.big);
  }

  function resourceEfficiency(value = {}) {
    const spent = numberOrZero(value.resourcesSpent);
    if (spent <= 0) return 0;
    return numberOrZero(value.damageDealt) / spent;
  }

  function formatDecimal(value, digits = 1) {
    if (!Number.isFinite(value)) return "0";
    const rounded = Number(value.toFixed(digits));
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  function masteryLevel(row) {
    return Math.max(
      1,
      Math.min(
        30,
        1
          + Math.floor(row.played / 2)
          + Math.floor(row.wins / 2)
          + Math.floor(skillTotal(row.skillHits) / 4)
          + Math.floor(row.keyKills / 2)
      )
    );
  }

  function achievementBadges(row) {
    const efficiency = resourceEfficiency(row);
    return [
      { label: "首勝", unlocked: row.wins >= 1 },
      { label: "熟手", unlocked: row.played >= 5 },
      { label: "小招命中", unlocked: row.skillHits.small >= 5 },
      { label: "大招命中", unlocked: row.skillHits.big >= 3 },
      { label: "高傷害", unlocked: row.highestDamage >= 24 },
      { label: "關鍵擊殺", unlocked: row.keyKills >= 1 },
      { label: "資源效率", unlocked: efficiency >= 1.2 && row.damageDealt >= 30 }
    ].filter(badge => badge.unlocked);
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
      const playerHighlights = record.highlights.player;
      row.played += 1;
      row.score += record.playerScore;
      row.bestScore = Math.max(row.bestScore, record.playerScore);
      row.durationMs += record.durationMs;
      row.skillCasts.small += playerHighlights.casts.small;
      row.skillCasts.big += playerHighlights.casts.big;
      row.skillHits.small += playerHighlights.hits.small;
      row.skillHits.big += playerHighlights.hits.big;
      row.damageDealt += playerHighlights.damageDealt;
      row.resourcesSpent += playerHighlights.resourcesSpent;
      row.highestDamage = Math.max(
        row.highestDamage,
        playerHighlights.highestDamage,
        record.highlights.highestDamage?.owner === "player" ? record.highlights.highestDamage.amount : 0
      );
      row.keyKills += playerHighlights.keyKills;
      row.lastPlayedAt = record.createdAt;
      if (record.winnerOwner === "player") row.wins += 1;
      else if (record.winnerOwner === "computer") row.losses += 1;
      else row.draws += 1;
      stats.characters[record.playerCharacterId] = row;
    }

    saveStatsSafely(stats);
  }

  function renderSummary(stats) {
    StatsDom.statsSummary.innerHTML = "";
    const totals = stats.totals;
    [
      ["對戰", totals.matches, "statsTotalMatches"],
      ["P1 勝率", formatPercent(totals.playerWins, totals.matches), "statsWinRate"],
      ["最佳分數", totals.bestPlayerScore, "statsBestScore"],
      ["總時長", StatsUI.formatTime(totals.totalDurationMs), "statsTotalDuration"]
    ].forEach(([label, value, id]) => {
      const card = document.createElement("div");
      card.className = "app-stats-card";
      const valueEl = document.createElement("strong");
      valueEl.id = id;
      valueEl.textContent = String(value);
      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      card.append(valueEl, labelEl);
      StatsDom.statsSummary.append(card);
    });
  }

  function renderRecent(stats) {
    StatsDom.statsRecentList.innerHTML = "";
    StatsDom.statsRecentCount.textContent = `${stats.recent.length} / ${recentLimit}`;
    if (!stats.recent.length) {
      const empty = document.createElement("div");
      empty.className = "replay-empty";
      empty.textContent = "還沒有戰績，完成一場後會出現在這裡。";
      StatsDom.statsRecentList.append(empty);
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
      meta.textContent = `${modeLabel(record.mode)} · ${characterName(record.playerCharacterId)} vs ${characterName(record.computerCharacterId)} · ${StatsUI.formatTime(record.durationMs)}${record.surrendered ? " · 投降" : ""}`;
      details.append(title, meta);
      const playerHighlights = record.highlights.player;
      const castTotal = skillTotal(playerHighlights.casts);
      const hitTotal = skillTotal(playerHighlights.hits);
      const highlightParts = [];
      if (castTotal || hitTotal) highlightParts.push(`技能命中 ${hitTotal}/${Math.max(castTotal, hitTotal)}`);
      if (record.highlights.highestDamage?.amount) highlightParts.push(`最高傷害 ${formatDecimal(record.highlights.highestDamage.amount)}`);
      if (record.highlights.keyKill?.owner) highlightParts.push("關鍵擊殺");
      if (playerHighlights.resourcesSpent > 0) highlightParts.push(`資源效率 ${formatDecimal(resourceEfficiency(playerHighlights))}`);
      if (highlightParts.length) {
        const highlights = document.createElement("div");
        highlights.className = "app-stats-highlight";
        highlights.textContent = highlightParts.join(" · ");
        details.append(highlights);
      }

      const badge = document.createElement("span");
      badge.className = `app-stats-badge ${record.winnerOwner === "player" ? "is-win" : record.winnerOwner === "computer" ? "is-loss" : "is-draw"}`;
      badge.textContent = winnerLabel(record.winnerOwner);
      row.append(details, badge);
      StatsDom.statsRecentList.append(row);
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
    StatsDom.statsCharacterList.innerHTML = "";
    StatsDom.statsCharacterCount.textContent = `${rows.length}`;
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "replay-empty";
      empty.textContent = "P1 使用角色完成對戰後會累積熟練度。";
      StatsDom.statsCharacterList.append(empty);
      return;
    }

    rows.forEach(row => {
      const item = document.createElement("div");
      item.className = "replay-row app-stats-row";
      item.dataset.statsCharacterId = row.characterId;

      const details = document.createElement("div");
      const title = document.createElement("span");
      title.className = "replay-title";
      title.textContent = `${characterName(row.characterId)} · Lv.${masteryLevel(row)}`;
      const meta = document.createElement("div");
      meta.className = "replay-meta";
      meta.textContent = `${row.played} 場 · ${row.wins} 勝 ${row.losses} 敗 ${row.draws} 平 · 命中 ${skillTotal(row.skillHits)}/${Math.max(1, skillTotal(row.skillCasts))} · 最高傷害 ${formatDecimal(row.highestDamage)} · 資源效率 ${formatDecimal(resourceEfficiency(row))}`;
      const badges = document.createElement("div");
      badges.className = "achievement-badges";
      achievementBadges(row).forEach(badgeInfo => {
        const badgeEl = document.createElement("span");
        badgeEl.className = "achievement-badge";
        badgeEl.textContent = badgeInfo.label;
        badges.append(badgeEl);
      });
      if (!badges.children.length) {
        const badgeEl = document.createElement("span");
        badgeEl.className = "achievement-badge is-locked";
        badgeEl.textContent = "尚未解鎖徽章";
        badges.append(badgeEl);
      }
      details.append(title, meta, badges);

      const badge = document.createElement("span");
      badge.className = "app-stats-badge";
      badge.textContent = formatPercent(row.wins, row.played);
      item.append(details, badge);
      StatsDom.statsCharacterList.append(item);
    });
  }

  function refreshModal() {
    const stats = loadStats();
    renderSummary(stats);
    renderRecent(stats);
    renderCharacterMastery(stats);
  }

  function openModal(tab = "recent") {
    if (StatsGameState.running && !StatsGameState.gameOver) return;
    StatsUI.clearRelayRestartTimer();
    if (typeof StatsUI.replay.openModal === "function") {
      StatsUI.replay.openModal(tab);
      return;
    }
    refreshModal();
    StatsDom.statsModal.hidden = false;
  }

  function closeModal() {
    if (typeof StatsUI.replay.closeModal === "function") {
      StatsUI.replay.closeModal();
      return;
    }
    StatsDom.statsModal.hidden = true;
  }

  function clearStats() {
    StatsStorage.remove(statsKey);
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

Object.defineProperties(StatsUI.stats, Object.getOwnPropertyDescriptors(HexSnakeStats));

export {
  HexSnakeStats,
  HexSnakeStats as stats
};
