#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const uiPath = path.join(root, "src", "ui.js");
const gamePath = path.join(root, "src", "game.js");
const outPath = path.join(root, "doc", "state-boundary-audit.md");

function stripCommentsAndStrings(source) {
  let out = "";
  let state = "code";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "lineComment") {
      if (char === "\n") {
        state = "code";
        out += "\n";
      } else {
        out += " ";
      }
      continue;
    }

    if (state === "blockComment") {
      if (char === "*" && next === "/") {
        state = "code";
        out += "  ";
        index += 1;
      } else {
        out += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state === "single" || state === "double" || state === "template") {
      const quote = state === "single" ? "'" : state === "double" ? "\"" : "`";
      if (char === "\\") {
        out += "  ";
        index += 1;
        continue;
      }
      if (char === quote) state = "code";
      out += char === "\n" ? "\n" : " ";
      continue;
    }

    if (char === "/" && next === "/") {
      state = "lineComment";
      out += "  ";
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      state = "blockComment";
      out += "  ";
      index += 1;
      continue;
    }
    if (char === "'") {
      state = "single";
      out += " ";
      continue;
    }
    if (char === "\"") {
      state = "double";
      out += " ";
      continue;
    }
    if (char === "`") {
      state = "template";
      out += " ";
      continue;
    }

    out += char;
  }
  return out;
}

function depthMapFor(stripped) {
  const depths = new Array(stripped.length);
  let depth = 0;
  for (let index = 0; index < stripped.length; index += 1) {
    const char = stripped[index];
    if (char === "}") depth = Math.max(0, depth - 1);
    depths[index] = depth;
    if (char === "{") depth += 1;
  }
  return depths;
}

function lineStartsFor(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function lineNumberFor(starts, index) {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (starts[mid] <= index) low = mid + 1;
    else high = mid - 1;
  }
  return high + 1;
}

function collectTopLevelDeclarations(source) {
  const stripped = stripCommentsAndStrings(source);
  const depths = depthMapFor(stripped);
  const starts = lineStartsFor(source);
  const declarations = new Map();
  const pattern = /\b(function|const|let|var)\s+([A-Za-z_$][\w$]*)/g;

  for (const match of stripped.matchAll(pattern)) {
    if (depths[match.index] !== 0) continue;
    const [, kind, name] = match;
    declarations.set(name, {
      kind,
      line: lineNumberFor(starts, match.index),
    });
  }

  return declarations;
}

function previousNonWhitespace(stripped, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (!/\s/.test(stripped[cursor])) return stripped[cursor];
  }
  return "";
}

