const fs = require("fs");
const path = require("path");

const sampleRate = 44100;
const outRoot = path.join(__dirname, "..", "assets", "audio", "characters");
const events = ["select", "start", "small", "big", "victory", "defeat"];

const characters = {
  dragon: { base: 520, accent: 940, noise: "ice", voice: { base: 310, type: "elegant" } },
  moray: { base: 260, accent: 1420, noise: "spark", voice: { base: 390, type: "bright" } },
  lobster: { base: 210, accent: 620, noise: "deep", voice: { base: 250, type: "calm" } },
  sandworm: { base: 96, accent: 180, noise: "sand", voice: { base: 210, type: "warrior" } },
  quetzal: { base: 430, accent: 880, noise: "wind", voice: { base: 340, type: "warm" } },
  gu_king: { base: 155, accent: 360, noise: "venom", voice: { base: 330, type: "danger" } }
};

const durations = {
  select: 0.5,
  start: 0.72,
  small: 0.42,
  big: 1.05,
  victory: 0.95,
  defeat: 0.82
};

const humanPhrases = {
  dragon: {
    select: { syllables: [1, 1.34], mood: "up" },
    start: { syllables: [1.08], mood: "flat" },
    small: { syllables: [1.25], mood: "cut" },
    big: { syllables: [0.86, 1.2], mood: "power" },
    victory: { syllables: [1.02, 0.92], mood: "cool" },
    defeat: { syllables: [1.2, 1.05, 0.78], mood: "fall" }
  },
  moray: {
    select: { syllables: [1.25, 1.6], mood: "up" },
    start: { syllables: [1.2, 1.5], mood: "up" },
    small: { syllables: [1.48], mood: "cut" },
    big: { syllables: [1.05, 1.55], mood: "power" },
    victory: { syllables: [1.32, 1.72], mood: "up" },
    defeat: { syllables: [1.2, 0.95, 0.72], mood: "fall" }
  },
  lobster: {
    select: { syllables: [0.95], mood: "flat" },
    start: { syllables: [0.95, 1.05], mood: "flat" },
    small: { syllables: [0.9], mood: "cut" },
    big: { syllables: [0.82, 1.05], mood: "power" },
    victory: { syllables: [0.92, 0.82], mood: "cool" },
    defeat: { syllables: [0.96, 0.84, 0.62], mood: "fall" }
  },
  sandworm: {
    select: { syllables: [0.72, 0.9], mood: "power" },
    start: { syllables: [0.82, 0.98], mood: "power" },
    small: { syllables: [0.8], mood: "cut" },
    big: { syllables: [0.7, 0.95], mood: "power" },
    victory: { syllables: [0.78, 0.64], mood: "cool" },
    defeat: { syllables: [0.82, 0.7, 0.54], mood: "fall" }
  },
  quetzal: {
    select: { syllables: [1.12, 1.45], mood: "up" },
    start: { syllables: [1.05, 1.3], mood: "up" },
    small: { syllables: [1.18], mood: "cut" },
    big: { syllables: [0.95, 1.28], mood: "power" },
    victory: { syllables: [1.16, 1.34], mood: "up" },
    defeat: { syllables: [1.05, 0.9, 0.7], mood: "fall" }
  },
  gu_king: {
    select: { syllables: [0.92, 1.08], mood: "danger" },
    start: { syllables: [0.95, 1.08], mood: "danger" },
    small: { syllables: [1.08], mood: "cut" },
    big: { syllables: [0.88, 1.16], mood: "power" },
    victory: { syllables: [0.82, 0.96], mood: "danger" },
    defeat: { syllables: [1.18, 0.92, 0.64], mood: "fall" }
  }
};

function makeBuffer(seconds) {
  return new Float32Array(Math.ceil(seconds * sampleRate));
}

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function env(t, duration, attack = 0.012, release = 0.08) {
  if (t < 0 || t > duration) return 0;
  if (t < attack) return t / attack;
  if (t > duration - release) return Math.max(0, (duration - t) / release);
  return 1;
}

function addTone(buffer, start, duration, freqStart, freqEnd, gain, wave = "sine", opts = {}) {
  const begin = Math.max(0, Math.floor(start * sampleRate));
  const end = Math.min(buffer.length, Math.floor((start + duration) * sampleRate));
  const attack = opts.attack ?? 0.012;
  const release = opts.release ?? 0.08;
  let phase = opts.phase ?? 0;
  for (let i = begin; i < end; i += 1) {
    const local = i / sampleRate - start;
    const p = Math.max(0, Math.min(1, local / duration));
    const freq = freqStart * Math.pow(Math.max(0.01, freqEnd / freqStart), p);
    phase += (Math.PI * 2 * freq) / sampleRate;
    let v = Math.sin(phase);
    if (wave === "triangle") v = (2 / Math.PI) * Math.asin(Math.sin(phase));
    if (wave === "saw") v = 2 * (phase / (Math.PI * 2) - Math.floor(0.5 + phase / (Math.PI * 2)));
    if (wave === "square") v = Math.sin(phase) >= 0 ? 1 : -1;
    buffer[i] += v * gain * env(local, duration, attack, release);
  }
}

