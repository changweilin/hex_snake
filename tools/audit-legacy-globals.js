#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const mainPath = path.join(root, "src", "main.js");
const outPath = path.join(root, "doc", "legacy-global-dependencies.md");

const keywords = new Set([
  "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
  "do", "else", "export", "extends", "false", "finally", "for", "function", "if", "import", "in",
  "instanceof", "let", "new", "null", "of", "return", "static", "super", "switch", "this", "throw",
  "true", "try", "typeof", "undefined", "var", "void", "while", "with", "yield"
]);

const platformGlobals = new Set([
  "Array", "Boolean", "CSS", "Date", "Error", "Event", "FileReader", "Infinity", "Intl", "JSON",
  "Map", "Math", "NaN", "Number", "Object", "Promise", "Proxy", "Reflect", "RegExp", "ResizeObserver",
  "Set", "String", "URL", "WeakMap", "WeakSet", "addEventListener", "cancelAnimationFrame",
  "clearInterval", "clearTimeout", "console", "decodeURIComponent", "document", "encodeURIComponent",
  "fetch", "history", "innerHeight", "innerWidth", "isFinite", "isNaN", "localStorage", "location",
  "matchMedia", "navigator", "performance", "queueMicrotask", "requestAnimationFrame", "setInterval",
  "setTimeout", "structuredClone", "window"
]);

function extractSources() {
  const main = fs.readFileSync(mainPath, "utf8");
  const match = main.match(/const\s+sources\s*=\s*\[([\s\S]*?)\]/);
  if (!match) throw new Error("Could not find legacy source list in src/main.js");
  const sources = [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
  if (!sources.length) throw new Error("Legacy source list is empty");
  return sources;
}

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

function collectDeclarations(stripped, { topLevelOnly = false } = {}) {
  const depths = topLevelOnly ? depthMapFor(stripped) : null;
  const declarations = new Set();
  const patterns = [
    /\bfunction\s+([A-Za-z_$][\w$]*)/g,
    /\bclass\s+([A-Za-z_$][\w$]*)/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g
  ];

  patterns.forEach(pattern => {
    for (const match of stripped.matchAll(pattern)) {
      if (topLevelOnly && depths[match.index] !== 0) continue;
      declarations.add(match[1]);
    }
  });
  return declarations;
}

function collectReferences(stripped) {
  const references = new Set();
  const pattern = /[A-Za-z_$][\w$]*/g;
  for (const match of stripped.matchAll(pattern)) {
    const token = match[0];
    const previous = stripped[match.index - 1];
    if (previous === ".") continue;
    if (keywords.has(token) || platformGlobals.has(token)) continue;
    references.add(token);
  }
  return references;
}

function groupByProvider(dependencies, sourceIndex) {
  const groups = new Map();
  dependencies.forEach(dependency => {
    if (!groups.has(dependency.provider)) groups.set(dependency.provider, []);
    groups.get(dependency.provider).push(dependency.name);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => sourceIndex.get(left) - sourceIndex.get(right))
    .map(([provider, names]) => ({
      provider,
      names: [...new Set(names)].sort((a, b) => a.localeCompare(b)),
      direction: sourceIndex.get(provider) < sourceIndex.get(dependencies[0].source) ? "earlier" : "later"
    }));
}

function formatNames(names) {
  return names.map(name => `\`${name}\``).join(", ");
}

function main() {
  const sources = extractSources();
  const sourceIndex = new Map(sources.map((source, index) => [source, index]));
  const files = sources.map(source => {
    const code = fs.readFileSync(path.join(root, source), "utf8");
    const stripped = stripCommentsAndStrings(code);
    return {
      source,
      topLevelDeclarations: collectDeclarations(stripped, { topLevelOnly: true }),
      declarations: collectDeclarations(stripped),
      references: collectReferences(stripped)
    };
  });

  const providersByName = new Map();
  files.forEach(file => {
    file.topLevelDeclarations.forEach(name => {
      if (!providersByName.has(name)) providersByName.set(name, []);
      providersByName.get(name).push(file.source);
    });
  });

  const dependenciesBySource = new Map();
  const reverseBySource = new Map();
  sources.forEach(source => {
    dependenciesBySource.set(source, []);
    reverseBySource.set(source, []);
  });

  files.forEach(file => {
    file.references.forEach(name => {
      if (file.declarations.has(name)) return;
      const providers = (providersByName.get(name) || []).filter(source => source !== file.source);
      if (providers.length !== 1) return;
      const [provider] = providers;
      const dependency = { source: file.source, provider, name };
      dependenciesBySource.get(file.source).push(dependency);
      reverseBySource.get(provider).push(dependency);
    });
  });

  const lines = [
    "# Legacy Global Dependencies",
    "",
    "Generated by `npm run audit:globals`. This is a static heuristic for the current legacy concatenated module loader in `src/main.js`; use it as a migration map, not as a compiler guarantee.",
    "",
    "## Load Order",
    ""
  ];

  sources.forEach((source, index) => {
    lines.push(`${index + 1}. \`${source}\``);
  });

  lines.push("", "## Cross-file Reads", "");
  sources.forEach(source => {
    const dependencies = dependenciesBySource.get(source);
    lines.push(`### \`${source}\``);
    if (!dependencies.length) {
      lines.push("", "- No cross-file globals detected.", "");
      return;
    }
    groupByProvider(dependencies, sourceIndex).forEach(group => {
      lines.push(`- From \`${group.provider}\` (${group.direction}): ${formatNames(group.names)}`);
    });
    lines.push("");
  });

  lines.push("## Referenced By Others", "");
  sources.forEach(source => {
    const reverse = reverseBySource.get(source);
    lines.push(`### \`${source}\``);
    if (!reverse.length) {
      lines.push("", "- No detected consumers.", "");
      return;
    }
    const consumers = new Map();
    reverse.forEach(dependency => {
      if (!consumers.has(dependency.source)) consumers.set(dependency.source, []);
      consumers.get(dependency.source).push(dependency.name);
    });
    [...consumers.entries()]
      .sort(([left], [right]) => sourceIndex.get(left) - sourceIndex.get(right))
      .forEach(([consumer, names]) => {
        lines.push(`- Used by \`${consumer}\`: ${formatNames([...new Set(names)].sort((a, b) => a.localeCompare(b)))}`);
      });
    lines.push("");
  });

  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  const dependencyCount = [...dependenciesBySource.values()].reduce((sum, items) => sum + items.length, 0);
  console.log(`Wrote ${path.relative(root, outPath)} (${sources.length} files, ${dependencyCount} cross-file reads).`);
}

main();