function isObjectPropertyKey(stripped, index, name) {
  const before = previousNonWhitespace(stripped, index);
  const after = stripped.slice(index + name.length);
  return /[{,(]/.test(before) && /^\s*:/.test(after);
}

function findMatchingBrace(stripped, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < stripped.length; index += 1) {
    const char = stripped[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractBindingNames(bindingSource) {
  const names = new Set();
  const pattern = /[A-Za-z_$][\w$]*/g;
  for (const match of bindingSource.matchAll(pattern)) {
    names.add(match[0]);
  }
  return names;
}

function collectFunctionLocalRanges(stripped) {
  const ranges = [];
  const functionPattern = /\bfunction\b[^{]*\(([^)]*)\)\s*\{/g;

  for (const match of stripped.matchAll(functionPattern)) {
    const openIndex = match.index + match[0].lastIndexOf("{");
    const closeIndex = findMatchingBrace(stripped, openIndex);
    if (closeIndex < 0) continue;
    const locals = extractBindingNames(match[1]);
    const body = stripped.slice(openIndex + 1, closeIndex);

    const simpleDeclarationPattern = /\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g;
    for (const declaration of body.matchAll(simpleDeclarationPattern)) {
      locals.add(declaration[1]);
    }

    const destructuringDeclarationPattern = /\b(?:const|let|var)\s+([^;=\n]+?)\s*=/g;
    for (const declaration of body.matchAll(destructuringDeclarationPattern)) {
      extractBindingNames(declaration[1]).forEach(name => locals.add(name));
    }

    ranges.push({
      start: match.index,
      end: closeIndex,
      locals,
    });
  }

  return ranges;
}

function isLocallyBound(localRanges, index, name) {
  return localRanges.some(range => index >= range.start && index <= range.end && range.locals.has(name));
}

function classifyReference(stripped, index, name) {
  const before = stripped.slice(Math.max(0, index - 8), index);
  const after = stripped.slice(index + name.length, index + name.length + 24);
  if (/(\+\+|--)\s*$/.test(before) || /^\s*(\+\+|--)/.test(after)) return "write";
  if (/^\s*(?:[+\-*/%&|^]?\=)(?!=|>)/.test(after)) return "write";
  if (/^\s*\.(?:push|pop|shift|unshift|splice|sort|reverse|set|delete|clear|add)\b/.test(after)) return "mutation";
  if (/^\s*\(/.test(after)) return "call";
  return "read";
}

function boundaryFor(name, declaration) {
  if (/^(player|computer)|Snake$|^snake$|^foods$|^hazards$|^projectiles$|^blasts$|^score$|^best$|running|paused|gameOver|Elapsed|Step|Timer|Frame/.test(name)) {
    return "match runtime state";
  }
  if (/attack|Attack|ammo|Ammo|stock|Stock|energy|Energy|bomb|Bomb|hp|Hp|stun|Stun|slow|Slow|vulnerable|Vulnerable|damage|Damage|cooldown|Cooldown|collision|Collision/.test(name)) {
    return "combat/resource state";
  }
  if (/settings|Settings|gm|Gm|grid|Grid|initial|Initial|keybind|Keybind|control|Control|pointer|Pointer|keyboard|Keyboard|target|Target|move|Move|joy|Joy|mobile|Mobile|difficulty|Difficulty|speed|Speed/.test(name)) {
    return "controls/settings state";
  }
  if (/portrait|Portrait|character|Character|logo|Logo|overlay|Overlay|callout|Callout|stage|Stage|tutorial|Tutorial|rules|Rules|replay|Replay|result|Result|render|Render|show|Show|hide|Hide|open|Open|close|Close|build|Build/.test(name)) {
    return "presentation/actions";
  }
  if (declaration?.kind === "function") return "general function";
  return "misc state";
}

function collectReferences(source, declarations) {
  const stripped = stripCommentsAndStrings(source);
  const starts = lineStartsFor(source);
  const lines = source.split(/\r?\n/);
  const names = new Set(declarations.keys());
  const localRanges = collectFunctionLocalRanges(stripped);
  const seen = new Set();
  const references = [];
  const pattern = /[A-Za-z_$][\w$]*/g;

  for (const match of stripped.matchAll(pattern)) {
    const name = match[0];
    if (!names.has(name)) continue;
    if (stripped[match.index - 1] === ".") continue;
    if (isObjectPropertyKey(stripped, match.index, name)) continue;
    if (isLocallyBound(localRanges, match.index, name)) continue;

    const line = lineNumberFor(starts, match.index);
    const category = classifyReference(stripped, match.index, name);
    const key = `${line}:${name}:${category}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const declaration = declarations.get(name);
    references.push({
      name,
      line,
      category,
      declaration,
      boundary: boundaryFor(name, declaration),
      context: (lines[line - 1] || "").trim(),
    });
  }

  return references;
}

function countBy(items, keyFn) {
  const counts = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    const row = counts.get(key) || { key, occurrences: 0, names: new Set() };
    row.occurrences += 1;
    row.names.add(item.name);
    counts.set(key, row);
  });
  return [...counts.values()].sort((a, b) => b.occurrences - a.occurrences || a.key.localeCompare(b.key));
}

function formatNameList(names) {
  return [...names].sort((a, b) => a.localeCompare(b)).map(name => `\`${name}\``).join(", ");
}

function formatExamples(references, limit = 20) {
  return references
    .slice()
    .sort((a, b) => a.line - b.line || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(ref => `- [src/game.js:${ref.line}](../src/game.js#L${ref.line}) \`${ref.name}\` (${ref.category}) - ${ref.context}`);
}

function main() {
  const uiSource = fs.readFileSync(uiPath, "utf8");
  const gameSource = fs.readFileSync(gamePath, "utf8");
  const declarations = collectTopLevelDeclarations(uiSource);
  const references = collectReferences(gameSource, declarations);
  const uniqueNames = new Set(references.map(ref => ref.name));
  const functionNames = new Set(references.filter(ref => ref.declaration.kind === "function").map(ref => ref.name));
  const stateNames = new Set(references.filter(ref => ref.declaration.kind !== "function").map(ref => ref.name));
  const writeRefs = references.filter(ref => ref.category === "write" || ref.category === "mutation");

  const lines = [
    "# State Boundary Audit",
    "",
    "Generated by `npm run audit:state-boundary`. This is a heuristic map of `src/game.js` references to top-level declarations from `src/ui.js`.",
    "",
    "## Summary",
    "",
    `- Total references: ${references.length}`,
    `- Unique ` + "`ui.js`" + ` names referenced by ` + "`game.js`" + `: ${uniqueNames.size}`,
    `- Referenced functions: ${functionNames.size}`,
    `- Referenced state variables: ${stateNames.size}`,
    `- Direct writes or mutations: ${writeRefs.length}`,
    "",
    "## Boundary Groups",
    "",
    "| Boundary | Occurrences | Unique Names | Names |",
    "| --- | ---: | ---: | --- |",
  ];

  countBy(references, ref => ref.boundary).forEach(row => {
    lines.push(`| ${row.key} | ${row.occurrences} | ${row.names.size} | ${formatNameList(row.names)} |`);
  });

  lines.push("", "## Usage Types", "", "| Type | Occurrences | Unique Names | Names |", "| --- | ---: | ---: | --- |");
  countBy(references, ref => ref.category).forEach(row => {
    lines.push(`| ${row.key} | ${row.occurrences} | ${row.names.size} | ${formatNameList(row.names)} |`);
  });

  lines.push("", "## Direct Writes And Mutations", "");
  if (writeRefs.length) lines.push(...formatExamples(writeRefs, 40));
  else lines.push("- None detected.");

  lines.push("", "## Suggested Order", "");
  if (references.length) {
    lines.push(
      "1. Move match runtime state behind a small `HexSnakeState` or game-owned accessor layer first: `running`, `paused`, `gameOver`, snakes, foods, hazards, projectiles, timers.",
      "2. Then move combat/resource state as a separate pass: hp, stock, ammo, stun/slow/vulnerability, cooldown and attack trackers.",
      "3. Keep presentation/actions in UI-oriented APIs: portrait, overlay, callout, tutorial, rules, replay, result share, and DOM rendering actions.",
      "4. Leave load-time initialization alone until the legacy bundle order changes or those initializers move behind explicit bootstrap calls.",
      "5. After each boundary pass, run `npm.cmd run audit:globals`, `npm.cmd run build`, `npm.cmd run test:quick`, and `npm.cmd run test:smoke`.",
    );
  } else {
    lines.push(
      "1. `game.js` no longer has direct heuristic references to top-level `ui.js` declarations.",
      "2. Use `npm.cmd run audit:globals` to plan the next broader legacy-global reduction pass.",
      "3. Keep `npm.cmd run audit:state-boundary` in release-adjacent checks so new direct state reads are caught early.",
    );
  }
  lines.push("", "## Representative References", "", ...formatExamples(references, 80), "");

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${path.relative(root, outPath)} (${references.length} references, ${uniqueNames.size} names).`);
}

main();