function addNoise(buffer, start, duration, gain, color, opts = {}) {
  const begin = Math.max(0, Math.floor(start * sampleRate));
  const end = Math.min(buffer.length, Math.floor((start + duration) * sampleRate));
  const attack = opts.attack ?? 0.006;
  const release = opts.release ?? 0.1;
  let last = 0;
  for (let i = begin; i < end; i += 1) {
    const local = i / sampleRate - start;
    const raw = Math.random() * 2 - 1;
    let v = raw;
    if (color === "low") {
      last = last * 0.94 + raw * 0.06;
      v = last;
    } else if (color === "air") {
      last = last * 0.58 + raw * 0.42;
      v = raw - last * 0.65;
    } else if (color === "crackle") {
      v = Math.random() > 0.82 ? raw : raw * 0.12;
    } else if (color === "grit") {
      last = last * 0.75 + raw * 0.25;
      v = (Math.random() > 0.62 ? raw : last) * 0.8;
    } else if (color === "wet") {
      last = last * 0.88 + raw * 0.12;
      v = Math.sin(last * 8) * 0.7 + raw * 0.18;
    }
    buffer[i] += v * gain * env(local, duration, attack, release);
  }
}

function addImpact(buffer, time, gain = 0.35) {
  addTone(buffer, time, 0.18, 90, 42, gain, "triangle", { attack: 0.003, release: 0.12 });
  addNoise(buffer, time, 0.22, gain * 0.7, "low", { attack: 0.002, release: 0.16 });
}

function addSkill(buffer, id, event, offset = 0, scale = 1) {
  const c = characters[id];
  const big = event === "big";
  if (id === "dragon") {
    if (big) {
      addNoise(buffer, offset, 0.82, 0.18 * scale, "air");
      [0.05, 0.22, 0.38, 0.58].forEach((t, i) => addTone(buffer, offset + t, 0.18, c.accent * (1 + i * 0.09), c.accent * 1.45, 0.08 * scale, "triangle"));
    } else {
      addTone(buffer, offset, 0.2, 1450, 2300, 0.16 * scale, "triangle", { attack: 0.003, release: 0.07 });
      addNoise(buffer, offset + 0.02, 0.18, 0.08 * scale, "air");
    }
  } else if (id === "moray") {
    const pulses = big ? [0, 0.08, 0.16, 0.26, 0.39, 0.54] : [0, 0.06];
    pulses.forEach((t, i) => {
      addTone(buffer, offset + t, 0.08, c.accent * (1 + i * 0.06), c.accent * 2.2, 0.13 * scale, "saw", { attack: 0.002, release: 0.035 });
      addNoise(buffer, offset + t, 0.07, 0.08 * scale, "crackle", { attack: 0.001, release: 0.035 });
    });
    if (big) addTone(buffer, offset, 0.75, 72, 46, 0.16 * scale, "triangle");
  } else if (id === "lobster") {
    if (big) {
      addImpact(buffer, offset + 0.05, 0.34 * scale);
      addImpact(buffer, offset + 0.28, 0.42 * scale);
      addNoise(buffer, offset, 0.7, 0.12 * scale, "wet");
    } else {
      [0, 0.1, 0.2].forEach(t => {
        addNoise(buffer, offset + t, 0.12, 0.07 * scale, "air");
        addTone(buffer, offset + t, 0.14, 420, 250, 0.06 * scale, "sine");
      });
    }
  } else if (id === "sandworm") {
    addTone(buffer, offset, big ? 0.86 : 0.38, c.base, big ? 48 : 72, 0.28 * scale, "triangle", { attack: 0.03, release: 0.18 });
    addNoise(buffer, offset, big ? 0.9 : 0.35, 0.2 * scale, "grit", { attack: 0.02, release: 0.2 });
    if (big) [0.24, 0.38, 0.56].forEach(t => addImpact(buffer, offset + t, 0.26 * scale));
  } else if (id === "quetzal") {
    addNoise(buffer, offset, big ? 0.9 : 0.32, 0.16 * scale, "air");
    [0, 0.11, 0.24].forEach((t, i) => addTone(buffer, offset + t, big ? 0.28 : 0.14, c.base * (1.3 + i * 0.3), c.accent * (1.3 + i * 0.15), 0.08 * scale, "sine"));
    if (big) addTone(buffer, offset, 0.82, 210, 330, 0.12 * scale, "triangle");
  } else if (id === "gu_king") {
    const bursts = big ? [0, 0.14, 0.28, 0.45] : [0];
    bursts.forEach((t, i) => {
      addNoise(buffer, offset + t, 0.18, 0.15 * scale, "wet", { attack: 0.003, release: 0.1 });
      addTone(buffer, offset + t, 0.16, c.accent * (1 + i * 0.08), c.base * 0.9, 0.08 * scale, "square");
    });
    if (big) addImpact(buffer, offset + 0.62, 0.22 * scale);
  }
}

