// Verify that the emergency document renders without app providers or raw diagnostics.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const requirePackage = createRequire(import.meta.url);
const cache = new Map();
let icons;

function load(filename) {
  if (filename.endsWith(".css")) return {};
  if (filename.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = { exports: {} };
  cache.set(filename, mod);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const localRequire = id => {
    // This package's .cjs.js export is marked ESM; load its real ESM entry once.
    if (id === "@phosphor-icons/react") return icons;
    if (!id.startsWith("@/") && !id.startsWith(".")) return requirePackage(id);
    const base = id.startsWith("@/") ? path.join(src, id.slice(2)) : path.resolve(path.dirname(filename), id);
    const found = [base, base + ".ts", base + ".tsx"].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!found) throw new Error("Missing test module: " + id);
    return load(found);
  };
  const execute = vm.runInThisContext("(function(require,module,exports){" + compiled + "\n})", { filename });
  execute(localRequire, mod, mod.exports);
  return mod.exports;
}

async function main() {
  icons = await import("@phosphor-icons/react");
  const GlobalError = load(path.join(src, "app/global-error.tsx")).default;
  const html = renderToStaticMarkup(React.createElement(GlobalError, {
    error: new Error("INTERNAL_DIAGNOSTIC_MUST_NOT_LEAK"), retry: () => {},
  }));
  assert.match(html, /<html/);
  assert.match(html, /<body/);
  assert.match(html, /data-error-code="500"/);
  assert.match(html, /Bir şeyler yolunda gitmedi/);
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /mailto:pdassistant.info@gmail.com/);
  assert.doesNotMatch(html, /INTERNAL_DIAGNOSTIC_MUST_NOT_LEAK/);
  console.log("Global error document: passed (no app providers, no raw diagnostics).");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
