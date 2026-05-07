const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const databasePath = path.join(root, "data", "characters.json");
const portraitDir = path.join(root, "assets", "portraits");
const promptDir = path.join(portraitDir, "prompts");
const semanticPoses = ["opening", "intro", "small", "big", "victory", "defeat"];
const foods = {
  balanced: "均衡",
  protein: "蛋白（紅色）",
  fat: "脂肪（黃色）",
  fiber: "纖維（綠色）",
  carb: "碳水（藍色）"
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key === "dry-run") {
      args.dryRun = true;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node tools/add-character.js --name "玄狐" --concept "夜行幻術刺客" --food fiber --color "#8b5cf6"

Options:
  --name       Required. Character display name.
  --concept    Required. Short appearance/story concept.
  --food       balanced, protein, fat, fiber, carb. Defaults to balanced.
  --color      Hex color. Defaults to #8b5cf6.
  --id         Optional stable id. Defaults to a slug from name/concept.
  --slug       Optional asset slug. Defaults to id.
  --dry-run    Print generated data without writing files.`);
}

function slugify(input, fallback = "new-character") {
  const ascii = String(input || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || fallback;
}

function hashText(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeHex(input, fallback = "#8b5cf6") {
  const value = String(input || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(value)) return `#${value.toLowerCase()}`;
  return fallback;
}

function hexToRgb(hex) {
  const clean = normalizeHex(hex).slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(hex, target, amount) {
  const base = hexToRgb(hex);
  const goal = hexToRgb(target);
  return rgbToHex({
    r: base.r + (goal.r - base.r) * amount,
    g: base.g + (goal.g - base.g) * amount,
    b: base.b + (goal.b - base.b) * amount
  });
}

function foodEffect(food, name) {
  if (food === "balanced") {
    return `均衡型角色；${name}吃食後補出的新食物有 50% 機率為蟠桃(雙色)，提供更彈性的資源路線。`;
  }
  return `偏好${foods[food]}；食物生成傾向${foods[food]}。`;
}

function buildPrompt(character, pose) {
  const poseNotes = {
    opening: "opening splash art, full-body reveal, confident silhouette",
    intro: "idle introduction pose, readable character design, calm stance",
    small: `small skill action pose for ${character.smallMove}, kinetic but clear`,
    big: `ultimate skill action pose for ${character.bigMove}, dramatic full-power composition`,
    victory: "victory pose, triumphant expression, clean game character art",
    defeat: "defeat pose, exhausted but dignified, still recognizable"
  };
  return [
    `${character.name}, ${character.appearance}`,
    poseNotes[pose],
    `representative color ${character.representColor}, accent ${character.colors.accent}`,
    "transparent background, full body character illustration, fantasy hex snake battle game, crisp silhouette"
  ].join(", ");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function placeholderSvg(character, pose) {
  const title = `${character.name} ${pose}`;
  const initial = [...character.name][0] || "?";
  const main = character.representColor;
  const body = character.colors.body;
  const line = character.colors.line;
  const accent = character.colors.accent;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="34%" r="68%">
      <stop offset="0%" stop-color="${escapeXml(line)}" stop-opacity="0.85"/>
      <stop offset="58%" stop-color="${escapeXml(main)}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#101720" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g filter="url(#shadow)">
    <path d="M196 662 C254 372 461 754 642 388 C724 222 908 350 790 538 C648 763 388 572 322 842 C292 966 154 860 196 662Z" fill="${escapeXml(body)}" stroke="${escapeXml(line)}" stroke-width="24" stroke-linejoin="round"/>
    <path d="M640 300 L714 142 L758 334Z" fill="${escapeXml(accent)}"/>
    <path d="M734 376 L914 306 L810 478Z" fill="${escapeXml(accent)}"/>
    <circle cx="728" cy="412" r="30" fill="#101720"/>
    <path d="M286 646 C424 526 540 632 686 472" fill="none" stroke="${escapeXml(accent)}" stroke-width="26" stroke-linecap="round"/>
  </g>
  <circle cx="188" cy="178" r="104" fill="#101720" fill-opacity="0.76" stroke="${escapeXml(line)}" stroke-width="10"/>
  <text x="188" y="218" text-anchor="middle" font-size="112" font-family="Arial, 'Noto Sans TC', sans-serif" font-weight="800" fill="${escapeXml(line)}">${escapeXml(initial)}</text>
  <text x="512" y="940" text-anchor="middle" font-size="46" font-family="Arial, 'Noto Sans TC', sans-serif" font-weight="700" fill="#f8fafc">${escapeXml(title)}</text>
</svg>
`;
}

function loadCharacters() {
  if (!fs.existsSync(databasePath)) return [];
  return JSON.parse(fs.readFileSync(databasePath, "utf8"));
}

function uniqueId(base, existing) {
  let id = base;
  let index = 2;
  const ids = new Set(existing.map(character => character.id));
  while (ids.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function createCharacter(args, existing) {
  const name = String(args.name || "").trim();
  const concept = String(args.concept || "").trim();
  if (!name || !concept) {
    usage();
    process.exitCode = 1;
    return null;
  }
  const food = foods[args.food] ? args.food : "balanced";
  const color = normalizeHex(args.color);
  const idBase = slugify(args.id || args.slug || args.name, `character-${hashText(name).slice(0, 6)}`);
  const id = uniqueId(idBase, existing);
  const slug = slugify(args.slug || id, id);
  const character = {
    id,
    slug,
    name,
    representColor: color,
    appearance: concept,
    avatar: `assets/portraits/${slug}_opening.svg`,
    portraits: Object.fromEntries(semanticPoses.map(pose => [pose, { full: `assets/portraits/${slug}_${pose}.svg` }])),
    foodEffect: foodEffect(food, name),
    story: [
      `${name}帶著「${concept}」的身影踏進六角戰場，把每一次轉向都當成重新命名自己的機會。`,
      `牠的戰鬥不是為了證明傳說，而是讓對手在${foods[food]}的節奏裡記住牠的名字。`
    ],
    motto: "讓下一步，替我作答。",
    smallMove: `${name}小招`,
    bigMove: `${name}大招`,
    colors: {
      body: mix(color, "#111827", 0.32),
      line: mix(color, "#ffffff", 0.62),
      accent: mix(color, "#fbbf24", 0.45)
    },
    foodPreference: food
  };
  return character;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const existing = loadCharacters();
  const character = createCharacter(args, existing);
  if (!character) return;
  const prompts = Object.fromEntries(semanticPoses.map(pose => [pose, buildPrompt(character, pose)]));

  if (args.dryRun) {
    console.log(JSON.stringify({ character, prompts }, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.mkdirSync(portraitDir, { recursive: true });
  fs.mkdirSync(promptDir, { recursive: true });
  const nextCharacters = [...existing, character];
  fs.writeFileSync(databasePath, `${JSON.stringify(nextCharacters, null, 2)}\n`, "utf8");
  semanticPoses.forEach(pose => {
    fs.writeFileSync(path.join(portraitDir, `${character.slug}_${pose}.svg`), placeholderSvg(character, pose), "utf8");
  });
  fs.writeFileSync(path.join(promptDir, `${character.slug}.json`), `${JSON.stringify(prompts, null, 2)}\n`, "utf8");
  console.log(`Added ${character.name} (${character.id}) to data/characters.json`);
  console.log(`Generated placeholder portraits in assets/portraits/${character.slug}_*.svg`);
  console.log(`Generated prompts at assets/portraits/prompts/${character.slug}.json`);
}

main();
