    const RenderConfig = HexSnakeState.config;
    const RenderDom = HexSnakeDOM;
    const RenderState = HexSnakeState.game;
    const RenderUI = HexSnakeUI;
    const RenderAI = HexSnakeAI;

    function comparisonLoop(now) {
      if (HexSnakePlatform.lifecycle.isPaused()) {
        RenderState.rafId = 0;
        return;
      }
      const frameStats = HexSnakePlatform.display.recordFrame(now || performance.now());
      if (typeof HexSnakeGame.updatePerfOverlay === "function") HexSnakeGame.updatePerfOverlay(frameStats);
      drawEffectComparisonBoard(now);
      RenderState.rafId = requestAnimationFrame(comparisonLoop);
    }

    function draw() {
      if (isEffectComparisonMode()) {
        drawEffectComparisonBoard(performance.now());
        return;
      }
      const now = performance.now();
      const rect = RenderDom.playArea.getBoundingClientRect();
      RenderDom.ctx.clearRect(0, 0, rect.width, rect.height);
      RenderDom.ctx.fillStyle = "#111720";
      RenderDom.ctx.fillRect(0, 0, rect.width, rect.height);
      const shake = boardShakeOffset(now);
      RenderDom.ctx.save();
      RenderDom.ctx.translate(shake.x, shake.y);
      drawElementalBackdrop(now);

      RenderState.cells.forEach(cell => {
        const { x, y } = HexSnakeGame.axialToPixel(cell);
        const shade = (cell.q - cell.r + radius) % 2 === 0 ? RenderConfig.colors.cell : RenderConfig.colors.cellAlt;
        HexSnakeGame.hexPath(x, y, RenderState.cellSize * 0.94);
        RenderDom.ctx.fillStyle = shade;
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = RenderConfig.colors.cellLine;
        RenderDom.ctx.lineWidth = 1;
        RenderDom.ctx.stroke();
      });

      RenderState.foods.forEach(food => {
        const type = RenderUI.foodTypeIds(food).map(typeId => RenderConfig.foodTypeById.get(typeId)).filter(Boolean);
        const { x, y } = HexSnakeGame.axialToPixel(food);
        drawFoodToken(x, y, type);
      });

      drawProjectiles();
      drawDirectionalAttackPreview(now);
      drawTarget();
      drawHazards();
      drawQuetzalBloomPreview(now);
      drawBlasts();

      if (RenderState.computerSnake) {
        const computerCharacter = RenderUI.characterFor("computer");
        drawSnake(RenderState.computerSnake, {
          head: computerCharacter.color,
          body: computerCharacter.body,
          headLine: computerCharacter.line,
          bodyLine: RenderConfig.colors.computerBodyLine,
          ownerColor: RenderConfig.colors.computerHead,
          ownerLine: RenderConfig.colors.computerHeadLine,
          character: computerCharacter,
          owner: "computer",
          direction: RenderState.computerDir,
          alpha: HexSnakeGame.sandwormUndergroundAlpha("computer", now)
        });
      }

      if (RenderState.snake) {
        const playerCharacter = RenderUI.characterFor("player");
        drawSnake(RenderState.snake, {
          head: playerCharacter.color,
          body: playerCharacter.body,
          headLine: playerCharacter.line,
          bodyLine: RenderConfig.colors.bodyLine,
          ownerColor: RenderConfig.colors.head,
          ownerLine: RenderConfig.colors.headLine,
          character: playerCharacter,
          owner: "player",
          direction: RenderState.dir,
          alpha: HexSnakeGame.sandwormUndergroundAlpha("player", now)
        });
      }

      drawStatusEffects(now);
      RenderDom.ctx.restore();
    }

    function waveValue(progress, offset = 0) {
      return (Math.sin((progress + offset) * Math.PI * 2) + 1) / 2;
    }

    function triggerBoardShake(visualType = "", now = performance.now(), options = {}) {
      const isSmallHit = options?.profile === "smallHit" || options === "smallHit";
      if (!isSmallHit && !visualType.endsWith("-big") && !visualType.endsWith("-burst")) return;
      const characterId = visualType.split("-")[0];
      if (isSmallHit) {
        const preset = { strength: 2.1, duration: 155, frequency: 2.6, style: "impact" };
        if (now < RenderState.boardShakeUntil && RenderState.boardShakeStrength > preset.strength) return;
        RenderState.boardShakeStartedAt = now;
        RenderState.boardShakeUntil = Math.max(RenderState.boardShakeUntil, now + preset.duration);
        RenderState.boardShakeStrength = Math.max(RenderState.boardShakeStrength, preset.strength);
        RenderState.boardShakeFrequency = preset.frequency;
        RenderState.boardShakeStyle = preset.style;
        return;
      }
      const presets = {
        dragon: { strength: visualType.endsWith("-burst") ? 9.6 : 6.2, duration: visualType.endsWith("-burst") ? 760 : 520, frequency: 1.2, style: "impact" },
        moray: { strength: 5.8, duration: 700, frequency: 5.6, style: "electric" },
        lobster: { strength: 10.8, duration: 860, frequency: 1.05, style: "impact" },
        gu_king: { strength: 6.2, duration: 860, frequency: 2.8, style: "vortex" },
        sandworm: { strength: 8.8, duration: 820, frequency: 1.55, style: "rumble" },
        quetzal: { strength: 5.4, duration: 820, frequency: 1.8, style: "growth" }
      };
      const preset = presets[characterId] || { strength: 4.6, duration: 520, frequency: 1.4, style: "impact" };
      RenderState.boardShakeStartedAt = now;
      RenderState.boardShakeUntil = Math.max(RenderState.boardShakeUntil, now + preset.duration);
      RenderState.boardShakeStrength = Math.max(RenderState.boardShakeStrength, preset.strength);
      RenderState.boardShakeFrequency = preset.frequency;
      RenderState.boardShakeStyle = preset.style;
    }

    function boardShakeOffset(now) {
      if (now >= RenderState.boardShakeUntil || !RenderState.boardShakeStrength) {
        RenderState.boardShakeStrength = 0;
        return { x: 0, y: 0 };
      }
      const duration = Math.max(1, RenderState.boardShakeUntil - RenderState.boardShakeStartedAt);
      const progress = Math.min(1, Math.max(0, (now - RenderState.boardShakeStartedAt) / duration));
      const decay = Math.pow(1 - progress, RenderState.boardShakeStyle === "electric" ? 0.62 : 1.15);
      const t = now / 34 * RenderState.boardShakeFrequency;
      if (RenderState.boardShakeStyle === "electric") {
        return {
          x: Math.sin(t * 3.1) * RenderState.boardShakeStrength * decay,
          y: Math.sign(Math.sin(t * 7.3)) * RenderState.boardShakeStrength * 0.42 * decay
        };
      }
      if (RenderState.boardShakeStyle === "vortex") {
        return {
          x: Math.cos(t * 1.7 + progress * Math.PI * 4) * RenderState.boardShakeStrength * decay,
          y: Math.sin(t * 1.3 + progress * Math.PI * 4) * RenderState.boardShakeStrength * 0.74 * decay
        };
      }
      if (RenderState.boardShakeStyle === "growth") {
        return {
          x: Math.sin(t * 1.4) * RenderState.boardShakeStrength * 0.44 * decay,
          y: -Math.abs(Math.cos(t * 1.8)) * RenderState.boardShakeStrength * decay
        };
      }
      return {
        x: Math.sin(t * 2.4) * RenderState.boardShakeStrength * decay,
        y: Math.cos(t * 1.7) * RenderState.boardShakeStrength * 0.72 * decay
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
      const mobileScale = RenderDom.mobileInputQuery.matches ? 0.72 : 1;
      const boardScale = RenderState.cells.length > 240 ? 0.82 : 1;
      return mobileScale * boardScale * HexSnakePlatform.display.visualLoadScale();
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
      if (RenderState.elementalSpriteCache.has(key)) return RenderState.elementalSpriteCache.get(key);
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
      RenderState.elementalSpriteCache.set(key, sprite);
      return sprite;
    }

    function drawElementSprite(x, y, size, angle, character, motif, alpha = 1, blend = "lighter") {
      const sprite = createElementalSprite(character, motif);
      RenderDom.ctx.save();
      RenderDom.ctx.globalAlpha *= alpha;
      RenderDom.ctx.globalCompositeOperation = blend;
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      RenderDom.ctx.restore();
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
        const base = HexSnakeGame.axialToPixel(cell);
        const jitterRadius = RenderState.cellSize * (options.jitter ?? 0.72);
        const jitterAngle = stableUnitSeed(seed, i, "angle") * Math.PI * 2;
        const drift = (progress - 0.5) * RenderState.cellSize * (options.drift ?? 0.34);
        const x = base.x + Math.cos(jitterAngle) * jitterRadius * stableUnitSeed(seed, i, "jx");
        const y = base.y + Math.sin(jitterAngle) * jitterRadius * stableUnitSeed(seed, i, "jy") - drift;
        const motif = motifs[(i + Math.floor(stableUnitSeed(seed, i, "motif") * motifs.length)) % motifs.length];
        const pulse = 0.76 + waveValue(progress, stableUnitSeed(seed, i, "pulse")) * 0.42;
        const size = RenderState.cellSize * (options.size ?? 0.86) * (0.68 + stableUnitSeed(seed, i, "size") * 0.72) * pulse;
        const fade = options.persistent ? 1 : Math.sin(clamp01(progress) * Math.PI);
        drawElementSprite(x, y, size, jitterAngle + progress * Math.PI * (options.spin ?? 0.7), character, motif, alpha * fade * (0.34 + stableUnitSeed(seed, i, "alpha") * 0.5));
      }
    }

    function drawElementCellTextureWash(cellsForEffect, character, progress, alpha = 1, options = {}) {
      if (!cellsForEffect?.length) return;
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = options.blend || "lighter";
      cellsForEffect.forEach((cell, index) => {
        const { x, y } = HexSnakeGame.axialToPixel(cell);
        const local = (progress + index * 0.037) % 1;
        const radiusPx = RenderState.cellSize * (options.radiusScale ?? 0.96);
        const gradient = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.08, x, y, radiusPx);
        gradient.addColorStop(0, hexToRgba(element.glow, 0.2 * alpha));
        gradient.addColorStop(0.46, hexToRgba(element.primary, 0.15 * alpha));
        gradient.addColorStop(1, hexToRgba(element.deep, 0));
        HexSnakeGame.hexPath(x, y, RenderState.cellSize * 0.96);
        RenderDom.ctx.fillStyle = gradient;
        RenderDom.ctx.fill();
        if (index % 2 === 0) {
          const motif = spriteMotifsFor(character)[HexSnakeGame.stableVariantIndex(cell, index + Math.floor(local * 100), spriteMotifsFor(character).length)];
          const angle = local * Math.PI * 2 + index;
          drawElementSprite(x, y, RenderState.cellSize * 1.24, angle, character, motif, alpha * 0.2, "source-over");
        }
      });
      RenderDom.ctx.restore();
      drawElementTextureParticles(cellsForEffect, character, progress, alpha, options);
    }

    function drawElementCircleTexture(x, y, radiusPx, progress, character, alpha = 1, options = {}) {
      const motifs = spriteMotifsFor(character);
      const maxParticles = Math.max(16, Math.floor((options.maxParticles ?? 120) * visualLoadScale()));
      const count = Math.min(maxParticles, Math.max(16, Math.floor(radiusPx / Math.max(1, RenderState.cellSize) * (options.density ?? 18))));
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      const gradient = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.05, x, y, radiusPx * 1.12);
      gradient.addColorStop(0, hexToRgba(element.hot, 0.14 * alpha));
      gradient.addColorStop(0.45, hexToRgba(element.primary, 0.1 * alpha));
      gradient.addColorStop(1, hexToRgba(element.deep, 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * 1.12, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = gradient;
      RenderDom.ctx.fill();
      RenderDom.ctx.restore();
      for (let i = 0; i < count; i += 1) {
        const seed = options.seed ?? character.id;
        const angle = stableUnitSeed(seed, i, "circle-angle") * Math.PI * 2 + progress * Math.PI * (options.spin ?? 0.9);
        const distance = radiusPx * Math.sqrt(stableUnitSeed(seed, i, "circle-distance")) * (0.18 + 0.92 * clamp01(progress + 0.12));
        const orbit = angle + Math.sin(progress * Math.PI * 2 + i) * 0.22;
        const px = x + Math.cos(orbit) * distance;
        const py = y + Math.sin(orbit) * distance * (options.ellipse ?? 0.82);
        const motif = motifs[i % motifs.length];
        const size = RenderState.cellSize * (options.size ?? 1.05) * (0.72 + stableUnitSeed(seed, i, "circle-size") * 0.88);
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
      if (!RenderUI.characterList().length || !RenderState.cells.length) return;
      const activeCharacters = [RenderUI.characterFor("player"), RenderUI.characterFor("computer")].filter(Boolean);
      const rect = RenderDom.playArea.getBoundingClientRect();
      const maxRadius = Math.max(rect.width, rect.height);
      activeCharacters.forEach((character, ownerIndex) => {
        const element = elementColorsFor(character);
        const phase = now / (ownerIndex ? 6800 : 7600);
        RenderDom.ctx.save();
        RenderDom.ctx.globalCompositeOperation = "lighter";
        const gradient = RenderDom.ctx.createRadialGradient(
          RenderState.center.x + Math.cos(phase) * maxRadius * 0.16,
          RenderState.center.y + Math.sin(phase * 0.7) * maxRadius * 0.12,
          maxRadius * 0.05,
          RenderState.center.x,
          RenderState.center.y,
          maxRadius * 0.58
        );
        gradient.addColorStop(0, hexToRgba(element.glow, ownerIndex ? 0.055 : 0.07));
        gradient.addColorStop(0.55, hexToRgba(element.primary, ownerIndex ? 0.04 : 0.05));
        gradient.addColorStop(1, hexToRgba(element.deep, 0));
        RenderDom.ctx.fillStyle = gradient;
        RenderDom.ctx.fillRect(0, 0, rect.width, rect.height);
        RenderDom.ctx.restore();

        const motifs = spriteMotifsFor(character);
        for (let i = 0; i < 18; i += 1) {
          const angle = stableUnitSeed(character.id, i, "backdrop-angle") * Math.PI * 2 + phase * (ownerIndex ? -0.45 : 0.38);
          const distance = maxRadius * (0.12 + stableUnitSeed(character.id, i, "backdrop-distance") * 0.36);
          const x = RenderState.center.x + Math.cos(angle) * distance;
          const y = RenderState.center.y + Math.sin(angle * 1.17) * distance * 0.64;
          const size = RenderState.cellSize * (1.1 + stableUnitSeed(character.id, i, "backdrop-size") * 1.7);
          drawElementSprite(x, y, size, angle, character, motifs[i % motifs.length], 0.055, "source-over");
        }
      });
    }

    function drawElementAura(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const pulse = 0.84 + waveValue(progress, 0.17) * 0.28;
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      const gradient = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.05, x, y, radiusPx * pulse);
      gradient.addColorStop(0, hexToRgba(element.hot, 0.2 * alpha));
      gradient.addColorStop(0.34, hexToRgba(element.primary, 0.16 * alpha));
      gradient.addColorStop(0.68, hexToRgba(element.deep, 0.08 * alpha));
      gradient.addColorStop(1, hexToRgba(element.glow, 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * pulse, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = gradient;
      RenderDom.ctx.fill();
      for (let ring = 0; ring < 3; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, radiusPx * (0.38 + ring * 0.19 + progress * 0.12), 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(element.palette[ring], alpha * (0.34 - ring * 0.07));
        RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * (0.04 + ring * 0.012));
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }

    function drawFlameTongue(x, y, size, angle, color, line, alpha = 1) {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(0, -size);
      RenderDom.ctx.bezierCurveTo(size * 0.46, -size * 0.42, size * 0.28, size * 0.32, 0, size * 0.86);
      RenderDom.ctx.bezierCurveTo(-size * 0.42, size * 0.28, -size * 0.34, -size * 0.36, 0, -size);
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba(color, 0.58 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(line, 0.86 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.04);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawElementSigil(x, y, size, angle, color, alpha = 1) {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.strokeStyle = hexToRgba(color, 0.82 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.044);
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.lineJoin = "round";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(-size * 0.44, -size * 0.08);
      RenderDom.ctx.lineTo(-size * 0.12, -size * 0.36);
      RenderDom.ctx.lineTo(size * 0.18, -size * 0.08);
      RenderDom.ctx.lineTo(size * 0.46, -size * 0.32);
      RenderDom.ctx.moveTo(-size * 0.28, size * 0.28);
      RenderDom.ctx.lineTo(size * 0.36, size * 0.28);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawElementShard(x, y, size, angle, color, alpha = 1) {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(0, -size);
      RenderDom.ctx.lineTo(size * 0.3, 0);
      RenderDom.ctx.lineTo(0, size);
      RenderDom.ctx.lineTo(-size * 0.3, 0);
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba(color, 0.46 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(color, 0.94 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.038);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawElementMotifs(x, y, radiusPx, progress, character, alpha = 1, density = 7) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < density; i += 1) {
        const orbit = radiusPx * (0.28 + (i % 4) * 0.16);
        const angle = progress * Math.PI * (character.id === "moray" ? 4.8 : 1.6) + i * Math.PI * 2 / density;
        const px = x + Math.cos(angle) * orbit;
        const py = y + Math.sin(angle) * orbit * 0.78;
        const motifAlpha = alpha * (0.74 + waveValue(progress, i * 0.11) * 0.38);
        const color = paletteColor(character, i);
        const nextColor = paletteColor(character, i + 1);
        if (character.id === "dragon") {
          drawElementShard(px, py, RenderState.cellSize * 0.24, angle, color, motifAlpha);
        } else if (character.id === "sandworm") {
          drawDustCloud(px, py, RenderState.cellSize * 0.48, progress + i * 0.07, color, nextColor);
        } else if (character.id === "quetzal") {
          drawFeatherShape(px, py, RenderState.cellSize * 0.3, angle + Math.PI / 2, color, nextColor, motifAlpha);
        } else if (character.id === "moray") {
          drawLightningBetween(
            { x: px - Math.cos(angle) * RenderState.cellSize * 0.34, y: py - Math.sin(angle) * RenderState.cellSize * 0.34 },
            { x: px + Math.cos(angle) * RenderState.cellSize * 0.34, y: py + Math.sin(angle) * RenderState.cellSize * 0.34 },
            progress + i * 0.09,
            color,
            0.88,
            4
          );
        } else if (character.id === "lobster") {
          drawFlameTongue(px, py, RenderState.cellSize * 0.34, angle, color, nextColor, motifAlpha);
        } else if (character.id === "gu_king") {
          drawElementSigil(px, py, RenderState.cellSize * 0.3, angle, color, motifAlpha);
        }
      }
      RenderDom.ctx.restore();
    }

    function drawElementWake(start, end, progress, character) {
      const element = elementColorsFor(character);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i += 1) {
        const t = Math.max(0, progress - i * 0.08);
        const px = start.x + dx * t;
        const py = start.y + dy * t;
        const spread = RenderState.cellSize * (0.1 + i * 0.06);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(px - nx * spread, py - ny * spread);
        RenderDom.ctx.quadraticCurveTo(
          px - dx * 0.12 + nx * spread * 0.4,
          py - dy * 0.12 + ny * spread * 0.4,
          px + nx * spread,
          py + ny * spread
        );
        RenderDom.ctx.strokeStyle = hexToRgba(element.palette[i % element.palette.length], 0.42 * (1 - i * 0.1));
        RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * (0.055 - i * 0.003));
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }

    function drawPulseRing(x, y, radiusPx, progress, fill, stroke, lineScale = 1) {
      const alpha = 1 - progress;
      RenderDom.ctx.save();
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (0.55 + progress * 0.45), 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba(fill, 0.24 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(stroke, 0.96 * alpha);
      RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.105 * lineScale);
      RenderDom.ctx.stroke();
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (0.28 + progress * 0.28), 0, Math.PI * 2);
      RenderDom.ctx.strokeStyle = hexToRgba("#ffffff", 0.4 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.04 * lineScale);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function isUltimateVisualType(type = "") {
      return type.endsWith("-big") || type.endsWith("-burst") || type.endsWith("-radiation");
    }

    function drawSmallSkillOrb(x, y, size, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const pulse = 0.92 + waveValue(progress, 0.18) * 0.14;
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.globalCompositeOperation = "lighter";
      const glow = RenderDom.ctx.createRadialGradient(0, 0, size * 0.08, 0, 0, size * 1.15);
      glow.addColorStop(0, hexToRgba(element.hot, 0.72 * alpha));
      glow.addColorStop(0.45, hexToRgba(element.primary, 0.34 * alpha));
      glow.addColorStop(1, hexToRgba(element.deep, 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(0, 0, size * 1.1, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = glow;
      RenderDom.ctx.fill();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(0, 0, size * 0.48 * pulse, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba(element.hot, 0.9 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(element.secondary, 0.95 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * 0.05);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawSmallSkillScale(x, y, size, angle, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(0, -size);
      RenderDom.ctx.quadraticCurveTo(size * 0.55, -size * 0.2, size * 0.18, size * 0.82);
      RenderDom.ctx.quadraticCurveTo(-size * 0.48, size * 0.18, 0, -size);
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba(element.primary, 0.64 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(element.glow, 0.86 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.032);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawSmallSkillRuneRing(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(progress * Math.PI * 0.72);
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let ring = 0; ring < 2; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(0, 0, radiusPx * (0.48 + ring * 0.2), 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(ring ? element.secondary : element.glow, (0.46 - ring * 0.1) * alpha);
        RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * (0.035 + ring * 0.012));
        RenderDom.ctx.stroke();
      }
      for (let i = 0; i < 6; i += 1) {
        const angle = i * Math.PI * 2 / 6;
        const px = Math.cos(angle) * radiusPx * 0.66;
        const py = Math.sin(angle) * radiusPx * 0.66;
        RenderDom.ctx.save();
        RenderDom.ctx.translate(px, py);
        RenderDom.ctx.rotate(angle + Math.PI / 2);
        drawLocalHex(RenderState.cellSize * 0.11);
        RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? element.primary : element.hot, 0.28 * alpha);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(i % 2 ? element.glow : element.secondary, 0.78 * alpha);
        RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.024);
        RenderDom.ctx.stroke();
        RenderDom.ctx.restore();
      }
      RenderDom.ctx.restore();
    }

    function drawSmallSkillGroundCracks(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.lineJoin = "round";
      for (let i = 0; i < 7; i += 1) {
        const angle = i * Math.PI * 2 / 7 + 0.18;
        const inner = radiusPx * (0.12 + progress * 0.08);
        const mid = radiusPx * (0.34 + (i % 2) * 0.08);
        const outer = radiusPx * (0.58 + progress * 0.28);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner * 0.72);
        RenderDom.ctx.lineTo(x + Math.cos(angle + 0.12) * mid, y + Math.sin(angle + 0.12) * mid * 0.72);
        RenderDom.ctx.lineTo(x + Math.cos(angle - 0.08) * outer, y + Math.sin(angle - 0.08) * outer * 0.72);
        RenderDom.ctx.strokeStyle = hexToRgba(i % 2 ? element.secondary : element.deep, alpha * (0.68 - progress * 0.24));
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * 0.045);
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }

    function drawSmallSkillWaterRibbon(x, y, size, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let band = -1; band <= 1; band += 1) {
        RenderDom.ctx.beginPath();
        for (let step = 0; step <= 22; step += 1) {
          const t = step / 22;
          const px = -size * 0.82 + t * size * 1.64;
          const py = Math.sin(t * Math.PI * 2 + progress * Math.PI * 2 + band * 0.7) * size * 0.13 + band * size * 0.16;
          if (step === 0) RenderDom.ctx.moveTo(x + px, y + py);
          else RenderDom.ctx.lineTo(x + px, y + py);
        }
        RenderDom.ctx.strokeStyle = hexToRgba(band ? element.secondary : element.hot, alpha * (band ? 0.5 : 0.7));
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * (band ? 0.04 : 0.06));
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }

    function drawSmallSkillClawEmblem(x, y, size, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const strike = Math.pow(waveValue(progress, 0.18), 1.8);
      const lift = size * (0.56 - strike * 0.52);
      const squash = 1 + strike * 0.16;
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(-0.08 + Math.sin(progress * Math.PI * 2) * 0.045);
      RenderDom.ctx.globalCompositeOperation = "source-over";
      RenderDom.ctx.shadowColor = hexToRgba(element.glow, 0.54 * alpha);
      RenderDom.ctx.shadowBlur = RenderState.cellSize * 0.16;

      RenderDom.ctx.save();
      RenderDom.ctx.translate(0, lift);
      RenderDom.ctx.scale(1.02, squash);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(-size * 0.52, -size * 0.42);
      RenderDom.ctx.quadraticCurveTo(-size * 0.72, -size * 0.08, -size * 0.42, size * 0.34);
      RenderDom.ctx.quadraticCurveTo(-size * 0.16, size * 0.76, size * 0.28, size * 0.58);
      RenderDom.ctx.quadraticCurveTo(size * 0.72, size * 0.4, size * 0.74, -size * 0.08);
      RenderDom.ctx.quadraticCurveTo(size * 0.68, -size * 0.48, size * 0.28, -size * 0.66);
      RenderDom.ctx.quadraticCurveTo(size * 0.04, -size * 0.26, -size * 0.18, -size * 0.02);
      RenderDom.ctx.quadraticCurveTo(-size * 0.28, -size * 0.28, -size * 0.52, -size * 0.42);
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba(element.primary, 0.9 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(element.hot, 0.94 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.8, RenderState.cellSize * 0.062);
      RenderDom.ctx.stroke();

      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(-size * 0.2, -size * 0.1);
      RenderDom.ctx.quadraticCurveTo(size * 0.04, -size * 0.22, size * 0.34, -size * 0.16);
      RenderDom.ctx.strokeStyle = hexToRgba(element.deep, 0.44 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.035);
      RenderDom.ctx.stroke();
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(-size * 0.18, size * 0.2);
      RenderDom.ctx.quadraticCurveTo(size * 0.08, size * 0.3, size * 0.42, size * 0.14);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();

      RenderDom.ctx.beginPath();
      RenderDom.ctx.roundRect?.(-size * 0.16, -size * 0.95 + lift, size * 0.32, size * 0.48, size * 0.1);
      if (!RenderDom.ctx.roundRect) RenderDom.ctx.rect(-size * 0.16, -size * 0.95 + lift, size * 0.32, size * 0.48);
      RenderDom.ctx.fillStyle = hexToRgba(element.deep, 0.82 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(element.glow, 0.72 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.04);
      RenderDom.ctx.stroke();

      if (strike > 0.55) {
        RenderDom.ctx.globalCompositeOperation = "lighter";
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(0, size * 0.62, size * (0.46 + strike * 0.24), size * (0.12 + strike * 0.04), 0, 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(element.hot, alpha * 0.72);
        RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * 0.055);
        RenderDom.ctx.stroke();
        for (let crack = 0; crack < 7; crack += 1) {
          const angle = -Math.PI * 0.88 + crack * Math.PI * 1.76 / 6;
          const inner = size * 0.16;
          const outer = size * (0.44 + (crack % 3) * 0.08);
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(Math.cos(angle) * inner, size * 0.62 + Math.sin(angle) * inner * 0.36);
          RenderDom.ctx.lineTo(Math.cos(angle) * outer, size * 0.62 + Math.sin(angle) * outer * 0.42);
          RenderDom.ctx.strokeStyle = hexToRgba(crack % 2 ? element.secondary : "#ffffff", alpha * (0.62 - crack * 0.035));
          RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.032);
          RenderDom.ctx.lineCap = "round";
          RenderDom.ctx.stroke();
        }
      }
      RenderDom.ctx.restore();
    }

    function drawSmallSkillPoisonSigil(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(-progress * Math.PI * 0.9);
      RenderDom.ctx.globalCompositeOperation = "lighter";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(0, 0, radiusPx * 0.42, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba("#020617", 0.72 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(element.glow, 0.82 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * 0.05);
      RenderDom.ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const angle = i * Math.PI / 3;
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(Math.cos(angle) * radiusPx * 0.22, Math.sin(angle) * radiusPx * 0.22);
        RenderDom.ctx.quadraticCurveTo(
          Math.cos(angle + 0.34) * radiusPx * 0.46,
          Math.sin(angle + 0.34) * radiusPx * 0.46,
          Math.cos(angle + 0.68) * radiusPx * 0.74,
          Math.sin(angle + 0.68) * radiusPx * 0.54
        );
        RenderDom.ctx.strokeStyle = hexToRgba(i % 2 ? element.secondary : element.hot, 0.68 * alpha);
        RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.034);
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }

    function drawSmallSkillIcon(x, y, size, progress, character, angle = 0, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      if (character.id === "dragon") {
        drawSmallSkillOrb(0, 0, size * 0.78, progress, character, alpha);
        for (let i = 0; i < 5; i += 1) {
          const scaleAngle = i * Math.PI * 2 / 5 + progress * Math.PI * 1.2;
          drawSmallSkillScale(Math.cos(scaleAngle) * size * 0.58, Math.sin(scaleAngle) * size * 0.42, size * 0.2, scaleAngle, character, 0.78 * alpha);
        }
      } else if (character.id === "sandworm") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(size * 0.72, 0);
        RenderDom.ctx.lineTo(size * 0.12, -size * 0.4);
        RenderDom.ctx.lineTo(-size * 0.64, -size * 0.22);
        RenderDom.ctx.lineTo(-size * 0.26, 0);
        RenderDom.ctx.lineTo(-size * 0.64, size * 0.22);
        RenderDom.ctx.lineTo(size * 0.12, size * 0.4);
        RenderDom.ctx.closePath();
        RenderDom.ctx.fillStyle = hexToRgba(element.primary, 0.88 * alpha);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.deep, 0.94 * alpha);
        RenderDom.ctx.lineWidth = Math.max(1.5, RenderState.cellSize * 0.052);
        RenderDom.ctx.stroke();
        drawSmallSkillGroundCracks(0, 0, size * 0.8, progress, character, 0.74 * alpha);
      } else if (character.id === "quetzal") {
        drawFeatherShape(0, 0, size * 0.72, Math.PI / 2, element.primary, element.glow, 0.92 * alpha);
        [-1, 1].forEach(mirror => drawFeatherShape(-size * 0.18, mirror * size * 0.28, size * 0.42, Math.PI / 2 + mirror * 0.52, element.secondary, element.hot, 0.72 * alpha));
      } else if (character.id === "moray") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(0, 0, size * 0.62, size * 0.34, 0, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(element.deep, 0.88 * alpha);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.hot, 0.94 * alpha);
        RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * 0.055);
        RenderDom.ctx.stroke();
        drawSmallSkillWaterRibbon(0, 0, size * 0.9, progress, character, alpha);
      } else if (character.id === "lobster") {
        drawSmallSkillClawEmblem(0, 0, size * 1.05, progress, character, alpha);
      } else if (character.id === "gu_king") {
        drawSmallSkillPoisonSigil(0, 0, size * 0.92, progress, character, alpha);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(size * 0.2, -size * 0.12, size * 0.12, 0, Math.PI * 2);
        RenderDom.ctx.arc(size * 0.18, size * 0.14, size * 0.08, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(element.hot, 0.86 * alpha);
        RenderDom.ctx.fill();
      } else {
        drawSmallSkillOrb(0, 0, size * 0.72, progress, character, alpha);
      }
      RenderDom.ctx.restore();
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
          drawSmallSkillScale(x + Math.cos(angle) * radiusPx * 0.52, y + Math.sin(angle) * radiusPx * 0.38, RenderState.cellSize * 0.18, angle, character, 0.7 * alpha);
        }
      } else if (character.id === "sandworm") {
        drawSandSpike(x, y, radiusPx * 0.88, progress, element.secondary, element.glow);
        drawSmallSkillGroundCracks(x, y + radiusPx * 0.08, radiusPx, progress, character, 0.8 * alpha);
      } else if (character.id === "quetzal") {
        drawSwampForestBloom(x, y, radiusPx * 0.66, progress, character, 0.72 * alpha, 2);
        for (let i = 0; i < 7; i += 1) {
          const angle = i * Math.PI * 2 / 7 + progress * 0.55;
          drawFeatherShape(x + Math.cos(angle) * radiusPx * 0.5, y + Math.sin(angle) * radiusPx * 0.36, RenderState.cellSize * 0.22, angle + Math.PI / 2, element.primary, element.hot, 0.68 * alpha);
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
          RenderDom.ctx.beginPath();
          RenderDom.ctx.arc(x + Math.cos(angle) * radiusPx * 0.56, y + Math.sin(angle) * radiusPx * 0.4, RenderState.cellSize * (0.06 + (i % 3) * 0.02), 0, Math.PI * 2);
          RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? element.glow : element.secondary, 0.58 * alpha);
          RenderDom.ctx.fill();
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
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 5; i += 1) {
        const back = RenderState.cellSize * (0.32 + i * 0.22);
        const width = RenderState.cellSize * (0.1 + i * 0.035);
        const fade = alpha * (0.45 - i * 0.065) * Math.min(1, progress * 2.2);
        const tx = headX - ux * back;
        const ty = headY - uy * back;
        RenderDom.ctx.beginPath();
        if (character.id === "sandworm") {
          RenderDom.ctx.ellipse(tx, ty + RenderState.cellSize * 0.08, width * 1.35, width * 0.62, Math.atan2(uy, ux), 0, Math.PI * 2);
          RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? element.secondary : element.dust || element.primary, fade);
          RenderDom.ctx.fill();
        } else if (character.id === "quetzal") {
          drawFeatherShape(tx + nx * width * 0.5, ty + ny * width * 0.5, RenderState.cellSize * (0.13 + i * 0.012), Math.atan2(uy, ux) + Math.PI / 2, i % 2 ? element.secondary : element.primary, element.glow, fade * 1.5);
        } else if (character.id === "lobster") {
          drawFlameTongue(tx, ty, RenderState.cellSize * (0.16 + i * 0.018), Math.atan2(uy, ux) - Math.PI / 2, i % 2 ? element.secondary : element.primary, element.hot, fade * 1.25);
        } else if (character.id === "gu_king") {
          RenderDom.ctx.arc(tx + nx * Math.sin(i) * width, ty + ny * Math.sin(i) * width, RenderState.cellSize * (0.055 + i * 0.008), 0, Math.PI * 2);
          RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? element.glow : element.secondary, fade * 1.25);
          RenderDom.ctx.fill();
        } else {
          RenderDom.ctx.moveTo(tx - nx * width, ty - ny * width);
          RenderDom.ctx.quadraticCurveTo(tx - ux * RenderState.cellSize * 0.16, ty - uy * RenderState.cellSize * 0.16, tx + nx * width, ty + ny * width);
          RenderDom.ctx.strokeStyle = hexToRgba(character.id === "moray" && i % 2 ? element.hot : i % 2 ? element.secondary : element.glow, fade);
          RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * (0.042 - i * 0.004));
          RenderDom.ctx.lineCap = "round";
          RenderDom.ctx.stroke();
        }
      }
      RenderDom.ctx.restore();
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
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(progress * Math.PI * 2);
      for (let ring = 0; ring < 3; ring += 1) {
        const size = radiusPx * (0.28 + progress * 0.42 + ring * 0.16);
        drawLocalHex(size);
        RenderDom.ctx.strokeStyle = hexToRgba(ring ? line : color, (1 - progress) * (ring ? 0.58 : 0.88));
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * (ring ? 0.045 : 0.072));
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }

    function drawLightningBetween(start, end, progress, color, widthScale = 1, segments = 7) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      RenderDom.ctx.save();
      RenderDom.ctx.beginPath();
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const jitter = (i === 0 || i === segments) ? 0 : Math.sin((progress * 8 + i * 1.7) * Math.PI) * RenderState.cellSize * 0.18;
        const px = start.x + dx * t + nx * jitter;
        const py = start.y + dy * t + ny * jitter;
        if (i === 0) RenderDom.ctx.moveTo(px, py);
        else RenderDom.ctx.lineTo(px, py);
      }
      RenderDom.ctx.strokeStyle = hexToRgba(color, 0.96);
      RenderDom.ctx.lineWidth = Math.max(1.8, RenderState.cellSize * 0.075 * widthScale);
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.lineJoin = "round";
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawFeatherShape(x, y, size, angle, color, line, alpha = 1) {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(0, -size);
      RenderDom.ctx.quadraticCurveTo(size * 0.58, -size * 0.15, size * 0.12, size);
      RenderDom.ctx.quadraticCurveTo(-size * 0.42, size * 0.12, 0, -size);
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba(color, 0.62 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(line, 0.96 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.045);
      RenderDom.ctx.stroke();
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(0, -size * 0.72);
      RenderDom.ctx.lineTo(size * 0.02, size * 0.74);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawDustCloud(x, y, radiusPx, progress, color, line) {
      RenderDom.ctx.save();
      for (let i = 0; i < 7; i += 1) {
        const angle = progress * Math.PI * 1.4 + i * Math.PI * 2 / 7;
        const distance = radiusPx * (0.16 + progress * 0.42 + (i % 2) * 0.07);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance * 0.72,
          Math.max(2, RenderState.cellSize * (0.1 + (i % 3) * 0.025)) * (1 - progress * 0.25),
          0,
          Math.PI * 2
        );
        RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? line : color, 0.46 * (1 - progress));
        RenderDom.ctx.fill();
      }
      RenderDom.ctx.restore();
    }

    function drawClawArc(x, y, radiusPx, progress, color, line, mirror = 1) {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.scale(mirror, 1);
      RenderDom.ctx.rotate(-0.45 + progress * 0.3);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(0, 0, radiusPx * 0.56, -0.82, 0.82);
      RenderDom.ctx.strokeStyle = hexToRgba(color, 0.94 * (1 - progress * 0.38));
      RenderDom.ctx.lineWidth = Math.max(2.5, RenderState.cellSize * 0.16);
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.stroke();
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(radiusPx * 0.32, 0, radiusPx * 0.22, -1.2, 1.2);
      RenderDom.ctx.strokeStyle = hexToRgba(line, 0.92 * (1 - progress * 0.25));
      RenderDom.ctx.lineWidth = Math.max(1.8, RenderState.cellSize * 0.085);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawBugSwarm(x, y, radiusPx, progress, color, line) {
      RenderDom.ctx.save();
      for (let i = 0; i < 10; i += 1) {
        const angle = progress * Math.PI * 4 + i * Math.PI * 2 / 10;
        const distance = radiusPx * (0.18 + ((i * 7) % 5) * 0.08 + progress * 0.2);
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle * 1.13) * distance;
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(px, py, RenderState.cellSize * 0.07, RenderState.cellSize * 0.035, angle, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? color : line, 0.86 * (1 - progress * 0.24));
        RenderDom.ctx.fill();
      }
      RenderDom.ctx.restore();
    }

    function drawSandSpike(x, y, radiusPx, progress, color, line) {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      for (let i = 0; i < 9; i += 1) {
        const angle = i * Math.PI * 2 / 9 + progress * 0.42;
        const inner = radiusPx * (0.18 + progress * 0.18);
        const outer = radiusPx * (0.48 + waveValue(progress, i * 0.13) * 0.16);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(Math.cos(angle - 0.08) * inner, Math.sin(angle - 0.08) * inner);
        RenderDom.ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        RenderDom.ctx.lineTo(Math.cos(angle + 0.08) * inner, Math.sin(angle + 0.08) * inner);
        RenderDom.ctx.closePath();
        RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? color : line, 0.64 * (1 - progress * 0.12));
        RenderDom.ctx.fill();
      }
      RenderDom.ctx.restore();
    }

    function drawEnergyBeamBurst(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      const pulse = 0.82 + waveValue(progress, 0.16) * 0.24;
      const gradient = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.04, x, y, radiusPx * 0.72 * pulse);
      gradient.addColorStop(0, hexToRgba("#ffffff", 0.88 * alpha));
      gradient.addColorStop(0.24, hexToRgba(element.glow, 0.58 * alpha));
      gradient.addColorStop(0.62, hexToRgba(element.deep, 0.22 * alpha));
      gradient.addColorStop(1, hexToRgba(element.primary, 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * 0.72 * pulse, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = gradient;
      RenderDom.ctx.fill();
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
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (0.28 + progress * 0.54), 0, Math.PI * 2);
      RenderDom.ctx.strokeStyle = hexToRgba("#ffffff", 0.86 * alpha * (1 - progress * 0.28));
      RenderDom.ctx.lineWidth = Math.max(3, RenderState.cellSize * 0.12);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawDragonBigBurst(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      const flash = Math.max(0, 1 - progress * 1.4);
      const core = radiusPx * (0.3 + waveValue(progress, 0.2) * 0.2);
      const halo = radiusPx * (0.54 + progress * 1.05);
      const gradient = RenderDom.ctx.createRadialGradient(x, y, core * 0.12, x, y, halo);
      gradient.addColorStop(0, hexToRgba("#ffffff", 0.96 * alpha));
      gradient.addColorStop(0.28, hexToRgba("#fff7ed", 0.78 * alpha));
      gradient.addColorStop(0.5, hexToRgba(element.secondary, 0.54 * alpha));
      gradient.addColorStop(0.72, hexToRgba(element.glow, 0.22 * alpha));
      gradient.addColorStop(1, hexToRgba(element.deep, 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, halo, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = gradient;
      RenderDom.ctx.fill();
      for (let ring = 0; ring < 5; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, radiusPx * (0.22 + progress * 1.08 + ring * 0.14), 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? element.secondary : "#ffffff", alpha * (0.94 - ring * 0.14) * (1 - progress * 0.28));
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * (0.19 - ring * 0.024));
        RenderDom.ctx.stroke();
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
          RenderState.cellSize * 0.34,
          angle,
          i % 2 ? element.secondary : "#ffffff",
          alpha * (1 - progress * 0.24)
        );
      }
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, core, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba("#ffffff", (0.72 + flash * 0.24) * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.restore();
    }

    function drawSuperBlackHole(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      const pull = Math.max(0, Math.min(1, progress));
      for (let ring = 0; ring < 5; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(
          x,
          y,
          radiusPx * (0.34 + ring * 0.14 - pull * 0.08),
          radiusPx * (0.18 + ring * 0.08 - pull * 0.04),
          -pull * Math.PI * 2 + ring * 0.48,
          0,
          Math.PI * 2
        );
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? element.deep : "#020617", alpha * (0.78 - ring * 0.1));
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * (0.1 - ring * 0.01));
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.globalCompositeOperation = "lighter";
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
      RenderDom.ctx.globalCompositeOperation = "source-over";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (0.24 + pull * 0.08), 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba("#000000", 0.94 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(element.glow, 0.7 * alpha);
      RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.08);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawSandBurial(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.ellipse(x, y + radiusPx * 0.1, radiusPx * 1.18, radiusPx * 0.52, 0, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba("#4a2a12", 0.34 * alpha);
      RenderDom.ctx.fill();
      drawDustCloud(x, y, radiusPx * 1.7, progress, element.dust || element.primary, element.deep);
      for (let i = 0; i < 34; i += 1) {
        const angle = i * Math.PI * 2 / 34 + progress * Math.PI * 0.85;
        const spread = radiusPx * (0.22 + (i % 4) * 0.1);
        const height = radiusPx * (0.55 + waveValue(progress, i * 0.09) * 0.95);
        const baseX = x + Math.cos(angle) * spread;
        const baseY = y + Math.sin(angle) * spread * 0.54;
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(baseX - RenderState.cellSize * 0.18, baseY + height * 0.24);
        RenderDom.ctx.quadraticCurveTo(baseX - RenderState.cellSize * 0.28, baseY - height * 0.35, baseX, baseY - height);
        RenderDom.ctx.quadraticCurveTo(baseX + RenderState.cellSize * 0.28, baseY - height * 0.35, baseX + RenderState.cellSize * 0.18, baseY + height * 0.24);
        RenderDom.ctx.closePath();
        RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? element.primary : element.secondary, 0.6 * alpha * (1 - progress * 0.1));
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(i % 3 ? element.glow : "#fff7ed", 0.52 * alpha);
        RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.035);
        RenderDom.ctx.stroke();
      }
      for (let i = 0; i < 26; i += 1) {
        const angle = progress * Math.PI * 1.8 + i * Math.PI * 2 / 26;
        const distance = radiusPx * (0.64 + (i % 5) * 0.12 + progress * 0.28);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.66, RenderState.cellSize * (0.11 + (i % 3) * 0.04), 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? element.dust || element.primary : "#7c2d12", 0.34 * alpha * (1 - progress * 0.32));
        RenderDom.ctx.fill();
      }
      for (let ring = 0; ring < 4; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(x, y + radiusPx * 0.08, radiusPx * (0.36 + ring * 0.22 + progress * 0.28), radiusPx * (0.18 + ring * 0.11), progress * Math.PI + ring * 0.4, 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? element.primary : element.glow, 0.52 * alpha * (1 - progress * 0.22));
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.07);
        RenderDom.ctx.stroke();
      }
      drawSandSpike(x, y, radiusPx * 1.35, progress, element.secondary, element.glow);
      RenderDom.ctx.restore();
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
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < count; i += 1) {
        const angle = progress * Math.PI * 2 + i * Math.PI * 2 / count;
        const distance = radiusPx * (0.12 + ((i * 5) % 8) * 0.075);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.68, RenderState.cellSize * (0.035 + (i % 3) * 0.014), 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(palette[i % palette.length], alpha * (0.5 + waveValue(progress, i * 0.09) * 0.28));
        RenderDom.ctx.fill();
      }
      RenderDom.ctx.restore();
    }

    function drawQuetzalPetal(cx, cy, size, angle, palette, alpha, style = "oval") {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(cx, cy);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.beginPath();
      if (style === "point") {
        RenderDom.ctx.moveTo(0, -size);
        RenderDom.ctx.lineTo(size * 0.34, size * 0.28);
        RenderDom.ctx.lineTo(0, size * 0.82);
        RenderDom.ctx.lineTo(-size * 0.34, size * 0.28);
      } else if (style === "cup") {
        RenderDom.ctx.moveTo(-size * 0.52, size * 0.2);
        RenderDom.ctx.quadraticCurveTo(0, -size * 1.08, size * 0.52, size * 0.2);
        RenderDom.ctx.quadraticCurveTo(0, size * 0.56, -size * 0.52, size * 0.2);
      } else if (style === "ribbon") {
        RenderDom.ctx.moveTo(0, -size);
        RenderDom.ctx.bezierCurveTo(size * 0.64, -size * 0.5, size * 0.18, size * 0.45, 0, size);
        RenderDom.ctx.bezierCurveTo(-size * 0.48, size * 0.28, -size * 0.38, -size * 0.42, 0, -size);
      } else {
        RenderDom.ctx.ellipse(0, 0, size * 0.36, size * 0.78, 0, 0, Math.PI * 2);
      }
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba(palette[0], 0.74 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(palette[1], 0.78 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.025);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawQuetzalLeafBlade(x, y, length, angle, palette, alpha, width = 0.28) {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(0, 0);
      RenderDom.ctx.quadraticCurveTo(length * width, -length * 0.48, 0, -length);
      RenderDom.ctx.quadraticCurveTo(-length * width * 0.72, -length * 0.4, 0, 0);
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba(palette[0], 0.58 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(palette[1], 0.72 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.028);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawQuetzalFlowerPatch(x, y, radiusPx, progress, character, alpha, kind) {
      const variant = quetzalBloomVariant(0, kind);
      const palette = variant.palette;
      radiusPx *= 1.14;
      const pulse = 0.88 + waveValue(progress, kind * 0.03) * 0.22;
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
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
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, centerY, radiusPx * (variant.silhouette === "sunhead" ? 0.22 : 0.14), 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(palette[1], 0.9 * alpha);
        RenderDom.ctx.fill();
      } else if (variant.silhouette === "filament") {
        for (let i = 0; i < 24; i += 1) {
          const angle = i * Math.PI * 2 / 24 + progress * 0.8;
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(x, centerY);
          RenderDom.ctx.quadraticCurveTo(x + Math.cos(angle) * radiusPx * 0.32, centerY + Math.sin(angle) * radiusPx * 0.22, x + Math.cos(angle) * radiusPx * 0.48, centerY + Math.sin(angle) * radiusPx * 0.34);
          RenderDom.ctx.strokeStyle = hexToRgba(palette[i % 2], 0.64 * alpha);
          RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.025);
          RenderDom.ctx.stroke();
        }
      } else if (variant.silhouette === "tassel") {
        for (let i = 0; i < 9; i += 1) {
          const bx = x + (i - 4) * radiusPx * 0.07;
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(bx, y + radiusPx * 0.28);
          RenderDom.ctx.lineTo(bx + Math.sin(progress * 5 + i) * radiusPx * 0.06, y - radiusPx * (0.18 + (i % 3) * 0.08));
          RenderDom.ctx.strokeStyle = hexToRgba(palette[i % 2], 0.72 * alpha);
          RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.034);
          RenderDom.ctx.stroke();
        }
      } else if (variant.silhouette === "giant") {
        for (let i = 0; i < 5; i += 1) {
          const angle = i * Math.PI * 2 / 5 + progress * 0.08;
          drawQuetzalPetal(x + Math.cos(angle) * radiusPx * 0.2, centerY + Math.sin(angle) * radiusPx * 0.15, radiusPx * 0.44 * pulse, angle + Math.PI / 2, palette, alpha, "cup");
        }
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, centerY, radiusPx * 0.16, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba("#3f1d1d", 0.88 * alpha);
        RenderDom.ctx.fill();
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
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, centerY, radiusPx * 0.055, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba(palette[1], 0.9 * alpha);
      RenderDom.ctx.fill();
      drawQuetzalGlowDust(x, y, radiusPx, progress, palette, alpha, variant.motion === "scatter" ? 22 : 12);
      RenderDom.ctx.restore();
      drawQuetzalGrassPatch(x, y + radiusPx * 0.19, radiusPx * 0.64, progress, character, alpha * 0.42, 8 + (kind % 4));
    }

    function drawQuetzalGrassPatch(x, y, radiusPx, progress, character, alpha, kind) {
      const variant = quetzalBloomVariant(1, kind);
      const palette = variant.palette;
      radiusPx *= 1.12;
      const sway = Math.sin(progress * Math.PI * 2 + kind) * radiusPx * 0.08;
      const drawBlade = (baseX, baseY, height, angle, width = 1) => {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(baseX, baseY);
        RenderDom.ctx.quadraticCurveTo(baseX + Math.cos(angle) * radiusPx * 0.18 + sway, baseY - height * 0.54, baseX + Math.cos(angle) * radiusPx * 0.28 + sway, baseY - height);
        RenderDom.ctx.strokeStyle = hexToRgba(palette[0], 0.72 * alpha);
        RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.028 * width);
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
      };
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      if (variant.silhouette === "joint cane" || variant.silhouette === "thick cane") {
        const canes = variant.silhouette === "thick cane" ? 4 : 7;
        for (let c = 0; c < canes; c += 1) {
          const bx = x + (c - (canes - 1) / 2) * radiusPx * 0.16;
          const top = y - radiusPx * (0.48 + (c % 2) * 0.14);
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(bx, y + radiusPx * 0.34);
          RenderDom.ctx.lineTo(bx + sway * 0.4, top);
          RenderDom.ctx.strokeStyle = hexToRgba(palette[0], 0.82 * alpha);
          RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * (variant.silhouette === "thick cane" ? 0.072 : 0.046));
          RenderDom.ctx.stroke();
          for (let n = 0; n < 4; n += 1) {
            const ny = y + radiusPx * 0.2 - n * radiusPx * 0.18;
            RenderDom.ctx.beginPath();
            RenderDom.ctx.arc(bx + sway * 0.12, ny, RenderState.cellSize * 0.025, 0, Math.PI * 2);
            RenderDom.ctx.fillStyle = hexToRgba(palette[1], 0.64 * alpha);
            RenderDom.ctx.fill();
          }
        }
      } else if (variant.silhouette.includes("spike") || variant.silhouette.includes("grain") || variant.silhouette.includes("awn")) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x, y + radiusPx * 0.36);
        RenderDom.ctx.lineTo(x + sway, y - radiusPx * 0.5);
        RenderDom.ctx.strokeStyle = hexToRgba(palette[2], 0.78 * alpha);
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * 0.035);
        RenderDom.ctx.stroke();
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
            RenderDom.ctx.beginPath();
            RenderDom.ctx.arc(x + Math.cos(angle) * radiusPx * 0.42 + sway, y + Math.sin(angle) * radiusPx * 0.5, RenderState.cellSize * 0.045, 0, Math.PI * 2);
            RenderDom.ctx.fillStyle = hexToRgba(palette[1], 0.78 * alpha);
            RenderDom.ctx.fill();
          }
        }
      } else if (variant.silhouette.includes("plume") || variant.silhouette === "foxtail" || variant.silhouette === "arching plume") {
        const stemTop = { x: x + sway, y: y - radiusPx * 0.45 };
        drawBlade(x, y + radiusPx * 0.32, radiusPx * 0.75, -Math.PI / 2, 1.4);
        for (let i = 0; i < 24; i += 1) {
          const angle = -Math.PI / 2 + (i - 8) * 0.12;
          RenderDom.ctx.beginPath();
          RenderDom.ctx.ellipse(stemTop.x + Math.cos(angle) * radiusPx * 0.12, stemTop.y + Math.sin(angle) * radiusPx * 0.16, RenderState.cellSize * 0.035, RenderState.cellSize * 0.09, angle, 0, Math.PI * 2);
          RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? palette[1] : palette[0], 0.58 * alpha);
          RenderDom.ctx.fill();
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
      RenderDom.ctx.restore();
    }

    function drawQuetzalTreePatch(x, y, radiusPx, progress, character, alpha, kind) {
      const variant = quetzalBloomVariant(2, kind);
      const palette = variant.palette;
      radiusPx *= 1.1;
      const sway = Math.sin(progress * Math.PI * 2 + kind) * radiusPx * 0.035;
      const trunkHeight = radiusPx * (variant.silhouette === "bottle trunk" ? 0.76 : 0.6);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      RenderDom.ctx.beginPath();
      if (variant.silhouette === "bottle trunk") {
        RenderDom.ctx.moveTo(x - radiusPx * 0.18, y + radiusPx * 0.35);
        RenderDom.ctx.quadraticCurveTo(x - radiusPx * 0.32, y - radiusPx * 0.04, x - radiusPx * 0.08, y - trunkHeight);
        RenderDom.ctx.lineTo(x + radiusPx * 0.08, y - trunkHeight);
        RenderDom.ctx.quadraticCurveTo(x + radiusPx * 0.32, y - radiusPx * 0.04, x + radiusPx * 0.18, y + radiusPx * 0.35);
      } else {
        RenderDom.ctx.moveTo(x, y + radiusPx * 0.35);
        RenderDom.ctx.bezierCurveTo(x - radiusPx * 0.08, y, x + radiusPx * 0.08 + sway, y - radiusPx * 0.28, x + sway, y - trunkHeight);
      }
      RenderDom.ctx.strokeStyle = hexToRgba(palette[2], 0.86 * alpha);
      RenderDom.ctx.lineWidth = Math.max(2.2, RenderState.cellSize * (variant.silhouette === "bottle trunk" ? 0.12 : 0.07));
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.lineJoin = "round";
      RenderDom.ctx.stroke();
      const crownY = y - trunkHeight;
      if (variant.silhouette.includes("conifer") || variant.silhouette.includes("pine") || variant.silhouette.includes("fir")) {
        const tiers = variant.silhouette === "fir spire" ? 6 : 5;
        for (let t = 0; t < tiers; t += 1) {
          const cy = crownY + t * radiusPx * 0.14;
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(x + sway, cy - radiusPx * 0.18);
          RenderDom.ctx.lineTo(x - radiusPx * (0.34 - t * 0.035), cy + radiusPx * 0.12);
          RenderDom.ctx.lineTo(x + radiusPx * (0.34 - t * 0.035), cy + radiusPx * 0.12);
          RenderDom.ctx.closePath();
          RenderDom.ctx.fillStyle = hexToRgba(palette[t % 2], 0.66 * alpha);
          RenderDom.ctx.fill();
          RenderDom.ctx.strokeStyle = hexToRgba(palette[1], 0.48 * alpha);
          RenderDom.ctx.stroke();
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
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(bx, y + radiusPx * 0.34);
          RenderDom.ctx.lineTo(bx + sway, y - radiusPx * (0.42 + (c % 2) * 0.12));
          RenderDom.ctx.strokeStyle = hexToRgba(palette[0], 0.74 * alpha);
          RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * 0.04);
          RenderDom.ctx.stroke();
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
      RenderDom.ctx.restore();
    }

    function drawQuetzalMushroomPatch(x, y, radiusPx, progress, character, alpha, kind) {
      const variant = quetzalBloomVariant(3, kind);
      const palette = variant.palette;
      radiusPx *= 1.14;
      const pulse = 0.92 + waveValue(progress, kind * 0.05) * 0.18;
      const drawStem = (mx, my, height, width = 0.16) => {
        RenderDom.ctx.beginPath();
        if (RenderDom.ctx.roundRect) RenderDom.ctx.roundRect(mx - radiusPx * width * 0.5, my - height, radiusPx * width, height, radiusPx * width * 0.5);
        else RenderDom.ctx.rect(mx - radiusPx * width * 0.5, my - height, radiusPx * width, height);
        RenderDom.ctx.fillStyle = hexToRgba("#d6d3d1", 0.62 * alpha);
        RenderDom.ctx.fill();
      };
      const drawCap = (mx, my, width, height, style = "dome") => {
        RenderDom.ctx.beginPath();
        if (style === "cone") {
          RenderDom.ctx.moveTo(mx - width * 0.5, my);
          RenderDom.ctx.lineTo(mx, my - height);
          RenderDom.ctx.lineTo(mx + width * 0.5, my);
        } else if (style === "flat") {
          RenderDom.ctx.ellipse(mx, my - height * 0.35, width * 0.52, height * 0.28, 0, Math.PI, Math.PI * 2);
          RenderDom.ctx.lineTo(mx + width * 0.46, my);
          RenderDom.ctx.lineTo(mx - width * 0.46, my);
        } else {
          RenderDom.ctx.ellipse(mx, my, width * 0.5, height * 0.42, 0, Math.PI, Math.PI * 2);
          RenderDom.ctx.lineTo(mx + width * 0.5, my);
          RenderDom.ctx.lineTo(mx - width * 0.5, my);
        }
        RenderDom.ctx.closePath();
        RenderDom.ctx.fillStyle = hexToRgba(palette[0], 0.82 * alpha);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(palette[1], 0.7 * alpha);
        RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.03);
        RenderDom.ctx.stroke();
      };
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      if (variant.silhouette === "puffball") {
        for (let i = 0; i < 7; i += 1) {
          const mx = x + Math.cos(i * 1.8) * radiusPx * 0.2;
          const my = y + Math.sin(i * 1.8) * radiusPx * 0.12;
          RenderDom.ctx.beginPath();
          RenderDom.ctx.arc(mx, my, radiusPx * (0.16 + i * 0.025) * pulse, 0, Math.PI * 2);
          RenderDom.ctx.fillStyle = hexToRgba(palette[0], 0.74 * alpha);
          RenderDom.ctx.fill();
          RenderDom.ctx.strokeStyle = hexToRgba(palette[1], 0.46 * alpha);
          RenderDom.ctx.stroke();
        }
        drawQuetzalGlowDust(x, y, radiusPx, progress, palette, alpha, 24);
      } else if (variant.silhouette === "honeycomb") {
        drawStem(x, y + radiusPx * 0.34, radiusPx * 0.45, 0.18);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(x, y - radiusPx * 0.2, radiusPx * 0.26, radiusPx * 0.46, 0, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(palette[0], 0.82 * alpha);
        RenderDom.ctx.fill();
        for (let i = 0; i < 12; i += 1) {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.arc(x + ((i % 3) - 1) * radiusPx * 0.1, y - radiusPx * (0.48 - Math.floor(i / 3) * 0.16), RenderState.cellSize * 0.035, 0, Math.PI * 2);
          RenderDom.ctx.strokeStyle = hexToRgba(palette[1], 0.64 * alpha);
          RenderDom.ctx.stroke();
        }
      } else if (variant.silhouette === "stinkhorn") {
        drawStem(x, y + radiusPx * 0.34, radiusPx * 0.78 * pulse, 0.18);
        drawCap(x, y - radiusPx * 0.44, radiusPx * 0.28, radiusPx * 0.42, "cone");
      } else if (variant.silhouette === "truffle") {
        for (let i = 0; i < 8; i += 1) {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.ellipse(x + Math.cos(i) * radiusPx * 0.14, y + Math.sin(i * 1.7) * radiusPx * 0.12, radiusPx * 0.2, radiusPx * 0.14, i, 0, Math.PI * 2);
          RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? palette[0] : palette[1], 0.66 * alpha);
          RenderDom.ctx.fill();
        }
      } else if (variant.silhouette === "coral") {
        for (let b = 0; b < 18; b += 1) {
          const angle = -Math.PI / 2 + (b - 8.5) * 0.12;
          drawLightningBetween({ x, y: y + radiusPx * 0.32 }, { x: x + Math.cos(angle) * radiusPx * (0.34 + (b % 3) * 0.05), y: y + Math.sin(angle) * radiusPx * 0.78 }, progress + b * 0.03, palette[b % 2], 0.34, 4);
        }
      } else if (variant.silhouette === "bracket" || variant.silhouette === "shelf fan") {
        for (let s = 0; s < 6; s += 1) {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.ellipse(x - radiusPx * 0.12 + s * radiusPx * 0.08, y - radiusPx * (0.14 - s * 0.08), radiusPx * (0.35 - s * 0.035), radiusPx * 0.13, -0.12, Math.PI, Math.PI * 2);
          RenderDom.ctx.fillStyle = hexToRgba(s % 2 ? palette[1] : palette[0], 0.72 * alpha);
          RenderDom.ctx.fill();
          RenderDom.ctx.strokeStyle = hexToRgba(palette[2], 0.54 * alpha);
          RenderDom.ctx.stroke();
        }
      } else if (variant.silhouette === "jelly") {
        for (let j = 0; j < 8; j += 1) {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.ellipse(x + Math.cos(j * 1.6) * radiusPx * 0.18, y + Math.sin(j) * radiusPx * 0.1, radiusPx * 0.18 * pulse, radiusPx * 0.12, progress + j, 0, Math.PI * 2);
          RenderDom.ctx.fillStyle = hexToRgba(j % 2 ? palette[1] : palette[0], 0.52 * alpha);
          RenderDom.ctx.fill();
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
              RenderDom.ctx.beginPath();
              RenderDom.ctx.arc(mx + Math.cos(dot * 1.7) * radiusPx * 0.08, my - height - radiusPx * 0.05 + Math.sin(dot) * radiusPx * 0.04, RenderState.cellSize * 0.025, 0, Math.PI * 2);
              RenderDom.ctx.fillStyle = hexToRgba(palette[1], 0.8 * alpha);
              RenderDom.ctx.fill();
            }
          }
        }
        drawQuetzalGlowDust(x, y, radiusPx, progress, palette, alpha, variant.motion === "pore" ? 18 : 12);
      }
      RenderDom.ctx.restore();
    }

    function drawSwampForestBloom(x, y, radiusPx, progress, character, alpha = 1, variant = 0) {
      const element = elementColorsFor(character);
      const normalizedVariant = Math.abs(Math.floor(variant)) % 64;
      const category = Math.floor(normalizedVariant / 16);
      const kind = normalizedVariant % 16;
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.ellipse(x, y + radiusPx * 0.18, radiusPx * 1.08, radiusPx * 0.58, 0, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba(category === 3 ? "#6b4423" : element.mud || "#6b4423", category === 3 ? 0.48 * alpha : 0.36 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.beginPath();
      RenderDom.ctx.ellipse(x, y + radiusPx * 0.1, radiusPx * 0.88, radiusPx * 0.48, 0, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba(category === 3 ? "#4b2e18" : element.deep, category === 3 ? 0.34 * alpha : 0.24 * alpha);
      RenderDom.ctx.fill();
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
      RenderDom.ctx.globalCompositeOperation = "lighter";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (0.44 + waveValue(progress, normalizedVariant * 0.01) * 0.18), 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba(category === 3 ? "#7c2d12" : element.glow, 0.08 * alpha);
      RenderDom.ctx.fill();
      drawElementMotifs(x, y, radiusPx * 0.74, progress, character, 0.3 * alpha, 6);
      RenderDom.ctx.restore();
    }

    function drawQuetzalBloomPreview(now) {
      if (!quetzalBloomPreviewUntil || now > quetzalBloomPreviewUntil) return;
      const previewCharacter = RenderUI.characterList().find(character => character.id === "quetzal") || RenderUI.characterFor("player");
      const rect = RenderDom.playArea.getBoundingClientRect();
      const cols = 8;
      const rows = 8;
      const gapX = rect.width / (cols + 1);
      const gapY = rect.height / (rows + 1);
      const previewSize = Math.min(gapX, gapY) * 0.38;
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      RenderDom.ctx.fillStyle = "rgba(2, 6, 23, 0.62)";
      RenderDom.ctx.fillRect(0, 0, rect.width, rect.height);
      for (let index = 0; index < 64; index += 1) {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const px = gapX * (col + 1);
        const py = gapY * (row + 1);
        drawSwampForestBloom(px, py, previewSize, (now / 2200 + index * 0.013) % 1, previewCharacter, 0.96, index);
      }
      RenderDom.ctx.restore();
    }

    window.previewQuetzalBloomVariants = function previewQuetzalBloomVariants(durationMs = 8000) {
      quetzalBloomPreviewUntil = performance.now() + Math.max(1000, Number(durationMs) || 8000);
      draw();
    };

    function drawRailgunLine(blast, progress, alpha, character) {
      const element = elementColorsFor(character);
      const cells = blast.lineCells || [];
      if (!cells.length) return;
      const start = HexSnakeGame.axialToPixel(cells[0]);
      const end = HexSnakeGame.axialToPixel(cells[cells.length - 1]);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let band = 0; band < 7; band += 1) {
        const offset = (band - 3) * RenderState.cellSize * 0.2;
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(start.x + nx * offset, start.y + ny * offset);
        RenderDom.ctx.lineTo(end.x + nx * offset, end.y + ny * offset);
        RenderDom.ctx.strokeStyle = hexToRgba(band === 3 ? element.primary : paletteColor(character, band), alpha * (band === 3 ? 0.98 : 0.48));
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * (band === 3 ? 0.22 : 0.075));
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(start.x, start.y);
      RenderDom.ctx.lineTo(end.x, end.y);
      RenderDom.ctx.strokeStyle = hexToRgba("#ffffff", alpha * 0.74);
      RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * 0.07);
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.stroke();
      cells.forEach((cell, index) => {
        const point = HexSnakeGame.axialToPixel(cell);
        if (index % 2 === 0) drawPulseRing(point.x, point.y, RenderState.cellSize * (0.78 + progress * 0.55), progress, element.deep, element.glow, 0.9);
        drawLightningBetween(
          { x: point.x - nx * RenderState.cellSize * 0.62, y: point.y - ny * RenderState.cellSize * 0.62 },
          { x: point.x + nx * RenderState.cellSize * 0.62, y: point.y + ny * RenderState.cellSize * 0.62 },
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
        const reach = RenderState.cellSize * (0.62 + (i % 4) * 0.18);
        drawLightningBetween(
          { x: point.x + nx * reach * side, y: point.y + ny * reach * side },
          { x: point.x - nx * reach * side * 0.55, y: point.y - ny * reach * side * 0.55 },
          progress + i * 0.13,
          i % 5 === 0 ? "#ffffff" : i % 2 ? element.violet || element.secondary : element.primary,
          0.98,
          6
        );
      }
      RenderDom.ctx.restore();
    }

    function drawNuclearBloom(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      const flash = Math.max(0, 1 - progress * 1.5);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (0.34 + progress * 1.08), 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba("#ffffff", 0.46 * flash * alpha);
      RenderDom.ctx.fill();
      for (let ring = 0; ring < 7; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, radiusPx * (0.14 + progress * 0.9 + ring * 0.075), 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? element.secondary : element.primary, alpha * (0.78 - ring * 0.085) * (1 - progress * 0.18));
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * (0.15 - ring * 0.012));
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.globalCompositeOperation = "source-over";
      const stemHeight = radiusPx * (0.5 + progress * 0.3);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.ellipse(x, y - stemHeight * 0.45, radiusPx * (0.22 + progress * 0.18), radiusPx * (0.18 + progress * 0.14), 0, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba(element.secondary, 0.34 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.beginPath();
      RenderDom.ctx.roundRect?.(x - radiusPx * 0.16, y - stemHeight * 0.42, radiusPx * 0.32, stemHeight * 0.78, RenderState.cellSize * 0.18);
      if (!RenderDom.ctx.roundRect) RenderDom.ctx.rect(x - radiusPx * 0.16, y - stemHeight * 0.42, radiusPx * 0.32, stemHeight * 0.78);
      RenderDom.ctx.fillStyle = hexToRgba(element.primary, 0.28 * alpha);
      RenderDom.ctx.fill();
      for (let i = 0; i < 34; i += 1) {
        const angle = i * Math.PI * 2 / 34;
        drawFlameTongue(
          x + Math.cos(angle) * radiusPx * (0.24 + progress * 0.5),
          y + Math.sin(angle) * radiusPx * (0.24 + progress * 0.34),
          RenderState.cellSize * 0.42,
          angle,
          i % 2 ? element.primary : element.secondary,
          element.glow,
          0.76 * alpha
        );
      }
      RenderDom.ctx.restore();
    }

    function drawGhostFireBurn(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const fade = Math.max(0, 1 - progress * 0.14);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      const ember = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.06, x, y, radiusPx * 1.08);
      ember.addColorStop(0, hexToRgba("#fff7ed", 0.28 * alpha));
      ember.addColorStop(0.32, hexToRgba("#f97316", 0.34 * alpha));
      ember.addColorStop(0.62, hexToRgba("#7f1d1d", 0.38 * alpha));
      ember.addColorStop(1, hexToRgba("#020617", 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * 1.04, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = ember;
      RenderDom.ctx.fill();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let flame = 0; flame < 24; flame += 1) {
        const angle = flame * Math.PI * 2 / 24 + progress * Math.PI * 0.72;
        const orbit = radiusPx * (0.18 + (flame % 6) * 0.085);
        const fx = x + Math.cos(angle) * orbit;
        const fy = y + Math.sin(angle) * orbit * 0.62 - radiusPx * (0.06 + waveValue(progress, flame * 0.04) * 0.18);
        const size = RenderState.cellSize * (0.28 + (flame % 5) * 0.045);
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
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance * 0.66 - radiusPx * 0.16,
          RenderState.cellSize * (0.16 + (smoke % 3) * 0.035),
          RenderState.cellSize * (0.09 + (smoke % 3) * 0.024),
          angle,
          0,
          Math.PI * 2
        );
        RenderDom.ctx.fillStyle = hexToRgba(smoke % 2 ? "#7f1d1d" : "#312e81", alpha * fade * 0.2);
        RenderDom.ctx.fill();
      }
      RenderDom.ctx.restore();
    }

    function drawLobsterPalmUltimate(x, y, radiusPx, progress, character, alpha = 1, hand = "right") {
      drawGhostFireBurn(x, y, radiusPx * 1.08, progress, character, alpha * 0.82);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      drawPulseRing(x, y, radiusPx * 0.92, progress, "#7f1d1d", "#fff7ed", 1.15);
      RenderDom.ctx.restore();
      drawBuddhaPalmSeal(x, y - radiusPx * 0.04, radiusPx * 1.08, progress, character, alpha * 1.25, hand);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y - radiusPx * 0.04, radiusPx * (0.46 + waveValue(progress, 0.18) * 0.08), 0, Math.PI * 2);
      RenderDom.ctx.strokeStyle = hexToRgba("#ffffff", 0.62 * alpha);
      RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.075);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawRadiationDust(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      const fade = Math.max(0, 1 - progress);
      const dirty = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.08, x, y, radiusPx * (0.95 + progress * 0.16));
      dirty.addColorStop(0, hexToRgba(element.secondary, 0.28 * alpha * fade));
      dirty.addColorStop(0.38, hexToRgba("#7f1d1d", 0.24 * alpha * fade));
      dirty.addColorStop(0.72, hexToRgba("#111827", 0.34 * alpha * fade));
      dirty.addColorStop(1, hexToRgba("#020617", 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (0.96 + progress * 0.18), 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = dirty;
      RenderDom.ctx.fill();
      for (let ring = 0; ring < 4; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, radiusPx * (0.28 + ring * 0.18 + progress * 0.12), 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? "#27272a" : element.secondary, alpha * fade * (0.46 - ring * 0.06));
        RenderDom.ctx.lineWidth = Math.max(1.5, RenderState.cellSize * (0.08 - ring * 0.008));
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 42; i += 1) {
        const angle = i * Math.PI * 2 / 42 + progress * Math.PI * (i % 2 ? 0.8 : -0.6);
        const distance = radiusPx * (0.16 + ((i * 7) % 13) * 0.055 + progress * 0.2);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.72, RenderState.cellSize * (0.045 + (i % 4) * 0.022), 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(i % 3 ? element.secondary : "#fef3c7", alpha * fade * 0.72);
        RenderDom.ctx.fill();
      }
      RenderDom.ctx.restore();
    }

    function drawSpellGlyphRing(x, y, radiusPx, progress, alpha = 1) {
      const glyphs = ["KA", "RA", "LUX", "SOL", "OR", "AUM", "VE", "ZEN", "YU", "HA"];
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(progress * Math.PI * 1.6);
      RenderDom.ctx.textAlign = "center";
      RenderDom.ctx.textBaseline = "middle";
      RenderDom.ctx.font = `${Math.max(9, RenderState.cellSize * 0.24)}px serif`;
      for (let i = 0; i < glyphs.length; i += 1) {
        const angle = i * Math.PI * 2 / glyphs.length;
        const gx = Math.cos(angle) * radiusPx;
        const gy = Math.sin(angle) * radiusPx * 0.72;
        RenderDom.ctx.save();
        RenderDom.ctx.translate(gx, gy);
        RenderDom.ctx.rotate(angle + Math.PI / 2);
        RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? "#fef3c7" : "#ffffff", alpha * (0.58 + waveValue(progress, i * 0.08) * 0.22));
        RenderDom.ctx.fillText(glyphs[i], 0, 0);
        RenderDom.ctx.restore();
      }
      RenderDom.ctx.restore();
    }

    function drawWhiteGoldMagicCircle(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const fade = Math.max(0, 1 - progress * 0.45);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let ring = 0; ring < 5; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(
          x,
          y,
          radiusPx * (0.34 + ring * 0.16 + waveValue(progress, ring * 0.09) * 0.025),
          radiusPx * (0.24 + ring * 0.105),
          progress * Math.PI * (ring % 2 ? -0.85 : 0.85),
          0,
          Math.PI * 2
        );
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? "#fbbf24" : "#ffffff", alpha * fade * (0.7 - ring * 0.08));
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * (0.07 - ring * 0.006));
        RenderDom.ctx.stroke();
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
      RenderDom.ctx.restore();
    }

    function drawFrostShard(x, y, size, angle, alpha = 1) {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(0, -size);
      RenderDom.ctx.lineTo(size * 0.28, -size * 0.12);
      RenderDom.ctx.lineTo(size * 0.12, size * 0.82);
      RenderDom.ctx.lineTo(0, size);
      RenderDom.ctx.lineTo(-size * 0.12, size * 0.82);
      RenderDom.ctx.lineTo(-size * 0.28, -size * 0.12);
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba("#e0f2fe", 0.64 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba("#ffffff", 0.86 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.032);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawFrostFreezeBurst(x, y, radiusPx, progress, character, alpha = 1) {
      const freeze = Math.max(0, 1 - progress * 0.18);
      const pulse = 0.9 + waveValue(progress, 0.2) * 0.12;
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      const frost = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.04, x, y, radiusPx * 1.15);
      frost.addColorStop(0, hexToRgba("#ffffff", 0.92 * alpha));
      frost.addColorStop(0.28, hexToRgba("#e0f2fe", 0.78 * alpha));
      frost.addColorStop(0.6, hexToRgba("#7dd3fc", 0.38 * alpha));
      frost.addColorStop(1, hexToRgba("#0f172a", 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (0.94 + progress * 0.22) * pulse, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = frost;
      RenderDom.ctx.fill();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let arm = 0; arm < 12; arm += 1) {
        const angle = arm * Math.PI * 2 / 12 + progress * 0.16;
        const inner = radiusPx * 0.18;
        const outer = radiusPx * (0.68 + waveValue(progress, arm * 0.04) * 0.24);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        RenderDom.ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        RenderDom.ctx.strokeStyle = hexToRgba(arm % 2 ? "#bae6fd" : "#ffffff", alpha * freeze * 0.78);
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * (0.045 + (arm % 3) * 0.014));
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
        drawFrostShard(
          x + Math.cos(angle) * radiusPx * (0.48 + progress * 0.08),
          y + Math.sin(angle) * radiusPx * (0.48 + progress * 0.08),
          RenderState.cellSize * (0.2 + (arm % 3) * 0.035),
          angle,
          alpha * freeze
        );
      }
      for (let ring = 0; ring < 3; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, radiusPx * (0.28 + ring * 0.2 + progress * 0.18), 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? "#7dd3fc" : "#ffffff", alpha * freeze * (0.58 - ring * 0.1));
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * (0.06 - ring * 0.008));
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }

    function drawFrostMagicCircle(x, y, radiusPx, progress, character, alpha = 1) {
      const fade = Math.max(0, 1 - progress * 0.28);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let ring = 0; ring < 5; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(
          x,
          y,
          radiusPx * (0.34 + ring * 0.15 + waveValue(progress, ring * 0.08) * 0.025),
          radiusPx * (0.22 + ring * 0.095),
          progress * Math.PI * (ring % 2 ? -0.52 : 0.52),
          0,
          Math.PI * 2
        );
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? "#7dd3fc" : "#e0f2fe", alpha * fade * (0.64 - ring * 0.07));
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * (0.062 - ring * 0.005));
        RenderDom.ctx.stroke();
      }
      for (let i = 0; i < 18; i += 1) {
        const angle = i * Math.PI * 2 / 18 + progress * Math.PI * 0.8;
        const sx = x + Math.cos(angle) * radiusPx * 0.74;
        const sy = y + Math.sin(angle) * radiusPx * 0.52;
        drawFrostShard(sx, sy, RenderState.cellSize * (0.14 + (i % 3) * 0.026), angle + Math.PI, alpha * fade * 0.72);
      }
      for (let wisp = 0; wisp < 24; wisp += 1) {
        const angle = wisp * Math.PI * 2 / 24 + progress * Math.PI * 1.2;
        const base = radiusPx * (0.18 + (wisp % 6) * 0.09);
        const lift = radiusPx * (0.16 + waveValue(progress, wisp * 0.05) * 0.24);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x + Math.cos(angle) * base, y + Math.sin(angle) * base * 0.58);
        RenderDom.ctx.quadraticCurveTo(
          x + Math.cos(angle + 0.28) * (base * 0.8),
          y + Math.sin(angle + 0.28) * base * 0.48 - lift * 0.55,
          x + Math.cos(angle + 0.5) * (base * 0.6),
          y + Math.sin(angle + 0.5) * base * 0.38 - lift
        );
        RenderDom.ctx.strokeStyle = hexToRgba(wisp % 2 ? "#bae6fd" : "#ffffff", alpha * fade * (0.34 + (wisp % 3) * 0.04));
        RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.032);
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
      }
      drawSpellGlyphRing(x, y, radiusPx * 0.86, progress, alpha * fade * 0.7);
      RenderDom.ctx.restore();
    }

    function drawDragonSpiritRadiance(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const fade = Math.max(0, 1 - progress * 0.28);
      const pulse = 0.9 + waveValue(progress, 0.12) * 0.16;
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      const gradient = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.04, x, y, radiusPx * (1.12 + progress * 0.44));
      gradient.addColorStop(0, hexToRgba("#ffffff", 0.96 * alpha));
      gradient.addColorStop(0.25, hexToRgba("#fefce8", 0.72 * alpha));
      gradient.addColorStop(0.52, hexToRgba(element.glow, 0.36 * alpha * fade));
      gradient.addColorStop(1, hexToRgba(element.deep, 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (1.08 + progress * 0.42) * pulse, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = gradient;
      RenderDom.ctx.fill();
      for (let i = 0; i < 42; i += 1) {
        const angle = i * Math.PI * 2 / 42 + progress * Math.PI * 0.9;
        const inner = radiusPx * (0.16 + (i % 4) * 0.035);
        const outer = radiusPx * (0.95 + waveValue(progress, i * 0.05) * 0.46);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        RenderDom.ctx.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
        RenderDom.ctx.strokeStyle = hexToRgba(i % 3 ? "#ffffff" : "#fbbf24", alpha * fade * (0.58 + (i % 5) * 0.035));
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * (0.045 + (i % 3) * 0.018));
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
      }
      drawWhiteGoldMagicCircle(x, y, radiusPx * 0.86, progress, character, alpha * 0.88);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * (0.22 + waveValue(progress, 0.2) * 0.08), 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba("#ffffff", 0.94 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.restore();
    }

    function drawSandTornadoProjectile(x, y, size, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      for (let layer = 0; layer < 5; layer += 1) {
        RenderDom.ctx.beginPath();
        for (let step = 0; step < 34; step += 1) {
          const t = step / 33;
          const turn = progress * Math.PI * 7 + layer * 0.7 + t * Math.PI * 3.6;
          const width = size * (0.12 + t * 0.48) * (1 - layer * 0.075);
          const px = Math.cos(turn) * width;
          const py = size * (0.62 - t * 1.18);
          if (step === 0) RenderDom.ctx.moveTo(x + px, y + py);
          else RenderDom.ctx.lineTo(x + px, y + py);
        }
        RenderDom.ctx.strokeStyle = hexToRgba(layer % 2 ? element.secondary : element.dust || element.primary, alpha * (0.74 - layer * 0.08));
        RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * (0.09 - layer * 0.008));
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
      }
      for (let i = 0; i < 16; i += 1) {
        const angle = progress * Math.PI * 5 + i * Math.PI * 2 / 16;
        const distance = size * (0.12 + (i % 5) * 0.065);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * 0.72, RenderState.cellSize * (0.045 + (i % 3) * 0.018), 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? element.glow : element.deep, alpha * 0.62);
        RenderDom.ctx.fill();
      }
      RenderDom.ctx.restore();
    }

    function drawFlyingFist(x, y, size, progress, character, mirror = 1, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.scale(1, mirror);
      RenderDom.ctx.lineJoin = "round";
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.shadowColor = hexToRgba(element.glow, 0.68);
      RenderDom.ctx.shadowBlur = RenderState.cellSize * 0.18;
      RenderDom.ctx.beginPath();
      RenderDom.ctx.roundRect?.(-size * 0.18, -size * 0.32, size * 0.68, size * 0.64, size * 0.18);
      if (!RenderDom.ctx.roundRect) RenderDom.ctx.rect(-size * 0.18, -size * 0.32, size * 0.68, size * 0.64);
      RenderDom.ctx.fillStyle = hexToRgba(element.primary, 0.92 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(element.deep, 0.96 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * 0.06);
      RenderDom.ctx.stroke();
      for (let i = 0; i < 4; i += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(size * (0.2 + i * 0.13), -size * 0.26, size * 0.15, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(i % 2 ? element.secondary : element.hot, 0.88 * alpha);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.deep, 0.82 * alpha);
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(-size * 0.2, 0);
      RenderDom.ctx.quadraticCurveTo(-size * 0.54, -size * 0.16, -size * 0.82, -size * 0.04);
      RenderDom.ctx.quadraticCurveTo(-size * 0.5, size * 0.24, -size * 0.12, size * 0.18);
      RenderDom.ctx.fillStyle = hexToRgba(element.secondary, 0.74 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.stroke();
      for (let i = 0; i < 5; i += 1) {
        const trail = size * (0.46 + i * 0.16);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(-trail, -size * (0.22 - i * 0.025));
        RenderDom.ctx.quadraticCurveTo(-trail - size * 0.28, 0, -trail, size * (0.2 - i * 0.018));
        RenderDom.ctx.strokeStyle = hexToRgba(i % 2 ? element.secondary : element.glow, alpha * (0.52 - i * 0.06));
        RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * (0.05 - i * 0.004));
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }

    function drawBuddhaPalmSeal(x, y, radiusPx, progress, character, alpha = 1, hand = "right") {
      const element = elementColorsFor(character);
      const mirror = hand === "left" ? -1 : 1;
      const fade = Math.max(0, 1 - progress * 0.18);
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.scale(mirror, 1);
      RenderDom.ctx.globalCompositeOperation = "lighter";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.ellipse(0, 0, radiusPx * 0.46, radiusPx * 0.72, -0.12, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba("#fff7ed", 0.34 * alpha * fade);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(element.secondary, 0.92 * alpha * fade);
      RenderDom.ctx.lineWidth = Math.max(2.2, RenderState.cellSize * 0.095);
      RenderDom.ctx.stroke();
      for (let finger = 0; finger < 5; finger += 1) {
        const fx = radiusPx * (-0.32 + finger * 0.16);
        const length = radiusPx * (0.44 + (finger === 2 ? 0.2 : finger === 1 || finger === 3 ? 0.12 : 0.02));
        RenderDom.ctx.beginPath();
        RenderDom.ctx.roundRect?.(fx - radiusPx * 0.05, -radiusPx * 0.74 - length * 0.15, radiusPx * 0.1, length, radiusPx * 0.06);
        if (!RenderDom.ctx.roundRect) RenderDom.ctx.rect(fx - radiusPx * 0.05, -radiusPx * 0.74 - length * 0.15, radiusPx * 0.1, length);
        RenderDom.ctx.fillStyle = hexToRgba(finger % 2 ? element.hot : element.glow, 0.32 * alpha * fade);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.secondary, 0.82 * alpha * fade);
        RenderDom.ctx.stroke();
      }
      for (let line = 0; line < 5; line += 1) {
        RenderDom.ctx.beginPath();
        const yLine = radiusPx * (-0.28 + line * 0.16);
        RenderDom.ctx.moveTo(-radiusPx * 0.24, yLine);
        RenderDom.ctx.quadraticCurveTo(radiusPx * 0.08, yLine - radiusPx * 0.1, radiusPx * 0.28, yLine + radiusPx * 0.04);
        RenderDom.ctx.strokeStyle = hexToRgba(line % 2 ? element.secondary : "#ffffff", 0.52 * alpha * fade);
        RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.035);
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let ring = 0; ring < 4; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, radiusPx * (0.42 + ring * 0.18 + progress * 0.18), 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? element.secondary : element.hot, alpha * fade * (0.58 - ring * 0.07));
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * (0.065 - ring * 0.006));
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }

    function drawPoisonVortex(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      const murk = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.04, x, y, radiusPx * 1.18);
      murk.addColorStop(0, hexToRgba("#020617", 0.86 * alpha));
      murk.addColorStop(0.36, hexToRgba(element.primary, 0.64 * alpha));
      murk.addColorStop(0.68, hexToRgba(element.bruise || "#312e81", 0.34 * alpha));
      murk.addColorStop(1, hexToRgba("#020617", 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * 1.18, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = murk;
      RenderDom.ctx.fill();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let arm = 0; arm < 10; arm += 1) {
        RenderDom.ctx.beginPath();
        for (let step = 0; step < 48; step += 1) {
          const t = step / 47;
          const angle = progress * Math.PI * 6.2 + arm * Math.PI * 2 / 10 + t * Math.PI * 3.5;
          const radius = radiusPx * (0.08 + t * 0.95);
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius * 0.72;
          if (step === 0) RenderDom.ctx.moveTo(px, py);
          else RenderDom.ctx.lineTo(px, py);
        }
        RenderDom.ctx.strokeStyle = hexToRgba(arm % 3 === 0 ? element.secondary : arm % 3 === 1 ? element.glow : element.hot, alpha * 0.62);
        RenderDom.ctx.lineWidth = Math.max(2.2, RenderState.cellSize * 0.13);
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
      }
      for (let i = 0; i < 48; i += 1) {
        const angle = progress * Math.PI * 7 + i * Math.PI * 2 / 48;
        const distance = radiusPx * (0.14 + ((i * 5) % 11) * 0.068);
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance * 0.7;
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(px, py, RenderState.cellSize * (0.09 + (i % 4) * 0.035), 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(i % 4 === 0 ? element.secondary : i % 4 === 1 ? element.glow : i % 4 === 2 ? element.hot : "#020617", alpha * 0.72);
        RenderDom.ctx.fill();
      }
      drawHexBurst(x, y, radiusPx * 0.9, progress, "#020617", element.secondary);
      RenderDom.ctx.restore();
    }

    function drawDarkGuKingTornado(x, y, radiusPx, progress, character, alpha = 1) {
      const element = elementColorsFor(character);
      const fade = Math.max(0, 1 - progress * 0.2);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "source-over";
      const shadow = RenderDom.ctx.createRadialGradient(x, y, radiusPx * 0.06, x, y, radiusPx * 1.34);
      shadow.addColorStop(0, hexToRgba("#000000", 0.92 * alpha));
      shadow.addColorStop(0.36, hexToRgba("#020617", 0.82 * alpha));
      shadow.addColorStop(0.7, hexToRgba("#064e3b", 0.28 * alpha));
      shadow.addColorStop(1, hexToRgba("#000000", 0));
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radiusPx * 1.28, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = shadow;
      RenderDom.ctx.fill();

      for (let layer = 0; layer < 8; layer += 1) {
        RenderDom.ctx.beginPath();
        for (let step = 0; step < 70; step += 1) {
          const t = step / 69;
          const spin = progress * Math.PI * (5.6 + layer * 0.18) + layer * 0.74 + t * Math.PI * 5.4;
          const width = radiusPx * (0.1 + t * 0.7) * (1 - layer * 0.045);
          const px = x + Math.cos(spin) * width;
          const py = y + radiusPx * (0.72 - t * 1.46) + Math.sin(spin) * radiusPx * 0.12;
          if (step === 0) RenderDom.ctx.moveTo(px, py);
          else RenderDom.ctx.lineTo(px, py);
        }
        RenderDom.ctx.strokeStyle = hexToRgba(layer % 3 === 0 ? "#000000" : layer % 3 === 1 ? "#7f1d1d" : "#064e3b", alpha * fade * (0.78 - layer * 0.055));
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * (0.16 - layer * 0.011));
        RenderDom.ctx.lineCap = "round";
        RenderDom.ctx.stroke();
      }

      RenderDom.ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 46; i += 1) {
        const angle = progress * Math.PI * (1.5 + (i % 3) * 0.28) + i * Math.PI * 2 / 46;
        const distance = radiusPx * (0.18 + ((i * 7) % 13) * 0.055 + progress * 0.14);
        const puff = RenderState.cellSize * (0.09 + (i % 5) * 0.026);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(
          x + Math.cos(angle) * distance,
          y + Math.sin(angle) * distance * 0.66 - radiusPx * (0.08 + (i % 4) * 0.025),
          puff * 1.3,
          puff * 0.72,
          angle,
          0,
          Math.PI * 2
        );
        RenderDom.ctx.fillStyle = hexToRgba(i % 3 === 0 ? "#7f1d1d" : i % 3 === 1 ? "#064e3b" : "#111827", alpha * fade * (0.44 + (i % 4) * 0.04));
        RenderDom.ctx.fill();
      }
      for (let ring = 0; ring < 4; ring += 1) {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(
          x,
          y + radiusPx * 0.18,
          radiusPx * (0.42 + ring * 0.18 + progress * 0.1),
          radiusPx * (0.18 + ring * 0.07),
          -progress * Math.PI * 1.2 + ring * 0.24,
          0,
          Math.PI * 2
        );
        RenderDom.ctx.strokeStyle = hexToRgba(ring % 2 ? "#7f1d1d" : "#064e3b", alpha * fade * (0.52 - ring * 0.08));
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * (0.072 - ring * 0.008));
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.globalCompositeOperation = "source-over";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y - radiusPx * 0.08, radiusPx * (0.22 + waveValue(progress, 0.18) * 0.06), 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba("#000000", 0.78 * alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(element.glow, 0.58 * alpha);
      RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * 0.05);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawSmallProjectileHead(x, y, projectile, progress, character, angle = 0) {
      const element = elementColorsFor(character);
      const projectileScale = projectile.kind === "lobsterPalm" ? 1.45 : 1;
      const size = RenderState.cellSize * Math.max(0.48, Math.min(0.86, 0.42 + (projectile.radius || 1) * 0.08)) * projectileScale;
      const pulse = 0.9 + waveValue(progress, 0.2) * 0.16;
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.lineJoin = "round";
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.shadowColor = hexToRgba(element.glow, 0.72);
      RenderDom.ctx.shadowBlur = RenderState.cellSize * 0.22;

      if ((projectile.visualType || "").startsWith("lobster-palm")) {
        drawGhostFireBurn(0, 0, size * 0.92, progress, character, 0.5);
        drawBuddhaPalmSeal(0, 0, size * 0.72, progress, character, 0.92, projectile.hand || "right");
        RenderDom.ctx.restore();
        return;
      }

      if (projectile.profile === "small") {
        drawSmallSkillIcon(0, 0, size * 1.05, progress, character, 0, 1);
        RenderDom.ctx.restore();
        return;
      }

      if (character.id === "dragon") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(size * 0.78, 0);
        RenderDom.ctx.lineTo(-size * 0.22, -size * 0.28);
        RenderDom.ctx.lineTo(-size * 0.06, 0);
        RenderDom.ctx.lineTo(-size * 0.22, size * 0.28);
        RenderDom.ctx.closePath();
        RenderDom.ctx.fillStyle = hexToRgba(element.hot, 0.92);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.deep, 0.95);
        RenderDom.ctx.lineWidth = Math.max(1.5, RenderState.cellSize * 0.055);
        RenderDom.ctx.stroke();
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(-size * 0.62, -size * 0.18);
        RenderDom.ctx.lineTo(-size * 0.3, 0);
        RenderDom.ctx.lineTo(-size * 0.62, size * 0.18);
        RenderDom.ctx.strokeStyle = hexToRgba(element.secondary, 0.88);
        RenderDom.ctx.stroke();
      } else if (character.id === "sandworm") {
        drawSandTornadoProjectile(0, 0, size * 1.1, progress, character, 0.98);
      } else if (character.id === "quetzal") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(size * 0.78, 0);
        RenderDom.ctx.lineTo(-size * 0.46, -size * 0.12);
        RenderDom.ctx.lineTo(-size * 0.28, 0);
        RenderDom.ctx.lineTo(-size * 0.46, size * 0.12);
        RenderDom.ctx.closePath();
        RenderDom.ctx.fillStyle = hexToRgba(element.secondary, 0.9);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.deep, 0.9);
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * 0.05);
        RenderDom.ctx.stroke();
        [-1, 1].forEach(mirror => {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(-size * 0.2, 0);
          RenderDom.ctx.quadraticCurveTo(-size * 0.54, mirror * size * 0.34, -size * 0.86, mirror * size * 0.16);
          RenderDom.ctx.quadraticCurveTo(-size * 0.54, mirror * size * 0.08, -size * 0.2, 0);
          RenderDom.ctx.fillStyle = hexToRgba(element.primary, 0.74);
          RenderDom.ctx.fill();
          RenderDom.ctx.strokeStyle = hexToRgba(element.glow, 0.84);
          RenderDom.ctx.stroke();
        });
      } else if (character.id === "moray") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(0, 0, size * 0.5 * pulse, size * 0.34 * pulse, 0, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(element.deep, 0.88);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.hot, 0.92);
        RenderDom.ctx.lineWidth = Math.max(1.8, RenderState.cellSize * 0.065);
        RenderDom.ctx.stroke();
        for (let i = 0; i < 3; i += 1) {
          RenderDom.ctx.beginPath();
          const offset = -0.28 + i * 0.28;
          RenderDom.ctx.moveTo(-size * 0.12, size * offset);
          RenderDom.ctx.lineTo(size * 0.1, size * (offset - 0.16));
          RenderDom.ctx.lineTo(size * 0.32, size * offset);
          RenderDom.ctx.strokeStyle = hexToRgba(i % 2 ? element.secondary : element.glow, 0.92);
          RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.044);
          RenderDom.ctx.stroke();
        }
      } else if (character.id === "lobster") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(size * 0.7, 0);
        RenderDom.ctx.lineTo(size * 0.18, -size * 0.3);
        RenderDom.ctx.lineTo(-size * 0.44, -size * 0.22);
        RenderDom.ctx.lineTo(-size * 0.62, 0);
        RenderDom.ctx.lineTo(-size * 0.44, size * 0.22);
        RenderDom.ctx.lineTo(size * 0.18, size * 0.3);
        RenderDom.ctx.closePath();
        RenderDom.ctx.fillStyle = hexToRgba(element.primary, 0.92);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.deep, 0.98);
        RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * 0.06);
        RenderDom.ctx.stroke();
        [-1, 1].forEach(mirror => {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(size * 0.36, mirror * size * 0.08);
          RenderDom.ctx.quadraticCurveTo(size * 0.62, mirror * size * 0.38, size * 0.86, mirror * size * 0.18);
          RenderDom.ctx.strokeStyle = hexToRgba(element.secondary, 0.95);
          RenderDom.ctx.lineWidth = Math.max(1.8, RenderState.cellSize * 0.07);
          RenderDom.ctx.stroke();
        });
        drawFlameTongue(-size * 0.76, 0, size * 0.3, -Math.PI / 2, element.secondary, element.glow, 0.78);
      } else if (character.id === "gu_king") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(0, 0, size * 0.42 * pulse, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba("#111827", 0.96);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.primary, 0.95);
        RenderDom.ctx.lineWidth = Math.max(1.7, RenderState.cellSize * 0.062);
        RenderDom.ctx.stroke();
        for (let i = 0; i < 6; i += 1) {
          const legAngle = i * Math.PI / 3 + progress * Math.PI;
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(Math.cos(legAngle) * size * 0.24, Math.sin(legAngle) * size * 0.24);
          RenderDom.ctx.lineTo(Math.cos(legAngle) * size * 0.62, Math.sin(legAngle) * size * 0.48);
          RenderDom.ctx.strokeStyle = hexToRgba(i % 2 ? element.glow : element.primary, 0.82);
          RenderDom.ctx.lineWidth = Math.max(1.1, RenderState.cellSize * 0.038);
          RenderDom.ctx.stroke();
        }
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(size * 0.18, -size * 0.1, size * 0.08, 0, Math.PI * 2);
        RenderDom.ctx.arc(size * 0.18, size * 0.1, size * 0.08, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(element.hot, 0.92);
        RenderDom.ctx.fill();
      } else {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(0, 0, size * 0.38 * pulse, 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(element.primary, 0.9);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(element.glow, 0.95);
        RenderDom.ctx.lineWidth = Math.max(1.5, RenderState.cellSize * 0.055);
        RenderDom.ctx.stroke();
      }

      RenderDom.ctx.restore();
    }

    function drawProjectileCore(x, y, projectile, progress, character, travelAngle = 0) {
      const radiusPx = RenderState.cellSize * Math.max(0.7, projectile.radius || 1);
      const type = projectile.visualType || HexSnakeGame.attackVisualType(projectile.owner, projectile.profile);
      const isBig = projectile.profile === "big" || isUltimateVisualType(type);
      const element = elementColorsFor(character);
      RenderDom.ctx.save();
      drawElementAura(x, y, radiusPx * (isBig ? 1.05 : 0.72), progress, character, isBig ? 0.72 : 0.34);
      if (type.startsWith("lobster-palm") && projectile.kind === "lobsterPalm") {
        drawElementAura(x, y, radiusPx * 0.86, progress, character, 0.42);
        drawSmallProjectileHead(x, y, projectile, progress, character, travelAngle);
        RenderDom.ctx.restore();
        return;
      }
      if (!isBig) {
        drawSmallCastFrame(x, y, radiusPx, progress, character, 0.92);
        drawSmallProjectileHead(x, y, projectile, progress, character, travelAngle);
        RenderDom.ctx.restore();
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
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, Math.max(5, RenderState.cellSize * 0.16), 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = character.color;
        RenderDom.ctx.fill();
      }
      RenderDom.ctx.restore();
    }

    function cachedEffectCells(effect, cacheKey, sourceCells, width, excludedCells = [], minDistance = 0) {
      if (!effect) return HexSnakeGame.cellsNearCells(sourceCells, width, excludedCells, minDistance);
      if (!effect[cacheKey]) effect[cacheKey] = HexSnakeGame.cellsNearCells(sourceCells, width, excludedCells, minDistance);
      return effect[cacheKey];
    }

    function drawProjectiles() {
      const now = performance.now();
      RenderState.projectiles.forEach(projectile => {
        if (projectile.createdAt && now < projectile.createdAt) return;
        const blastCharacter = HexSnakeGame.characterForVisualType(projectile.owner, projectile.visualType);
        if (projectile.hidden) {
          const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || RenderConfig.baseAttackDelayMs)));
          const timeToImpact = projectile.impactAt - now;
          const target = HexSnakeGame.axialToPixel(projectile.target);
          if ((projectile.visualType || "").startsWith("sandworm")) {
            if (timeToImpact > RenderConfig.sandwormRevealBeforeImpactMs) return;
            const warningProgress = Math.max(0, 1 - timeToImpact / RenderConfig.sandwormRevealBeforeImpactMs);
            const warningRadius = RenderState.cellSize * Math.max(2.4, (projectile.radius || 1) * 4.4);
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
        if (projectile.kind === "lobsterPalm") {
          const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || RenderConfig.baseAttackDelayMs)));
          const point = HexSnakeGame.pointAlongPath(projectile.source || projectile.target, projectile.pathCells || [projectile.target], progress);
          drawPathTextureTrail(projectile.source || projectile.target, projectile.pathCells || [projectile.target], progress, blastCharacter, {
            visualType: projectile.visualType,
            seed: projectile.createdAt,
            alpha: (projectile.visualType || "").startsWith("lobster-palm") ? 0.88 : 0.72
          });
          drawProjectileCore(point.x, point.y, projectile, progress, blastCharacter, point.angle || 0);
          return;
        }
        if (projectile.kind === "line" || projectile.kind === "lineHazardSetup") {
          const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || RenderConfig.baseAttackDelayMs)));
          const lineTextureCells = cachedEffectCells(projectile, "visualCells", projectile.lineCells, projectile.width, projectile.excludedCells);
          const linePlan = effectVisualPlanFor(projectile.visualType, "line", blastCharacter);
          if ((projectile.visualType || "").startsWith("moray")) {
            drawElementCellTextureWash(lineTextureCells, blastCharacter, progress, linePlan.textureAlpha, {
              seed: `${projectile.visualType}:${projectile.createdAt}`,
              maxParticles: Math.min(linePlan.maxParticles, 72),
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
              maxParticles: Math.min(linePlan.maxParticles, 72),
              perCell: linePlan.perCell,
              size: linePlan.size,
              spin: linePlan.spin,
              drift: linePlan.drift
            });
            const start = HexSnakeGame.axialToPixel(projectile.source || projectile.lineCells[0]);
            const end = HexSnakeGame.axialToPixel(projectile.target || projectile.lineCells[projectile.lineCells.length - 1]);
            const x = start.x + (end.x - start.x) * progress;
            const y = start.y + (end.y - start.y) * progress;
            const radiusPx = RenderState.cellSize * Math.max(1.25, (projectile.width || 1) + 1.05);
            drawEnergyBeamBurst(x, y, radiusPx, progress, blastCharacter, 0.94);
            drawPulseRing(x, y, radiusPx * 0.78, progress, blastCharacter.color, blastCharacter.line, 1.2);
            return;
          }
          const alpha = 0.3 + progress * 0.48;
          drawElementCellTextureWash(lineTextureCells, blastCharacter, progress, linePlan.textureAlpha * 0.86, {
            seed: `${projectile.visualType}:${projectile.createdAt}`,
            maxParticles: Math.min(linePlan.maxParticles, 64),
            perCell: linePlan.perCell,
            size: linePlan.size,
            spin: linePlan.spin,
            drift: linePlan.drift
          });
          lineTextureCells.forEach(cell => {
            const { x, y } = HexSnakeGame.axialToPixel(cell);
            drawElementAura(x, y, RenderState.cellSize * 0.7, progress + cell.q * 0.02, blastCharacter, 0.22);
            HexSnakeGame.hexPath(x, y, RenderState.cellSize * 0.88);
            RenderDom.ctx.fillStyle = hexToRgba(blastCharacter.accent || blastCharacter.color, alpha);
            RenderDom.ctx.fill();
            RenderDom.ctx.strokeStyle = hexToRgba(blastCharacter.line, alpha + 0.16);
            RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.035);
            RenderDom.ctx.stroke();
            if (cell.q % 2 === 0) drawElementMotifs(x, y, RenderState.cellSize * 0.62, progress + cell.r * 0.03, blastCharacter, 0.62, 6);
          });
          const visibleCells = projectile.lineCells.slice(0, Math.max(0, Math.floor(projectile.lineCells.length * progress)));
          for (let i = 1; i < visibleCells.length; i += 1) {
            drawLightningBetween(HexSnakeGame.axialToPixel(visibleCells[i - 1]), HexSnakeGame.axialToPixel(visibleCells[i]), progress + i * 0.07, blastCharacter.accent, 1.3, 5);
          }
          return;
        }
        if (projectile.kind === "headCircle") {
          const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || RenderConfig.baseAttackDelayMs)));
          const target = HexSnakeGame.axialToPixel(projectile.followHead ? RenderAI.ownerHead(projectile.owner) : projectile.target);
          const type = projectile.visualType || "";
          const headCirclePlan = effectVisualPlanFor(type, type.startsWith("dragon-spirit") ? "warning" : "radiation", blastCharacter);
          const warningRadius = RenderState.cellSize * Math.max(1.35, projectile.radius || 1) * 1.04;
          drawElementCircleTexture(target.x, target.y, warningRadius, progress, blastCharacter, headCirclePlan.textureAlpha * 0.7, {
            seed: `${projectile.visualType}:${projectile.createdAt}:headCircle`,
            density: headCirclePlan.density,
            size: headCirclePlan.size,
            maxParticles: headCirclePlan.maxParticles,
            spin: headCirclePlan.spin,
            ellipse: headCirclePlan.ellipse
          });
          if (type.startsWith("dragon-spirit")) {
            drawFrostFreezeBurst(target.x, target.y, RenderState.cellSize * Math.max(1.35, projectile.radius || 1) * 1.08, progress, blastCharacter, 0.72 + progress * 0.2);
          } else {
            drawUltimateImpactFrame(target.x, target.y, RenderState.cellSize * Math.max(1.35, projectile.radius || 1) * 1.04, progress, blastCharacter, 0.58 + progress * 0.22);
            drawNuclearBloom(target.x, target.y, RenderState.cellSize * Math.max(1.2, projectile.radius || 1) * 0.96, progress, blastCharacter, 0.36 + progress * 0.32);
            drawPulseRing(target.x, target.y, RenderState.cellSize * Math.max(1.2, projectile.radius || 1) * (0.72 + progress * 0.5), progress, blastCharacter.color, blastCharacter.line, 1.08);
          }
          return;
        }
        const start = HexSnakeGame.axialToPixel(projectile.source || projectile.target);
        const end = HexSnakeGame.axialToPixel(projectile.target);
        const progress = Math.min(1, Math.max(0, (now - projectile.createdAt) / (projectile.delay || RenderConfig.baseAttackDelayMs)));
        const x = start.x + (end.x - start.x) * progress;
        const y = start.y + (end.y - start.y) * progress;
        const isSmallProjectile = projectile.profile === "small";
        const arcHeight = Math.sin(progress * Math.PI) * RenderState.cellSize * (isSmallProjectile ? 0.82 : 1.5);
        const projectilePoint = { x, y: y - arcHeight };
        const travelAngle = Math.atan2(end.y - start.y, end.x - start.x);
        if (!isSmallProjectile) {
          drawLightningBetween(start, projectilePoint, progress, blastCharacter.line, 0.85, 5);
          drawElementWake(start, projectilePoint, progress, blastCharacter);
        } else {
          drawSmallSkillTrail(start, projectilePoint, progress, blastCharacter, 0.88);
        }
        drawProjectileCore(projectilePoint.x, projectilePoint.y, projectile, progress, blastCharacter, travelAngle);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(end.x, end.y, RenderState.cellSize * Math.max(0.52, (projectile.radius || 1) * 0.32), 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(blastCharacter.line, 0.56);
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.055);
        RenderDom.ctx.stroke();
      });
    }

    function activeAttackPreviewProfile() {
      if (RenderState.controlAttackPointer) return "big";
      if (RenderState.keyboardAttackPreview) return RenderState.keyboardAttackPreview.profile || RenderState.selectedAttackProfile;
      return RenderState.attackPointer?.previewProfile || RenderState.selectedAttackProfile;
    }

    function drawTarget() {
      if (HexSnakeReplay.isPlaybackMode() && !RenderState.targetActive) return;
      if (!RenderState.targetCell || !RenderState.snake) return;
      const profile = activeAttackPreviewProfile();
      if (!RenderState.targetActive && !RenderUI.canAttack("player", profile)) return;
      if (profile === "big" && RenderUI.characterFor("player").id === "sandworm") return;
      const { x, y } = HexSnakeGame.axialToPixel(RenderState.targetCell);
      RenderDom.ctx.beginPath();
      const previewRadius = Math.max(1, RenderUI.blastRadius(RenderState.playerStock) + (profile === "small" ? -1 : 0));
      RenderDom.ctx.arc(x, y, RenderState.cellSize * previewRadius * 1.52, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = RenderUI.canAttack("player", profile) ? "rgba(245,158,11,0.1)" : "rgba(168,179,194,0.08)";
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = RenderUI.canAttack("player", profile) ? "rgba(253,230,138,0.78)" : "rgba(168,179,194,0.36)";
      RenderDom.ctx.lineWidth = 2;
      RenderDom.ctx.setLineDash([6, 6]);
      RenderDom.ctx.stroke();
      RenderDom.ctx.setLineDash([]);
      HexSnakeGame.hexPath(x, y, RenderState.cellSize * 0.55);
      RenderDom.ctx.strokeStyle = RenderConfig.colors.target;
      RenderDom.ctx.lineWidth = 2;
      RenderDom.ctx.stroke();
    }

    function directionalPreviewState() {
      if (!RenderState.snake?.length) return null;
      const character = RenderUI.characterFor("player");
      if (activeAttackPreviewProfile() !== "big" || !RenderAI.bigAttackUsesDrawnDirection(character.id)) return null;
      if (RenderState.keyboardAttackPreview?.profile === "big" && Number.isInteger(RenderState.keyboardAttackPreview.direction)) {
        return {
          character,
          direction: RenderState.keyboardAttackPreview.direction,
          origin: RenderState.keyboardAttackPreview.origin || RenderState.snake[0],
          target: RenderState.keyboardAttackPreview.target || HexSnakeGame.opponentHeadTarget(),
          fromKeyboard: true
        };
      }
      if (RenderState.controlAttackPointer) {
        return {
          character,
          direction: RenderState.controlAttackPointer.direction,
          origin: RenderState.snake[0],
          target: HexSnakeGame.opponentHeadTarget(),
          fromControlPad: true
        };
      }
      if (!RenderState.attackPointer) return null;
      const target = character.id === "moray" && RenderState.attackPointer.moved
        ? RenderState.attackPointer.currentCell
        : HexSnakeGame.opponentHeadTarget();
      const direction = RenderState.attackPointer.moved
        ? HexSnakeGame.directionFromSourceToTarget(RenderState.attackPointer.startCell, RenderState.attackPointer.currentCell, HexSnakeGame.directionFromSourceToTarget(RenderState.snake[0], target, HexSnakeGame.ownerDirection("player")))
        : HexSnakeGame.directionFromSourceToTarget(RenderState.snake[0], target, HexSnakeGame.ownerDirection("player"));
      const origin = character.id === "moray" && RenderState.attackPointer.moved ? target : RenderState.snake[0];
      return {
        character,
        direction,
        origin,
        target,
        dragStart: RenderState.attackPointer.moved ? RenderState.attackPointer.startCell : null,
        dragTarget: RenderState.attackPointer.moved ? RenderState.attackPointer.currentCell : null
      };
    }

    function directionalPreviewPath(origin, direction, character) {
      if (!origin || !Number.isInteger(direction)) return [];
      if (character.id === "moray") return HexSnakeGame.boardLineThrough(origin, direction);
      const targetSnake = RenderState.computerSnake || [];
      const predictedPath = character.id === "lobster"
        ? HexSnakeGame.lobsterFistPath(RenderState.snake[0], direction, targetSnake)
        : [];
      if (predictedPath.length) return predictedPath;
      const path = [];
      let cursor = { q: origin.q, r: origin.r };
      for (let step = 0; step < RenderState.targetMaxHex; step += 1) {
        cursor = HexSnakeGame.nextWrappedCell(cursor, direction);
        path.push({ q: cursor.q, r: cursor.r });
      }
      return path;
    }

    function directionalPreviewKey(preview, character) {
      const originKey = preview.origin ? HexSnakeGame.keyOf(preview.origin) : "none";
      const targetKey = preview.target ? HexSnakeGame.keyOf(preview.target) : "none";
      const dragStartKey = preview.dragStart ? HexSnakeGame.keyOf(preview.dragStart) : "none";
      const dragTargetKey = preview.dragTarget ? HexSnakeGame.keyOf(preview.dragTarget) : "none";
      const playerSnakeKey = RenderState.snake?.map(HexSnakeGame.keyOf).join("|") || "";
      const computerSnakeKey = RenderState.computerSnake?.map(HexSnakeGame.keyOf).join("|") || "";
      const stockKey = RenderConfig.foodTypes.map(type => `${type.id}:${RenderState.playerStock?.[type.id] || 0}`).join("|");
      return [
        character.id,
        preview.direction,
        originKey,
        targetKey,
        dragStartKey,
        dragTargetKey,
        radius,
        RenderState.targetMaxHex,
        stockKey,
        playerSnakeKey,
        computerSnakeKey
      ].join(";");
    }

    function directionalPreviewData(preview, character) {
      const cacheKey = directionalPreviewKey(preview, character);
      if (RenderState.directionalPreviewCacheKey === cacheKey && RenderState.directionalPreviewCache) return RenderState.directionalPreviewCache;
      const path = directionalPreviewPath(preview.origin, preview.direction, character);
      const width = character.id === "moray" && path.length
        ? Math.max(0, HexSnakeGame.bandDistanceFromTotalWidth(HexSnakeGame.attackStats(RenderState.playerStock, "small").radius))
        : 0;
      const cellsForPreview = character.id === "moray" && path.length
        ? HexSnakeGame.cellsNearCells(path, width, RenderState.snake)
        : path;
      RenderState.directionalPreviewCacheKey = cacheKey;
      RenderState.directionalPreviewCache = { path, cellsForPreview };
      return RenderState.directionalPreviewCache;
    }

    function directionBetweenCells(source, target, fallbackDirection = 0) {
      if (!source || !target) return fallbackDirection;
      for (let direction = 0; direction < RenderConfig.directions.length; direction += 1) {
        if (HexSnakeGame.keyOf(HexSnakeGame.nextWrappedCell(source, direction)) === HexSnakeGame.keyOf(target)) return direction;
      }
      return fallbackDirection;
    }

    function lobsterFistTurnPathIndex() {
      const maxSteps = Math.max(1, Math.ceil((radius * 2 + 1) / 2));
      return Math.ceil(maxSteps / 2);
    }

    function drawDirectionalPreviewArrow(cell, direction, lineColor, canCast) {
      if (!cell || !Number.isInteger(direction)) return;
      const point = HexSnakeGame.axialToPixel(cell);
      const angle = HexSnakeGame.directionScreenAngle(direction);
      RenderDom.ctx.save();
      RenderDom.ctx.translate(point.x, point.y);
      RenderDom.ctx.rotate(angle * Math.PI / 180);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(RenderState.cellSize * 0.5, 0);
      RenderDom.ctx.lineTo(-RenderState.cellSize * 0.2, -RenderState.cellSize * 0.32);
      RenderDom.ctx.lineTo(-RenderState.cellSize * 0.08, 0);
      RenderDom.ctx.lineTo(-RenderState.cellSize * 0.2, RenderState.cellSize * 0.32);
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba(lineColor, canCast ? 0.9 : 0.56);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba("#ffffff", canCast ? 0.72 : 0.34);
      RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.035);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function requestPreviewDraw() {
      if (RenderState.previewDrawRafId) return;
      RenderState.previewDrawRafId = requestAnimationFrame(() => {
        RenderState.previewDrawRafId = 0;
        draw();
      });
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
      const start = HexSnakeGame.axialToPixel(preview.dragStart);
      const end = HexSnakeGame.axialToPixel(preview.dragTarget);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy);
      if (distance < RenderState.cellSize * 0.25) return;
      const pulse = waveValue(now / 680);
      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(start.x, start.y);
      RenderDom.ctx.lineTo(end.x, end.y);
      RenderDom.ctx.strokeStyle = hexToRgba(lineColor, canCast ? 0.72 + pulse * 0.16 : 0.36);
      RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.07);
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.setLineDash([RenderState.cellSize * 0.18, RenderState.cellSize * 0.14]);
      RenderDom.ctx.lineDashOffset = -now / 38;
      RenderDom.ctx.stroke();
      RenderDom.ctx.setLineDash([]);

      [start, end].forEach((point, index) => {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(point.x, point.y, RenderState.cellSize * (index ? 0.22 : 0.18), 0, Math.PI * 2);
        RenderDom.ctx.fillStyle = hexToRgba(fillColor, index ? 0.42 : 0.26);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba("#ffffff", index ? 0.5 : 0.34);
        RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.026);
        RenderDom.ctx.stroke();
      });

      RenderDom.ctx.restore();
    }

    function drawDirectionalAttackPreview(now = performance.now()) {
      const preview = directionalPreviewState();
      if (!preview) return;
      const canCast = RenderUI.canAttack("player", "big");
      const character = preview.character;
      const lineColor = canCast ? (character.line || RenderConfig.colors.target) : "#94a3b8";
      const fillColor = canCast ? (character.accent || character.color || RenderConfig.colors.target) : "#94a3b8";
      const { path, cellsForPreview } = directionalPreviewData(preview, character);
      if (!path.length) return;
      const pulse = waveValue(now / 820);

      RenderDom.ctx.save();
      RenderDom.ctx.globalCompositeOperation = "lighter";
      cellsForPreview.forEach((cell, index) => {
        const { x, y } = HexSnakeGame.axialToPixel(cell);
        const distanceFade = Math.max(0.22, 1 - index / Math.max(6, cellsForPreview.length + 2));
        HexSnakeGame.hexPath(x, y, RenderState.cellSize * (character.id === "moray" ? 0.92 : 0.72));
        RenderDom.ctx.fillStyle = hexToRgba(fillColor, (0.12 + pulse * 0.08) * distanceFade);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba(lineColor, (0.38 + pulse * 0.18) * distanceFade);
        RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.035);
        RenderDom.ctx.stroke();
      });

      const sourcePoint = HexSnakeGame.axialToPixel(preview.origin);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.moveTo(sourcePoint.x, sourcePoint.y);
      path.forEach(cell => {
        const point = HexSnakeGame.axialToPixel(cell);
        RenderDom.ctx.lineTo(point.x, point.y);
      });
      RenderDom.ctx.strokeStyle = hexToRgba(lineColor, canCast ? 0.82 : 0.46);
      RenderDom.ctx.lineWidth = Math.max(3, RenderState.cellSize * 0.1);
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.lineJoin = "round";
      RenderDom.ctx.setLineDash([RenderState.cellSize * 0.36, RenderState.cellSize * 0.2]);
      RenderDom.ctx.lineDashOffset = -now / 48;
      RenderDom.ctx.stroke();
      RenderDom.ctx.setLineDash([]);

      drawDragDirectionLine(preview, lineColor, fillColor, canCast, now);
      drawDirectionalPreviewArrows(preview, path, lineColor, canCast);

      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(sourcePoint.x, sourcePoint.y, RenderState.cellSize * 0.42, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = hexToRgba(fillColor, canCast ? 0.22 : 0.12);
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = hexToRgba(lineColor, canCast ? 0.86 : 0.42);
      RenderDom.ctx.lineWidth = Math.max(1.5, RenderState.cellSize * 0.05);
      RenderDom.ctx.stroke();
      RenderDom.ctx.restore();
    }

    function drawHazards() {
      const now = performance.now();
      RenderState.hazards.forEach(hazard => {
        if (now < hazard.startedAt || now > hazard.endAt) return;
        const progress = (now - hazard.startedAt) / Math.max(1, hazard.endAt - hazard.startedAt);
        const alpha = 0.24 * (1 - progress * 0.55);
        const blastCharacter = HexSnakeGame.characterForVisualType(hazard.owner, hazard.visualType);
        if (hazard.kind === "radiation") {
          const { x, y } = HexSnakeGame.axialToPixel(hazard.target);
          const radiusPx = RenderState.cellSize * Math.max(1, hazard.radius || hazard.width || 1) * 1.52;
          const radiationPlan = effectVisualPlanFor(hazard.visualType, "radiation", blastCharacter);
          drawElementCircleTexture(x, y, radiusPx, progress, blastCharacter, radiationPlan.textureAlpha, {
            seed: `${hazard.visualType}:${hazard.startedAt}`,
            density: radiationPlan.density,
            size: radiationPlan.size,
            maxParticles: Math.min(radiationPlan.maxParticles, 56),
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
        const hazardCells = cachedEffectCells(hazard, "visualCells", hazard.cells, hazard.width, hazard.visualExcludedCells || [], hazard.minDistance || 0);
        const hazardPlan = effectVisualPlanFor(hazard.visualType, "hazard", blastCharacter);
        drawElementCellTextureWash(hazardCells, blastCharacter, progress, hazardPlan.textureAlpha * (1 - progress * 0.18), {
          seed: `${hazard.visualType}:${hazard.startedAt}`,
          persistent: hazardPlan.persistent,
          maxParticles: Math.min(hazardPlan.maxParticles, (hazard.visualType || "").startsWith("quetzal") ? 48 : 56),
          perCell: hazardPlan.perCell,
          size: hazardPlan.size,
          drift: hazardPlan.drift,
          spin: hazardPlan.spin
        });
        hazardCells.forEach(cell => {
          const { x, y } = HexSnakeGame.axialToPixel(cell);
          if ((hazard.visualType || "").startsWith("quetzal")) {
            const variant = HexSnakeGame.stableVariantIndex(cell, hazard.startedAt || 0, 64);
            drawSwampForestBloom(x, y, RenderState.cellSize * 1.34, progress + (cell.q + cell.r) * 0.035, blastCharacter, 0.94 * (1 - progress * 0.08), variant);
            return;
          }
          drawElementAura(x, y, RenderState.cellSize * 0.86, progress + (cell.q - cell.r) * 0.03, blastCharacter, 0.24);
          HexSnakeGame.hexPath(x, y, RenderState.cellSize * 0.9);
          RenderDom.ctx.fillStyle = hexToRgba(blastCharacter.accent || blastCharacter.color, alpha + 0.08);
          RenderDom.ctx.fill();
          RenderDom.ctx.strokeStyle = hexToRgba(blastCharacter.line, alpha + 0.34);
          RenderDom.ctx.lineWidth = Math.max(1.5, RenderState.cellSize * 0.045);
          RenderDom.ctx.stroke();
        });
      });
    }

    function drawLineBlast(blast, progress, alpha, character) {
      const textureCells = cachedEffectCells(blast, "visualCells", blast.lineCells, blast.width, blast.excludedCells);
      const linePlan = effectVisualPlanFor(blast.visualType, "line", character);
      drawElementCellTextureWash(textureCells, character, progress, linePlan.textureAlpha * alpha, {
        seed: `${blast.visualType}:${blast.startedAt}`,
        maxParticles: Math.min(linePlan.maxParticles, 72),
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
          const { x, y } = HexSnakeGame.axialToPixel(cell);
          drawElementAura(x, y, RenderState.cellSize * 1.04, progress + index * 0.04, character, 0.36 * alpha);
          if (index % 2 === 0) drawPulseRing(x, y, RenderState.cellSize * 0.84, progress, character.color, character.line, 0.86);
        });
        if (cells.length) {
          const head = HexSnakeGame.axialToPixel(cells[Math.min(cells.length - 1, Math.floor(cells.length * (0.58 + progress * 0.42)))]);
          drawEnergyBeamBurst(head.x, head.y, RenderState.cellSize * Math.max(1.9, (blast.width || 1) + 1.2), progress, character, alpha);
        }
        return;
      }
      textureCells.forEach(cell => {
        const { x, y } = HexSnakeGame.axialToPixel(cell);
        drawElementAura(x, y, RenderState.cellSize * 0.86, progress + cell.r * 0.04, character, 0.32 * alpha);
        HexSnakeGame.hexPath(x, y, RenderState.cellSize * 0.94);
        RenderDom.ctx.fillStyle = hexToRgba(character.accent || character.color, 0.5 * alpha);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = hexToRgba("#ffffff", 0.82 * alpha);
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.06);
        RenderDom.ctx.stroke();
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
      const { x, y } = HexSnakeGame.axialToPixel(blast.target);
      const radiusPx = RenderState.cellSize * (blast.radius || RenderConfig.baseBlastHexRadius) * 1.52;
      const type = blast.visualType || HexSnakeGame.attackVisualType(blast.owner, "big");
      drawCircleImpactAt(x, y, radiusPx, progress, alpha, character, type, blast.hand || "right");
    }

    function drawBlasts() {
      const now = performance.now();
      RenderState.blasts.forEach(blast => {
        const progress = Math.min(1, (now - blast.startedAt) / RenderConfig.blastDurationMs);
        const alpha = 1 - progress;
        const blastCharacter = HexSnakeGame.characterForVisualType(blast.owner, blast.visualType);
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
      const rect = RenderDom.playArea.getBoundingClientRect();
      const progress = (now % 1400) / 1400;
      const oldCellSize = RenderState.cellSize;
      const rowCount = Math.max(1, RenderUI.characterList().length);
      const compactComparison = rect.width < 560;
      const headerHeight = compactComparison ? 54 : Math.min(64, Math.max(50, rect.height * 0.09));
      const rowHeight = (rect.height - headerHeight - 16) / rowCount;
      const labelWidth = compactComparison ? Math.min(96, rect.width * 0.25) : Math.min(150, rect.width * 0.2);
      const smallX = labelWidth + (rect.width - labelWidth) * 0.28;
      const bigX = labelWidth + (rect.width - labelWidth) * 0.72;
      RenderState.cellSize = Math.max(11, Math.min(28, rowHeight * 0.18, rect.width * 0.018));

      RenderDom.ctx.clearRect(0, 0, rect.width, rect.height);
      RenderDom.ctx.fillStyle = "#111720";
      RenderDom.ctx.fillRect(0, 0, rect.width, rect.height);
      RenderDom.ctx.fillStyle = "#e5e7eb";
      RenderDom.ctx.textAlign = "left";
      RenderDom.ctx.textBaseline = "middle";
      RenderDom.ctx.font = `${compactComparison ? "700 18px" : "700 18px"} system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
      RenderDom.ctx.fillText("Skill Effect Comparison", 18, compactComparison ? headerHeight * 0.36 : headerHeight * 0.38);
      if (!compactComparison) {
        RenderDom.ctx.font = "600 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        RenderDom.ctx.fillStyle = "#cbd5e1";
        RenderDom.ctx.fillText("Small: cast + projectile + impact", 18, headerHeight * 0.72);
      }
      RenderDom.ctx.textAlign = "center";
      RenderDom.ctx.fillStyle = "#fde68a";
      RenderDom.ctx.fillText("Small", smallX, headerHeight - 12);
      RenderDom.ctx.fillStyle = "#fca5a5";
      RenderDom.ctx.fillText("Ultimate", bigX, headerHeight - 12);

      RenderUI.characterList().forEach((character, index) => {
        const y = headerHeight + rowHeight * (index + 0.5);
        const radiusPx = Math.max(22, rowHeight * 0.2);
        RenderDom.ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
        RenderDom.ctx.lineWidth = 1;
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(12, headerHeight + rowHeight * index);
        RenderDom.ctx.lineTo(rect.width - 12, headerHeight + rowHeight * index);
        RenderDom.ctx.stroke();

        RenderDom.ctx.textAlign = "left";
        RenderDom.ctx.fillStyle = "#e5e7eb";
        RenderDom.ctx.font = "700 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        RenderDom.ctx.fillText(character.id, 18, y - 10);
        RenderDom.ctx.fillStyle = character.accent || character.line || "#cbd5e1";
        RenderDom.ctx.font = "600 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        RenderDom.ctx.fillText(character.smallMove || "small", 18, y + 10);

        RenderDom.ctx.save();
        RenderDom.ctx.beginPath();
        RenderDom.ctx.rect(labelWidth, headerHeight + rowHeight * index + 1, rect.width - labelWidth - 12, rowHeight - 2);
        RenderDom.ctx.clip();
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
        RenderDom.ctx.restore();
        RenderDom.ctx.textAlign = "center";
        RenderDom.ctx.fillStyle = "rgba(248, 250, 252, 0.78)";
        RenderDom.ctx.font = "600 10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        RenderDom.ctx.fillText(bigType.replace(`${character.id}-`, ""), bigX, y + rowHeight * 0.33);
      });
      RenderState.cellSize = oldCellSize;
    }

    function drawStatusStar(x, y, size, angle, color, alpha) {
      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle);
      RenderDom.ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const r = i % 2 === 0 ? size : size * 0.42;
        const a = -Math.PI / 2 + i * Math.PI / 4;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) RenderDom.ctx.moveTo(px, py);
        else RenderDom.ctx.lineTo(px, py);
      }
      RenderDom.ctx.closePath();
      RenderDom.ctx.fillStyle = hexToRgba(color, alpha);
      RenderDom.ctx.fill();
      RenderDom.ctx.restore();
    }

    function drawStatusEffects(now) {
      drawOwnerStatus("computer", now);
      drawOwnerStatus("player", now);
    }

    function drawOwnerStatus(owner, now) {
      const parts = RenderAI.ownerSnake(owner);
      if (!parts || !parts.length) return;
      const head = HexSnakeGame.axialToPixel(parts[0]);
      const character = RenderUI.characterFor(owner);
      const stunned = now < RenderAI.ownerStunUntil(owner);
      const slowed = now < RenderAI.ownerSlowUntil(owner);
      const collisionLocked = RenderAI.ownerCollisionParalysis(owner) > 0 && stunned;
      if (!stunned && !slowed && !collisionLocked) return;

      RenderDom.ctx.save();
      if (slowed) {
        const pulse = waveValue(now / 1400);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(head.x, head.y + RenderState.cellSize * 0.06, RenderState.cellSize * (0.74 + pulse * 0.18), RenderState.cellSize * 0.46, 0, 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba("#93c5fd", 0.54);
        RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.045);
        RenderDom.ctx.setLineDash([RenderState.cellSize * 0.16, RenderState.cellSize * 0.12]);
        RenderDom.ctx.stroke();
        RenderDom.ctx.setLineDash([]);
        for (let i = 1; i < Math.min(parts.length, 4); i += 1) {
          const cell = HexSnakeGame.axialToPixel(parts[i]);
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(cell.x - RenderState.cellSize * 0.26, cell.y - RenderState.cellSize * 0.16);
          RenderDom.ctx.quadraticCurveTo(cell.x, cell.y + RenderState.cellSize * 0.2, cell.x + RenderState.cellSize * 0.26, cell.y - RenderState.cellSize * 0.1);
          RenderDom.ctx.strokeStyle = hexToRgba("#bfdbfe", 0.22);
          RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.035);
          RenderDom.ctx.stroke();
        }
      }

      if (stunned) {
        const spin = now / 620;
        const orbit = RenderState.cellSize * 0.92;
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(head.x, head.y, orbit, 0, Math.PI * 2);
        RenderDom.ctx.strokeStyle = hexToRgba(character.line, 0.42);
        RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.035);
        RenderDom.ctx.stroke();
        for (let i = 0; i < 5; i += 1) {
          const angle = spin + i * Math.PI * 2 / 5;
          drawStatusStar(
            head.x + Math.cos(angle) * orbit,
            head.y + Math.sin(angle) * orbit * 0.72,
            RenderState.cellSize * 0.14,
            angle,
            i % 2 ? character.accent : character.line,
            0.84
          );
        }
      }

      if (collisionLocked) {
        for (let i = 0; i < 6; i += 1) {
          const angle = i * Math.PI * 2 / 6 + waveValue(now / 420, i * 0.1) * 0.28;
          const inner = RenderState.cellSize * 0.42;
          const outer = RenderState.cellSize * 0.92;
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(head.x + Math.cos(angle) * inner, head.y + Math.sin(angle) * inner);
          RenderDom.ctx.lineTo(head.x + Math.cos(angle + 0.13) * outer, head.y + Math.sin(angle + 0.13) * outer);
          RenderDom.ctx.strokeStyle = hexToRgba("#fef3c7", 0.58);
          RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.04);
          RenderDom.ctx.stroke();
        }
      }
      RenderDom.ctx.restore();
    }

    function drawFoodToken(x, y, tokenTypes) {
      const types = Array.isArray(tokenTypes) ? tokenTypes : [tokenTypes];
      const type = types[0];
      const secondaryType = types[1];
      if (!type) return;
      const size = RenderState.cellSize * 0.62;
      RenderDom.ctx.save();
      RenderDom.ctx.shadowColor = "rgba(0,0,0,0.42)";
      RenderDom.ctx.shadowBlur = 10;
      RenderDom.ctx.shadowOffsetY = 4;
      RenderDom.ctx.fillStyle = type.color;
      RenderDom.ctx.strokeStyle = "#f8fafc";
      RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.09);

      if (type.id === "black") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, size * 0.78, 0, Math.PI * 2);
      } else if (type.id === "protein") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, size * 0.74, 0, Math.PI * 2);
      } else if (type.id === "fat") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x, y - size * 0.82);
        RenderDom.ctx.lineTo(x + size * 0.82, y);
        RenderDom.ctx.lineTo(x, y + size * 0.82);
        RenderDom.ctx.lineTo(x - size * 0.82, y);
        RenderDom.ctx.closePath();
      } else if (type.id === "fiber") {
        RenderDom.ctx.beginPath();
        for (let i = 0; i < 5; i += 1) {
          const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
          const px = x + Math.cos(angle) * size * 0.82;
          const py = y + Math.sin(angle) * size * 0.82;
          if (i === 0) RenderDom.ctx.moveTo(px, py);
          else RenderDom.ctx.lineTo(px, py);
        }
        RenderDom.ctx.closePath();
      } else {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x, y - size * 0.9);
        RenderDom.ctx.lineTo(x + size * 0.82, y + size * 0.58);
        RenderDom.ctx.lineTo(x - size * 0.82, y + size * 0.58);
        RenderDom.ctx.closePath();
      }

      if (secondaryType) {
        RenderDom.ctx.save();
        RenderDom.ctx.clip();
        RenderDom.ctx.fillStyle = type.color;
        RenderDom.ctx.fillRect(x - size, y - size, size, size * 2);
        RenderDom.ctx.fillStyle = secondaryType.color;
        RenderDom.ctx.fillRect(x, y - size, size, size * 2);
        RenderDom.ctx.restore();
      } else {
        RenderDom.ctx.fill();
      }
      RenderDom.ctx.stroke();
      RenderDom.ctx.shadowColor = "transparent";

      RenderDom.ctx.strokeStyle = "#111720";
      RenderDom.ctx.fillStyle = "#111720";
      RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.08);
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.lineJoin = "round";
      if (type.id === "black") {
        RenderDom.ctx.strokeStyle = "#e5e7eb";
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.07);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x - size * 0.38, y);
        for (let i = 0; i < 6; i += 1) {
          const px = x - size * 0.28 + i * size * 0.12;
          const py = y + (i % 2 === 0 ? -size * 0.16 : size * 0.16);
          RenderDom.ctx.lineTo(px, py);
        }
        RenderDom.ctx.lineTo(x + size * 0.38, y);
        RenderDom.ctx.stroke();
        RenderDom.ctx.fillStyle = "#e5e7eb";
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x - size * 0.38, y, size * 0.1, 0, Math.PI * 2);
        RenderDom.ctx.fill();
      } else if (type.id === "protein") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x - size * 0.32, y - size * 0.08);
        RenderDom.ctx.bezierCurveTo(x - size * 0.18, y - size * 0.36, x + size * 0.22, y - size * 0.36, x + size * 0.34, y - size * 0.04);
        RenderDom.ctx.bezierCurveTo(x + size * 0.14, y + size * 0.1, x - size * 0.12, y + size * 0.24, x - size * 0.3, y + size * 0.36);
        RenderDom.ctx.stroke();
      } else if (type.id === "fat") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
        RenderDom.ctx.fill();
      } else if (type.id === "fiber") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x, y + size * 0.44);
        RenderDom.ctx.quadraticCurveTo(x - size * 0.18, y - size * 0.06, x + size * 0.34, y - size * 0.42);
        RenderDom.ctx.moveTo(x - size * 0.02, y + size * 0.1);
        RenderDom.ctx.lineTo(x - size * 0.34, y - size * 0.16);
        RenderDom.ctx.moveTo(x + size * 0.08, y - size * 0.1);
        RenderDom.ctx.lineTo(x + size * 0.38, y + size * 0.02);
        RenderDom.ctx.stroke();
      } else {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x - size * 0.3, y - size * 0.08);
        RenderDom.ctx.lineTo(x, y + size * 0.24);
        RenderDom.ctx.lineTo(x + size * 0.3, y - size * 0.08);
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
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
      RenderDom.ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = Math.PI / 180 * (60 * i - 30);
        const px = size * Math.cos(angle);
        const py = size * Math.sin(angle);
        if (i === 0) RenderDom.ctx.moveTo(px, py);
        else RenderDom.ctx.lineTo(px, py);
      }
      RenderDom.ctx.closePath();
    }

    function strokeHeadEye(x, y, radius, fill = "#111720") {
      RenderDom.ctx.beginPath();
      RenderDom.ctx.arc(x, y, radius, 0, Math.PI * 2);
      RenderDom.ctx.fillStyle = fill;
      RenderDom.ctx.fill();
      RenderDom.ctx.strokeStyle = "rgba(255,255,255,0.56)";
      RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.028);
      RenderDom.ctx.stroke();
    }

    function drawMirroredPath(points, scaleY = 1) {
      RenderDom.ctx.beginPath();
      points.forEach(([px, py], index) => {
        if (index === 0) RenderDom.ctx.moveTo(px, py * scaleY);
        else RenderDom.ctx.lineTo(px, py * scaleY);
      });
      RenderDom.ctx.stroke();
    }

    function drawSnakeHeadDetail(x, y, palette) {
      const character = palette.character;
      if (!character) return;
      const headSize = RenderState.cellSize * 0.82;
      const angle = RenderConfig.directions[palette.direction ?? 0]?.angle ?? -90;
      const accent = character.accent || palette.headLine;
      const line = character.line || palette.headLine;

      RenderDom.ctx.save();
      RenderDom.ctx.translate(x, y);
      RenderDom.ctx.rotate(angle * Math.PI / 180);
      drawLocalHex(headSize * 0.94);
      RenderDom.ctx.clip();
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.lineJoin = "round";

      RenderDom.ctx.fillStyle = hexToRgba("#ffffff", palette.owner === "computer" ? 0.1 : 0.16);
      RenderDom.ctx.beginPath();
      RenderDom.ctx.ellipse(headSize * 0.06, -headSize * 0.24, headSize * 0.42, headSize * 0.16, -0.25, 0, Math.PI * 2);
      RenderDom.ctx.fill();

      if (character.id === "dragon") {
        RenderDom.ctx.strokeStyle = line;
        RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * 0.055);
        drawMirroredPath([[-headSize * 0.2, -headSize * 0.18], [headSize * 0.1, -headSize * 0.26], [headSize * 0.42, -headSize * 0.08]]);
        drawMirroredPath([[-headSize * 0.2, -headSize * 0.18], [headSize * 0.1, -headSize * 0.26], [headSize * 0.42, -headSize * 0.08]], -1);
        RenderDom.ctx.fillStyle = accent;
        [[-0.18, -0.46], [0.02, -0.42], [-0.18, 0.46], [0.02, 0.42]].forEach(([hx, hy]) => {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(headSize * hx, headSize * hy);
          RenderDom.ctx.lineTo(headSize * (hx + 0.2), headSize * (hy * 0.58));
          RenderDom.ctx.lineTo(headSize * (hx - 0.05), headSize * (hy * 0.22));
          RenderDom.ctx.closePath();
          RenderDom.ctx.fill();
        });
        strokeHeadEye(headSize * 0.22, -headSize * 0.18, Math.max(2, RenderState.cellSize * 0.07));
      } else if (character.id === "sandworm") {
        RenderDom.ctx.strokeStyle = line;
        RenderDom.ctx.lineWidth = Math.max(1.8, RenderState.cellSize * 0.065);
        for (let i = -1; i <= 1; i += 1) {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.ellipse(headSize * (0.08 - i * 0.16), 0, headSize * 0.18, headSize * 0.52, 0, 0, Math.PI * 2);
          RenderDom.ctx.stroke();
        }
        RenderDom.ctx.fillStyle = "#111720";
        RenderDom.ctx.beginPath();
        RenderDom.ctx.ellipse(headSize * 0.42, 0, headSize * 0.18, headSize * 0.34, 0, 0, Math.PI * 2);
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = accent;
        RenderDom.ctx.lineWidth = Math.max(1.2, RenderState.cellSize * 0.04);
        [-0.45, -0.15, 0.15, 0.45].forEach(offset => {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(headSize * 0.28, headSize * offset);
          RenderDom.ctx.lineTo(headSize * 0.48, headSize * offset * 0.55);
          RenderDom.ctx.stroke();
        });
      } else if (character.id === "quetzal") {
        RenderDom.ctx.fillStyle = accent;
        [-0.42, -0.2, 0.02, 0.24].forEach((fy, index) => {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(-headSize * 0.36 + index * headSize * 0.08, headSize * fy);
          RenderDom.ctx.lineTo(-headSize * 0.04 + index * headSize * 0.08, headSize * (fy - 0.22));
          RenderDom.ctx.lineTo(headSize * 0.06 + index * headSize * 0.05, headSize * (fy + 0.02));
          RenderDom.ctx.closePath();
          RenderDom.ctx.fill();
        });
        RenderDom.ctx.strokeStyle = line;
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * 0.052);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(-headSize * 0.28, headSize * 0.28);
        RenderDom.ctx.quadraticCurveTo(headSize * 0.12, -headSize * 0.24, headSize * 0.42, -headSize * 0.02);
        RenderDom.ctx.stroke();
        strokeHeadEye(headSize * 0.18, -headSize * 0.16, Math.max(2, RenderState.cellSize * 0.065));
      } else if (character.id === "moray") {
        RenderDom.ctx.strokeStyle = accent;
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.075);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(-headSize * 0.44, headSize * 0.12);
        RenderDom.ctx.quadraticCurveTo(-headSize * 0.02, -headSize * 0.2, headSize * 0.48, -headSize * 0.04);
        RenderDom.ctx.stroke();
        RenderDom.ctx.strokeStyle = line;
        RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * 0.046);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(headSize * 0.12, headSize * 0.16);
        RenderDom.ctx.lineTo(headSize * 0.48, headSize * 0.16);
        RenderDom.ctx.stroke();
        RenderDom.ctx.fillStyle = "#f8fafc";
        [-0.02, 0.12, 0.26].forEach(tx => {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(headSize * tx, headSize * 0.16);
          RenderDom.ctx.lineTo(headSize * (tx + 0.07), headSize * 0.29);
          RenderDom.ctx.lineTo(headSize * (tx + 0.13), headSize * 0.16);
          RenderDom.ctx.closePath();
          RenderDom.ctx.fill();
        });
        strokeHeadEye(headSize * 0.22, -headSize * 0.16, Math.max(2, RenderState.cellSize * 0.065));
      } else if (character.id === "gu_king") {
        RenderDom.ctx.strokeStyle = accent;
        RenderDom.ctx.lineWidth = Math.max(1.6, RenderState.cellSize * 0.06);
        [-0.36, -0.18, 0, 0.18, 0.36].forEach(offset => {
          RenderDom.ctx.beginPath();
          RenderDom.ctx.moveTo(-headSize * 0.36, headSize * offset);
          RenderDom.ctx.lineTo(-headSize * 0.5, headSize * (offset + Math.sign(offset || 1) * 0.14));
          RenderDom.ctx.stroke();
        });
        RenderDom.ctx.fillStyle = hexToRgba(accent, 0.84);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(headSize * 0.02, -headSize * 0.36);
        RenderDom.ctx.lineTo(headSize * 0.18, -headSize * 0.16);
        RenderDom.ctx.lineTo(headSize * 0.34, -headSize * 0.36);
        RenderDom.ctx.lineTo(headSize * 0.42, -headSize * 0.1);
        RenderDom.ctx.lineTo(headSize * 0.1, headSize * 0.02);
        RenderDom.ctx.closePath();
        RenderDom.ctx.fill();
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(headSize * 0.02, headSize * 0.36);
        RenderDom.ctx.lineTo(headSize * 0.18, headSize * 0.16);
        RenderDom.ctx.lineTo(headSize * 0.34, headSize * 0.36);
        RenderDom.ctx.lineTo(headSize * 0.42, headSize * 0.1);
        RenderDom.ctx.lineTo(headSize * 0.1, -headSize * 0.02);
        RenderDom.ctx.closePath();
        RenderDom.ctx.fill();
        strokeHeadEye(headSize * 0.2, -headSize * 0.12, Math.max(2, RenderState.cellSize * 0.06), "#0f172a");
        strokeHeadEye(headSize * 0.2, headSize * 0.12, Math.max(2, RenderState.cellSize * 0.06), "#0f172a");
      } else {
        RenderDom.ctx.strokeStyle = line;
        RenderDom.ctx.lineWidth = Math.max(1.7, RenderState.cellSize * 0.062);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(-headSize * 0.16, -headSize * 0.36);
        RenderDom.ctx.quadraticCurveTo(headSize * 0.18, -headSize * 0.34, headSize * 0.38, -headSize * 0.08);
        RenderDom.ctx.stroke();
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(-headSize * 0.16, headSize * 0.36);
        RenderDom.ctx.quadraticCurveTo(headSize * 0.18, headSize * 0.34, headSize * 0.38, headSize * 0.08);
        RenderDom.ctx.stroke();
        RenderDom.ctx.strokeStyle = accent;
        RenderDom.ctx.lineWidth = Math.max(2, RenderState.cellSize * 0.07);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(-headSize * 0.42, -headSize * 0.18);
        RenderDom.ctx.lineTo(-headSize * 0.1, -headSize * 0.02);
        RenderDom.ctx.lineTo(-headSize * 0.42, headSize * 0.18);
        RenderDom.ctx.stroke();
        strokeHeadEye(headSize * 0.18, -headSize * 0.12, Math.max(2, RenderState.cellSize * 0.06));
        strokeHeadEye(headSize * 0.18, headSize * 0.12, Math.max(2, RenderState.cellSize * 0.06));
      }

      RenderDom.ctx.restore();
    }

    function drawSnake(parts, palette) {
      RenderDom.ctx.save();
      RenderDom.ctx.globalAlpha *= palette.alpha ?? 1;
      parts.forEach((segment, index) => {
        const { x, y } = HexSnakeGame.axialToPixel(segment);
        HexSnakeGame.hexPath(x, y, RenderState.cellSize * (index === 0 ? 0.82 : 0.76));
        RenderDom.ctx.fillStyle = index === 0 ? palette.head : palette.body;
        RenderDom.ctx.fill();
        RenderDom.ctx.strokeStyle = index === 0 ? palette.headLine : palette.bodyLine;
        RenderDom.ctx.lineWidth = index === 0 ? 3 : 1.5;
        RenderDom.ctx.stroke();
        drawSnakeOwnerMark(x, y, index, palette);
        if (index === 0) {
          drawSnakeHeadDetail(x, y, palette);
        }
        drawSnakeSegmentDetail(x, y, index, palette);

      });
      RenderDom.ctx.restore();
    }

    function drawSnakeOwnerMark(x, y, index, palette) {
      RenderDom.ctx.save();
      RenderDom.ctx.strokeStyle = palette.ownerColor || palette.headLine;
      RenderDom.ctx.lineWidth = index === 0 ? Math.max(2, RenderState.cellSize * 0.1) : Math.max(1.2, RenderState.cellSize * 0.055);
      RenderDom.ctx.setLineDash(palette.owner === "computer" ? [Math.max(3, RenderState.cellSize * 0.14), Math.max(2, RenderState.cellSize * 0.1)] : []);
      HexSnakeGame.hexPath(x, y, RenderState.cellSize * (index === 0 ? 0.9 : 0.82));
      RenderDom.ctx.stroke();
      RenderDom.ctx.setLineDash([]);
      RenderDom.ctx.restore();
    }

    function drawSnakeSegmentDetail(x, y, index, palette) {
      const character = palette.character;
      if (!character || index === 0) return;
      RenderDom.ctx.save();
      RenderDom.ctx.lineCap = "round";
      RenderDom.ctx.lineJoin = "round";
      RenderDom.ctx.strokeStyle = index === 0 ? character.accent : hexToRgba(character.line, 0.88);
      RenderDom.ctx.fillStyle = hexToRgba(character.accent, index === 0 ? 0.95 : 0.72);
      RenderDom.ctx.lineWidth = Math.max(1.4, RenderState.cellSize * 0.055);

      if (palette.owner === "computer") {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, RenderState.cellSize * (index === 0 ? 0.58 : 0.5), Math.PI * 0.18, Math.PI * 0.82);
        RenderDom.ctx.stroke();
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, RenderState.cellSize * (index === 0 ? 0.58 : 0.5), Math.PI * 1.18, Math.PI * 1.82);
        RenderDom.ctx.stroke();
      } else {
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x - RenderState.cellSize * 0.42, y);
        RenderDom.ctx.lineTo(x + RenderState.cellSize * 0.42, y);
        RenderDom.ctx.stroke();
        RenderDom.ctx.beginPath();
        RenderDom.ctx.arc(x, y, Math.max(2, RenderState.cellSize * 0.09), 0, Math.PI * 2);
        RenderDom.ctx.fill();
      }

      if (index > 0 && index % 2 === 0) {
        RenderDom.ctx.strokeStyle = hexToRgba("#ffffff", 0.48);
        RenderDom.ctx.lineWidth = Math.max(1, RenderState.cellSize * 0.035);
        RenderDom.ctx.beginPath();
        RenderDom.ctx.moveTo(x - RenderState.cellSize * 0.22, y - RenderState.cellSize * 0.26);
        RenderDom.ctx.lineTo(x + RenderState.cellSize * 0.22, y + RenderState.cellSize * 0.26);
        RenderDom.ctx.stroke();
      }
      RenderDom.ctx.restore();
    }
