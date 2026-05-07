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

    const aiLookaheadDepth = 3;
    const aiLookaheadBeamWidth = 3;
    const aiLookaheadFutureDiscount = 0.65;

    const baselineHighAiStrategyWeightsByCharacter = {
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
    let highAiStrategyWeightsByCharacter = { ...baselineHighAiStrategyWeightsByCharacter };

    function highAiStrategiesFromData(file) {
      const rows = file?.strategies || file?.bestStrategies || file;
      if (Array.isArray(rows)) {
        return Object.fromEntries(rows
          .filter(row => row?.characterId && row.characterId !== "universal")
          .map(row => [row.characterId, row.strategyWeights || row]));
      }
      if (rows && typeof rows === "object") {
        return Object.fromEntries(Object.entries(rows)
          .filter(([characterId]) => characterId !== "universal")
          .map(([characterId, row]) => [characterId, row?.strategyWeights || row]));
      }
      return {};
    }

    async function loadHighAiStrategyConfig() {
      try {
        const response = await fetch("data/high-ai-strategies.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const nextWeights = highAiStrategiesFromData(await response.json());
        if (!Object.keys(nextWeights).length) throw new Error("No character strategy weights found.");
        highAiStrategyWeightsByCharacter = {
          ...baselineHighAiStrategyWeightsByCharacter,
          ...nextWeights
        };
      } catch (error) {
        console.warn(`Using built-in high AI strategies: ${error.message}`);
      }
    }
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
      const foodMultiplier = profile === "small" ? 1 : foodTypes.length;
      return attackFoodCost(profile) * foodMultiplier + attackBombCost(profile) * foodTypes.length;
    }

    function opponentAlmostReady(owner) {
      const opponent = opponentOf(owner);
      const stock = ownerStock(opponent);
      if (canAttack(opponent, "small") || canAttack(opponent, "big")) return true;
      const highestType = highestStockFoodType(stock);
      const stockClose = highestType && (stock[highestType.id] || 0) >= Math.max(0, attackFoodCost("small") - 1);
      const ammoClose = ammoFor(opponent) >= attackBombCost("small") || ammoChargeFor(opponent) >= attackNeedTotal - 1;
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

    function attackExpectedValue(owner, profile, target, targetWeight, now, damageOverride = null) {
      const opponent = opponentOf(owner);
      const stats = attackStats(ownerStock(owner), profile);
      const targetSnake = perceivedSnakeFor(owner, opponent, now);
      const damage = damageOverride ?? attackTargetDamage(targetSnake, target, stats.radius, stats.damage);
      const cappedDamage = Math.min(damage, ownerHp(opponent));
      const overkill = Math.max(0, damage - ownerHp(opponent));
      const allocation = aiStrategyWeightsFor(owner).skillAllocation;
      const allocationScore = profile === "small" ? allocation.preferSmall : allocation.preferBig;
      const resourcePenalty = attackResourceCost(profile) * (profile === "big" ? 0.34 : 0.24);
      const controlValue = attackStunChance(ownerStock(owner)) * 1.4 + (hasOpponentDebuff(owner, now) ? 0.75 : 0);
      return cappedDamage * 1.15
        + targetWeight * 0.6
        + castTimingScore(owner, profile, now)
        + allocationScore
        + controlValue
        + (damage > 0 ? 0.6 : -2.5)
        - resourcePenalty
        - overkill * 0.35;
    }

    function highAttackTargetRows(owner, profile, now) {
      const opponent = opponentOf(owner);
      const targetSnake = perceivedSnakeFor(owner, opponent, now);
      const targetHead = targetSnake[0];
      const stats = attackStats(ownerStock(owner), profile);
      const maxDamageTarget = bestBodyClusterTarget(targetSnake, stats) || targetHead;
      const weights = aiStrategyWeightsFor(owner).castTarget;
      const nearestFood = nearestFoodFor(targetHead);
      const seen = new Set();
      return [
        { target: targetHead, weight: weights.targetHead },
        { target: maxDamageTarget, weight: weights.bodyCluster },
        { target: nearestFood || targetHead, weight: nearestFood ? weights.targetNearestFood : 0 }
      ]
        .filter(item => item.target && !seen.has(keyOf(item.target)) && seen.add(keyOf(item.target)))
        .map(item => {
          const damage = attackTargetDamage(targetSnake, item.target, stats.radius, stats.damage);
          return {
            target: item.target,
            weight: item.weight,
            damage,
            expectedValue: attackExpectedValue(owner, profile, item.target, item.weight, now, damage)
          };
        })
        .map(row => ({
          ...row,
          targetScore: row.expectedValue + row.damage * 1.1 + row.weight * 1.2 + (row.damage <= 0 ? row.weight * 5 : 0)
        }))
        .sort((a, b) => {
          if (a.targetScore !== b.targetScore) return b.targetScore - a.targetScore;
          if (a.damage !== b.damage) return b.damage - a.damage;
          return wrappedDistance(targetHead, a.target) - wrappedDistance(targetHead, b.target);
        });
    }

    function attackProfileThreshold(profile) {
      return profile === "big" ? 4.2 : 4.5;
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
        const scored = available.map(profile => {
          const bestTarget = highAttackTargetRows(owner, profile, now)[0];
          const legacyBoost = profile === "big" && shouldUseBigAttack(owner, now) ? 1.25 : 0;
          return { profile, score: (bestTarget?.expectedValue ?? -Infinity) + legacyBoost };
        }).sort((a, b) => b.score - a.score);
        const accepted = scored.find(row => row.score >= attackProfileThreshold(row.profile));
        return accepted ? accepted.profile : null;
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
      const seen = new Set();
      const candidates = targetSnake.flatMap(segment => cellsWithinDistance(segment, 0, Math.max(1, Math.ceil(stats.radius))))
        .filter(cell => {
          const key = keyOf(cell);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      return (candidates.length ? candidates : cells).sort((a, b) => {
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
        const best = highAttackTargetRows(owner, profile, now)[0];
        return { ...(best?.target || targetHead) };
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

    function canTurnForSnake(snakeParts, currentDirection, nextDirection) {
      return snakeParts.length < 2 || (nextDirection + 3) % directions.length !== currentDirection;
    }

    function movementOccupiedSetForSnake(owner, opponent, snakeParts, now) {
      const opponentSnake = perceivedSnakeFor(owner, opponent, now);
      const occupied = new Set(snakeParts.slice(0, -1).map(keyOf));
      if (!isOwnerUnderground(opponent, now)) opponentSnake.forEach(segment => occupied.add(keyOf(segment)));
      return occupied;
    }

    function movementOptionForState(owner, opponent, snakeParts, currentDirection, candidate, target, occupied, opponentSnake, opponentThreat, now, distanceToTarget = cell => wrappedDistance(cell, target)) {
      const next = nextWrappedCell(snakeParts[0], candidate);
      const nextKey = keyOf(next);
      const selfBlocked = snakeParts.slice(0, -1).some(segment => keyOf(segment) === nextKey);
      const opponentBlocked = opponentSnake.some(segment => keyOf(segment) === nextKey);
      const blocked = selfBlocked || opponentBlocked || occupied.has(nextKey);
      const headThreat = keyOf(opponentThreat) === nextKey;
      const danger = headThreat ? 20 : 0;
      const wallPressure = cells.filter(cell => hexDistance(cell, next) <= 1 && !occupied.has(keyOf(cell))).length;
      const pathDistance = shortestFoodDistance(next, occupied);
      const targetDistance = distanceToTarget(next);
      const expectedDamage = expectedDamageAt(owner, next, now);
      const reachable = reachableSpace(next, occupied, 10);
      const trapRisk = Math.max(0, 5 - reachable);
      const deadEnd = reachableSpace(next, occupied, deadEndMinSpace) < deadEndMinSpace;
      const lethalThreat = expectedDamage >= ownerHp(owner);
      const weights = aiStrategyWeightsFor(owner).movement;
      const risk = (blocked ? 100 : 0) + danger + trapRisk * 4 + expectedDamage;
      return {
        direction: candidate,
        next,
        blocked,
        headThreat,
        deadEnd,
        lethalThreat,
        pathValue: Number.isFinite(pathDistance) ? pathDistance : nearestFoodDistance(next),
        risk,
        tacticalValue: computerDifficulty === "high"
          ? weights.fastestArrival * targetDistance + weights.safePath * risk + weights.leastDamage * expectedDamage - wallPressure * 0.04
          : (Number.isFinite(pathDistance) ? pathDistance : nearestFoodDistance(next)) + targetDistance * 0.45 + danger - wallPressure * 0.08,
        fallbackValue: nearestFoodDistance(next) + targetDistance * 0.45 + danger - wallPressure * 0.08
      };
    }

    function movementHardPenalty(option) {
      return (option.blocked ? 120 : 0)
        + (option.headThreat ? 80 : 0)
        + (option.lethalThreat ? 120 : 0)
        + (option.deadEnd ? 60 : 0);
    }

    function movementFoodKeySet() {
      return new Set(foods.map(keyOf));
    }

    function advanceMovementSnake(snakeParts, option, foodKeys) {
      const nextFoodKeys = new Set(foodKeys);
      const nextSnake = [option.next, ...snakeParts];
      if (nextFoodKeys.has(keyOf(option.next))) {
        nextFoodKeys.delete(keyOf(option.next));
      } else {
        nextSnake.pop();
      }
      return { snake: nextSnake, foodKeys: nextFoodKeys };
    }

    function terminalMobilityPenalty(owner, opponent, snakeParts, currentDirection, target, opponentSnake, opponentThreat, now, distanceToTarget) {
      const occupied = movementOccupiedSetForSnake(owner, opponent, snakeParts, now);
      const options = directions
        .map((_, candidate) => {
          if (!canTurnForSnake(snakeParts, currentDirection, candidate)) return null;
          return movementOptionForState(owner, opponent, snakeParts, currentDirection, candidate, target, occupied, opponentSnake, opponentThreat, now, distanceToTarget);
        })
        .filter(Boolean);
      if (!options.length) return 1200;
      const hardSafe = options.filter(option => !option.blocked && !option.headThreat && !option.deadEnd && !option.lethalThreat);
      if (!hardSafe.length) return 1000;
      if (hardSafe.length === 1) return 36;
      return 0;
    }

    function lookaheadMovementScore(owner, opponent, firstOption, target, opponentSnake, opponentThreat, now, distanceToTarget) {
      const firstStep = advanceMovementSnake(ownerSnake(owner), firstOption, movementFoodKeySet());
      let beam = [{
        snake: firstStep.snake,
        direction: firstOption.direction,
        foodKeys: firstStep.foodKeys,
        score: firstOption.tacticalValue + movementHardPenalty(firstOption),
        discount: aiLookaheadFutureDiscount
      }];

      for (let depth = 1; depth < aiLookaheadDepth; depth += 1) {
        const expanded = [];
        beam.forEach(row => {
          const occupied = movementOccupiedSetForSnake(owner, opponent, row.snake, now);
          directions.forEach((_, candidate) => {
            if (!canTurnForSnake(row.snake, row.direction, candidate)) return;
            const option = movementOptionForState(owner, opponent, row.snake, row.direction, candidate, target, occupied, opponentSnake, opponentThreat, now, distanceToTarget);
            const nextStep = advanceMovementSnake(row.snake, option, row.foodKeys);
            expanded.push({
              snake: nextStep.snake,
              direction: option.direction,
              foodKeys: nextStep.foodKeys,
              score: row.score + row.discount * (option.tacticalValue + movementHardPenalty(option)),
              discount: row.discount * aiLookaheadFutureDiscount
            });
          });
        });
        if (!expanded.length) return beam[0].score + beam[0].discount * 1200;
        expanded.sort((a, b) => a.score - b.score);
        beam = expanded.slice(0, aiLookaheadBeamWidth);
      }

      return Math.min(...beam.map(row => (
        row.score + row.discount * terminalMobilityPenalty(owner, opponent, row.snake, row.direction, target, opponentSnake, opponentThreat, now, distanceToTarget)
      )));
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
      const targetDistanceCache = new Map();
      const distanceToTarget = cell => {
        const key = keyOf(cell);
        if (!targetDistanceCache.has(key)) targetDistanceCache.set(key, wrappedDistance(cell, target));
        return targetDistanceCache.get(key);
      };
      const options = [];

      directions.forEach((_, candidate) => {
        if (!canOwnerTurn(owner, candidate)) return;
        options.push(movementOptionForState(owner, opponent, ownSnake, currentDirection, candidate, target, occupied, opponentSnake, opponentThreat, now, distanceToTarget));
      });

      if (!options.length) return currentDirection;

      const hardSafe = options.filter(option => !option.blocked && !option.headThreat && !option.deadEnd && !option.lethalThreat);
      const rankedOptions = hardSafe.length ? hardSafe : options.filter(option => !option.blocked && !option.headThreat && !option.lethalThreat);
      const sortableOptions = rankedOptions.length ? rankedOptions : options;
      if (computerDifficulty === "high" && sortableOptions.length > 1) {
        sortableOptions.forEach(option => {
          option.lookaheadValue = lookaheadMovementScore(owner, opponent, option, target, opponentSnake, opponentThreat, now, distanceToTarget);
        });
      }
      sortableOptions.sort((a, b) => {
        if (computerDifficulty === "high") return (a.lookaheadValue ?? a.tacticalValue) - (b.lookaheadValue ?? b.tacticalValue) || a.tacticalValue - b.tacticalValue;
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
