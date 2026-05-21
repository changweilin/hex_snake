    const AudioStorage = HexSnakeRuntime.storage;
    let sfxContext = null;
    let sfxMaster = null;
    let sfxNoiseBuffer = null;
    let sfxUnlocked = false;
    let sfxMuted = AudioStorage.get("hexSnakeSfxMuted") === "1";
    HexSnakeState.audio.muted = sfxMuted;
    HexSnakeState.audio.unlocked = sfxUnlocked;
    const sfxLastPlayedAt = new Map();
    const sfxAssetCache = new Map();

    const sfxVariantProfiles = {
      beast: { pitch: 0.82, noise: 1.2, attack: 1.15, decay: 0.9, color: 0.9 },
      chibi: { pitch: 1.35, noise: 0.75, attack: 0.78, decay: 0.72, color: 1.18 },
      human: { pitch: 1.05, noise: 0.52, attack: 0.88, decay: 0.82, color: 1.05 }
    };

    const sfxCharacterProfiles = {
      dragon: { base: 520, wave: "sine", accent: 2.02, noise: "air", color: "#f8fafc" },
      sandworm: { base: 145, wave: "triangle", accent: 0.54, noise: "sand", color: "#facc15" },
      quetzal: { base: 430, wave: "sine", accent: 1.5, noise: "wind", color: "#22c55e" },
      moray: { base: 255, wave: "sawtooth", accent: 2.6, noise: "spark", color: "#3b82f6" },
      lobster: { base: 310, wave: "triangle", accent: 1.72, noise: "ghost", color: "#a78bfa" },
      gu_king: { base: 190, wave: "square", accent: 1.28, noise: "venom", color: "#84cc16" }
    };

    const sfxEventProfiles = {
      select: { duration: 0.16, gain: 0.12, cooldown: 80 },
      start: { duration: 0.34, gain: 0.16, cooldown: 260 },
      small: { duration: 0.2, gain: 0.13, cooldown: 130 },
      big: { duration: 0.72, gain: 0.18, cooldown: 420 },
      victory: { duration: 0.62, gain: 0.17, cooldown: 320 },
      defeat: { duration: 0.58, gain: 0.14, cooldown: 320 }
    };

    function ensureAudioContext() {
      if (sfxContext) return sfxContext;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      sfxContext = new AudioContextClass();
      sfxMaster = sfxContext.createGain();
      sfxMaster.gain.value = 0.55;
      sfxMaster.connect(sfxContext.destination);
      return sfxContext;
    }

    function unlockSfx() {
      if (sfxMuted) return false;
      const context = ensureAudioContext();
      if (!context) return false;
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }
      sfxUnlocked = true;
      HexSnakeState.audio.unlocked = sfxUnlocked;
      return true;
    }

    function setSfxMuted(muted) {
      sfxMuted = Boolean(muted);
      HexSnakeState.audio.muted = sfxMuted;
      HexSnakeDOM.sfxMuteToggle.checked = sfxMuted;
      AudioStorage.set("hexSnakeSfxMuted", sfxMuted ? "1" : "0");
      if (sfxMuted && sfxContext?.state === "running") {
        sfxContext.suspend().catch(() => {});
      } else if (!sfxMuted) {
        unlockSfx();
      }
    }

    function sfxNow() {
      return sfxContext ? sfxContext.currentTime : 0;
    }

    function sfxAssetMode() {
      return HexSnakeState.ui.portraitVariantMode === "human" ? "human" : "beast";
    }

    function deployAudioUrl(url) {
      if (
        window.__HEX_SNAKE_AUDIO_FORMAT__ === "m4a"
        && typeof url === "string"
        && /^assets\/audio\/characters\/.+\.wav$/i.test(url)
      ) {
        return url.replace(/\.wav$/i, ".m4a");
      }
      return url;
    }

    function sfxAssetUrl(character, eventName) {
      const characterId = character?.id || "dragon";
      return deployAudioUrl(`assets/audio/characters/${sfxAssetMode()}/${characterId}_${eventName}.wav`);
    }

    function getSfxAssetBuffer(url) {
      const cached = sfxAssetCache.get(url);
      if (cached?.buffer) return cached.buffer;
      if (cached?.failed) return null;
      if (cached?.pending) return null;
      const context = ensureAudioContext();
      if (!context) return null;
      const entry = { buffer: null, pending: true, failed: false };
      sfxAssetCache.set(url, entry);
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then(arrayBuffer => context.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          entry.buffer = audioBuffer;
          entry.pending = false;
        })
        .catch(() => {
          entry.pending = false;
          entry.failed = true;
        });
      return null;
    }

    function preloadCharacterSfx(character, events = ["small", "big"]) {
      if (!character) return;
      events.forEach(eventName => getSfxAssetBuffer(sfxAssetUrl(character, eventName)));
    }

    function warmupSfx(charactersToPreload = []) {
      if (sfxMuted) return false;
      const context = ensureAudioContext();
      if (!context) return false;
      sfxNoise();
      charactersToPreload.forEach(character => preloadCharacterSfx(character));
      return true;
    }

    function playSfxAssetBuffer(buffer, time, gain, pan) {
      const context = ensureAudioContext();
      if (!context || !sfxMaster || !buffer) return false;
      const source = context.createBufferSource();
      const envelope = context.createGain();
      const stereo = context.createStereoPanner ? context.createStereoPanner() : null;
      source.buffer = buffer;
      envelope.gain.value = Math.min(0.82, gain * 2.9);
      source.connect(envelope);
      if (stereo) {
        stereo.pan.value = Math.max(-1, Math.min(1, pan));
        envelope.connect(stereo);
        stereo.connect(sfxMaster);
      } else {
        envelope.connect(sfxMaster);
      }
      source.start(time);
      return true;
    }

    function sfxGainForOwner(owner, eventName) {
      if (owner !== "computer") return 1;
      return eventName === "victory" || eventName === "defeat" ? 0.7 : 0.45;
    }

    function characterSfxProfile(characterId, variantMode = HexSnakeState.ui.portraitVariantMode) {
      const characterProfile = sfxCharacterProfiles[characterId] || sfxCharacterProfiles.dragon;
      const variantProfile = sfxVariantProfiles[variantMode] || sfxVariantProfiles.chibi;
      return {
        ...characterProfile,
        variant: variantMode,
        pitch: variantProfile.pitch,
        noiseScale: variantProfile.noise,
        attackScale: variantProfile.attack,
        decayScale: variantProfile.decay,
        colorScale: variantProfile.color
      };
    }

    function sfxNoise() {
      const context = ensureAudioContext();
      if (!context) return null;
      if (sfxNoiseBuffer) return sfxNoiseBuffer;
      const sampleCount = Math.max(1, Math.floor(context.sampleRate * 0.5));
      sfxNoiseBuffer = context.createBuffer(1, sampleCount, context.sampleRate);
      const data = sfxNoiseBuffer.getChannelData(0);
      for (let index = 0; index < sampleCount; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }
      return sfxNoiseBuffer;
    }

    function scheduleEnvelope(gainNode, start, duration, peak, attack = 0.012) {
      const safePeak = Math.max(0.0001, peak);
      const safeAttack = Math.max(0.004, Math.min(duration * 0.35, attack));
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.exponentialRampToValueAtTime(safePeak, start + safeAttack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(safeAttack + 0.01, duration));
    }

    function scheduleTone({ time, duration, frequency, endFrequency = null, type = "sine", gain = 0.1, detune = 0, attack = 0.012, pan = 0 }) {
      const context = ensureAudioContext();
      if (!context || !sfxMaster) return;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const stereo = context.createStereoPanner ? context.createStereoPanner() : null;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), time);
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), time + duration);
      }
      oscillator.detune.value = detune;
      scheduleEnvelope(envelope, time, duration, gain, attack);
      oscillator.connect(envelope);
      if (stereo) {
        stereo.pan.value = Math.max(-1, Math.min(1, pan));
        envelope.connect(stereo);
        stereo.connect(sfxMaster);
      } else {
        envelope.connect(sfxMaster);
      }
      oscillator.start(time);
      oscillator.stop(time + duration + 0.03);
    }

    function scheduleNoise({ time, duration, gain = 0.06, low = 180, high = 4200, attack = 0.006, pan = 0 }) {
      const context = ensureAudioContext();
      const buffer = sfxNoise();
      if (!context || !buffer || !sfxMaster) return;
      const source = context.createBufferSource();
      const bandpass = context.createBiquadFilter();
      const envelope = context.createGain();
      const stereo = context.createStereoPanner ? context.createStereoPanner() : null;
      source.buffer = buffer;
      source.loop = true;
      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(Math.max(40, (low + high) / 2), time);
      bandpass.Q.value = Math.max(0.2, Math.min(18, high / Math.max(1, low)));
      scheduleEnvelope(envelope, time, duration, gain, attack);
      source.connect(bandpass);
      bandpass.connect(envelope);
      if (stereo) {
        stereo.pan.value = Math.max(-1, Math.min(1, pan));
        envelope.connect(stereo);
        stereo.connect(sfxMaster);
      } else {
        envelope.connect(sfxMaster);
      }
      source.start(time);
      source.stop(time + duration + 0.03);
    }

    function sfxCooldownKey(owner, eventName) {
      return `${owner}:${eventName}`;
    }

    function shouldPlaySfx(owner, eventName, nowMs) {
      const eventProfile = sfxEventProfiles[eventName] || sfxEventProfiles.select;
      const key = sfxCooldownKey(owner, eventName);
      const lastPlayed = sfxLastPlayedAt.get(key) || -Infinity;
      if (nowMs - lastPlayed < eventProfile.cooldown) return false;
      sfxLastPlayedAt.set(key, nowMs);
      return true;
    }

    function playCharacterSfx(owner, eventName, options = {}) {
      if (sfxMuted) return;
      if (!sfxUnlocked && !options.unlock) return;
      if (!unlockSfx()) return;
      const nowMs = performance.now();
      if (!shouldPlaySfx(owner, eventName, nowMs)) return;
      const eventProfile = sfxEventProfiles[eventName] || sfxEventProfiles.select;
      const character = options.character || HexSnakeUI.characterFor(owner);
      const profile = characterSfxProfile(character?.id || "dragon", HexSnakeState.ui.portraitVariantMode);
      const base = profile.base * profile.pitch;
      const duration = eventProfile.duration * profile.decayScale;
      const gain = eventProfile.gain * sfxGainForOwner(owner, eventName) * (options.gainScale || 1);
      const time = sfxNow() + (options.delay || 0);
      const assetBuffer = getSfxAssetBuffer(sfxAssetUrl(character, eventName));
      if (playSfxAssetBuffer(assetBuffer, time, gain, owner === "computer" ? 0.24 : -0.08)) return;
      const toneType = eventName === "big" && profile.wave === "square" ? "sawtooth" : profile.wave;
      const bright = profile.colorScale;
      const noiseGain = gain * 0.42 * profile.noiseScale;
      const pan = owner === "computer" ? 0.24 : -0.08;

      if (eventName === "select") {
        scheduleTone({ time, duration, frequency: base * 1.35, endFrequency: base * 1.72, type: "sine", gain: gain * 0.65, attack: 0.006, pan });
        scheduleTone({ time: time + duration * 0.32, duration: duration * 0.72, frequency: base * profile.accent, type: "triangle", gain: gain * 0.34, attack: 0.004, pan: -pan });
        scheduleNoise({ time, duration: duration * 0.6, gain: noiseGain * 0.35, low: 600 * bright, high: 4800 * bright, pan });
        return;
      }

      if (eventName === "start") {
        [0, 0.075, 0.16].forEach((offset, index) => {
          scheduleTone({ time: time + offset, duration: duration * 0.52, frequency: base * (1 + index * 0.2), endFrequency: base * (1.25 + index * 0.22), type: "triangle", gain: gain * (0.55 + index * 0.16), attack: 0.009, pan });
        });
        scheduleNoise({ time, duration: duration * 0.9, gain: noiseGain * 0.55, low: 260 * bright, high: 3600 * bright, pan });
        return;
      }

      if (eventName === "small") {
        const down = profile.noise === "sand" || profile.noise === "venom";
        scheduleTone({ time, duration, frequency: base * (down ? 1.2 : 1.05), endFrequency: base * (down ? 0.72 : 1.55), type: toneType, gain, attack: 0.005 * profile.attackScale, pan });
        scheduleTone({ time: time + 0.025, duration: duration * 0.58, frequency: base * profile.accent, type: "sine", gain: gain * 0.38, attack: 0.004, pan: -pan });
        scheduleNoise({ time, duration: duration * 0.8, gain: noiseGain, low: profile.noise === "spark" ? 1800 : 180, high: profile.noise === "sand" ? 980 : 6200 * bright, pan });
        return;
      }

      if (eventName === "big") {
        const sweepEnd = profile.noise === "sand" || profile.noise === "venom" ? base * 0.42 : base * 2.15;
        scheduleTone({ time, duration: Math.min(1.1, duration), frequency: base * 0.78, endFrequency: sweepEnd, type: toneType, gain: gain * 0.95, attack: 0.018 * profile.attackScale, pan });
        scheduleTone({ time: time + 0.08, duration: duration * 0.72, frequency: base * profile.accent, endFrequency: base * profile.accent * 1.12, type: "sine", gain: gain * 0.52, attack: 0.012, pan: -pan });
        [0.16, 0.28, 0.42].forEach((offset, index) => {
          scheduleTone({ time: time + offset, duration: 0.16, frequency: base * (1.6 + index * 0.32), type: profile.noise === "spark" ? "sawtooth" : "triangle", gain: gain * 0.28, attack: 0.004, pan: index % 2 ? -pan : pan });
        });
        scheduleNoise({ time, duration: Math.min(0.95, duration * 0.92), gain: noiseGain * 1.2, low: profile.noise === "spark" ? 1400 : 90, high: profile.noise === "sand" ? 1100 : 7600 * bright, attack: 0.012, pan });
        return;
      }

      if (eventName === "victory") {
        [0, 0.11, 0.24].forEach((offset, index) => {
          scheduleTone({ time: time + offset, duration: duration * 0.52, frequency: base * [1, 1.26, 1.68][index], endFrequency: base * [1.18, 1.5, 2.05][index], type: "sine", gain: gain * (0.52 + index * 0.12), attack: 0.012, pan });
        });
        scheduleNoise({ time: time + 0.03, duration: duration * 0.65, gain: noiseGain * 0.35, low: 700 * bright, high: 5600 * bright, pan });
        return;
      }

      if (eventName === "defeat") {
        scheduleTone({ time, duration, frequency: base * 0.95, endFrequency: base * 0.38, type: "triangle", gain: gain * 0.9, attack: 0.02, pan });
        scheduleTone({ time: time + 0.09, duration: duration * 0.72, frequency: base * 0.48, endFrequency: base * 0.32, type: "sine", gain: gain * 0.36, attack: 0.03, pan: -pan });
        scheduleNoise({ time: time + 0.02, duration: duration * 0.82, gain: noiseGain * 0.72, low: 80, high: 1800 * bright, attack: 0.02, pan });
      }
    }

    const HexSnakeAudio = Object.freeze({
      ensureContext: ensureAudioContext,
      unlock: unlockSfx,
      setMuted: setSfxMuted,
      warmup: warmupSfx,
      preloadCharacter: preloadCharacterSfx,
      playCharacter: playCharacterSfx,
      now: sfxNow,
      get muted() {
        return sfxMuted;
      },
      get unlocked() {
        return sfxUnlocked;
      }
    });

    Object.defineProperties(HexSnakeUI.audio, Object.getOwnPropertyDescriptors(HexSnakeAudio));