function addBeastEvent(buffer, id, event) {
  const c = characters[id];
  if (event === "small" || event === "big") {
    addSkill(buffer, id, event, 0, 1);
    return;
  }
  if (event === "select") {
    addTone(buffer, 0.02, 0.32, c.base * 0.9, c.base * 1.45, 0.14, id === "moray" ? "saw" : "triangle");
    addNoise(buffer, 0, 0.38, 0.08, c.noise === "spark" ? "crackle" : c.noise === "sand" ? "grit" : c.noise === "venom" ? "wet" : "air");
  } else if (event === "start") {
    addTone(buffer, 0.02, 0.46, c.base * 0.72, c.base * 1.85, 0.18, id === "dragon" || id === "quetzal" ? "sine" : "triangle");
    addTone(buffer, 0.18, 0.34, c.accent * 0.8, c.accent * 1.12, 0.08, "sine");
    addNoise(buffer, 0.02, 0.55, 0.11, c.noise === "sand" ? "grit" : c.noise === "deep" || c.noise === "venom" ? "wet" : "air");
  } else if (event === "victory") {
    [0.02, 0.17, 0.36].forEach((t, i) => addTone(buffer, t, 0.38, c.base * (1 + i * 0.22), c.base * (1.45 + i * 0.28), 0.12, "sine"));
    addNoise(buffer, 0.08, 0.58, 0.07, c.noise === "sand" ? "grit" : "air");
  } else if (event === "defeat") {
    addTone(buffer, 0.02, 0.62, c.base * 1.05, c.base * 0.35, 0.16, "triangle", { attack: 0.02, release: 0.22 });
    addNoise(buffer, 0.08, 0.5, 0.11, c.noise === "spark" ? "crackle" : c.noise === "sand" ? "grit" : "wet");
  }
}

function addVoice(buffer, id, event, start = 0, gain = 0.2) {
  const phrase = humanPhrases[id][event];
  const voice = characters[id].voice;
  const total = event === "small" ? 0.16 : event === "big" ? 0.28 : durations[event] * 0.62;
  const gap = 0.035;
  const syllableDuration = Math.max(0.09, (total - gap * (phrase.syllables.length - 1)) / phrase.syllables.length);
  phrase.syllables.forEach((mult, index) => {
    const t = start + index * (syllableDuration + gap);
    let endMult = mult;
    if (phrase.mood === "up") endMult *= 1.2;
    if (phrase.mood === "fall") endMult *= 0.72;
    if (phrase.mood === "power") endMult *= 1.08;
    const base = voice.base * mult;
    const end = voice.base * endMult;
    const wave = voice.type === "danger" ? "triangle" : "sine";
    addTone(buffer, t, syllableDuration, base, end, gain, wave, { attack: 0.015, release: 0.05 });
    addTone(buffer, t, syllableDuration, base * 2.02, end * 2.01, gain * 0.32, "sine", { attack: 0.014, release: 0.05 });
    addNoise(buffer, t, syllableDuration, gain * (voice.type === "danger" ? 0.18 : 0.08), voice.type === "warrior" ? "low" : "air", { attack: 0.012, release: 0.05 });
  });
}

function addHumanEvent(buffer, id, event) {
  addVoice(buffer, id, event, 0.02, event === "big" ? 0.24 : 0.2);
  if (event === "small" || event === "big") {
    addSkill(buffer, id, event, event === "small" ? 0.12 : 0.2, 0.82);
  } else {
    addBeastEvent(buffer, id, event);
    for (let i = 0; i < buffer.length; i += 1) buffer[i] *= 0.62;
    addVoice(buffer, id, event, 0.02, 0.23);
  }
}

function normalize(buffer) {
  let peak = 0;
  for (const value of buffer) peak = Math.max(peak, Math.abs(value));
  const scale = peak > 0.92 ? 0.92 / peak : 1;
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = clamp(buffer[i] * scale);
  }
}

function writeWav(file, buffer) {
  normalize(buffer);
  const dataSize = buffer.length * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < buffer.length; i += 1) {
    wav.writeInt16LE(Math.round(clamp(buffer[i]) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, wav);
}

function main() {
  fs.mkdirSync(outRoot, { recursive: true });
  const manifest = { sampleRate, generatedAt: new Date().toISOString(), files: [] };
  for (const mode of ["beast", "human"]) {
    const dir = path.join(outRoot, mode);
    fs.mkdirSync(dir, { recursive: true });
    for (const id of Object.keys(characters)) {
      for (const event of events) {
        const buffer = makeBuffer(durations[event] + (mode === "human" && event === "big" ? 0.22 : 0.04));
        if (mode === "human") addHumanEvent(buffer, id, event);
        else addBeastEvent(buffer, id, event);
        const name = `${id}_${event}.wav`;
        writeWav(path.join(dir, name), buffer);
        manifest.files.push({ mode, character: id, event, path: `assets/audio/characters/${mode}/${name}` });
      }
    }
  }
  fs.writeFileSync(path.join(outRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${manifest.files.length} character sound effects in ${outRoot}`);
}

main();
