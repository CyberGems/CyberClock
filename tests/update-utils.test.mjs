import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// update-utils.js is a browser IIFE that reads the language from window.ccI18n,
// so the test harness provides a minimal window global before importing it.
globalThis.window = { ccI18n: { getEffectiveLang: () => 'en' } };
await import(pathToFileURL(path.join(here, '../src/shared/update-utils.js')).href);
const { parseChangelogPeek, releaseUrl } = globalThis.window.ccUpdates;

const nestedBody = `## 📋 CyberClock v1.17.0: Release Notes

<!-- changelog-summary:start -->
Summary line for toasts.
<!-- changelog-summary:end -->

> **New to CyberLauncher?** Placeholder quote.

---

### ✨ Key Features & Highlights

- 🕐 **Mini Mode windows**:
  - First nested detail line.
  - Second nested detail that
  continues on a soft-wrapped line.
- 🧘 **Full Mode in background**: flat bullet text.

<details>
<summary><b>🇪🇸 Ver notas de la versión en Español</b></summary>

### 🚀 Novedades

- 🕐 **Ventanas del Modo Mini**:
  - Primer detalle anidado.

### ⚠️ Antes de instalar

- **Windows:** esta versión aún no está firmada digitalmente.

</details>

---

### ⚠️ Before you install

- **Windows:** this release is not code-signed yet.
`;

test('parseChangelogPeek keeps flat bullet bodies unchanged', () => {
  const peek = parseChangelogPeek('- Flat bullet one\n- Flat bullet two\n- Flat bullet three');
  assert.equal(peek.length, 3);
  assert.equal(peek[0], 'Flat bullet one');
});

test('parseChangelogPeek absorbs nested sub-bullets into their parent bullet', () => {
  const peek = parseChangelogPeek(nestedBody);
  assert.equal(peek.length, 2);
  assert.match(peek[0], /^🕐 Mini Mode windows/);
  assert.match(peek[0], /First nested detail line/);
  assert.match(peek[0], /Second nested detail that continues on a soft-wrapped line/);
  assert.equal(peek[1], '🧘 Full Mode in background: flat bullet text.');
});

test('parseChangelogPeek merges soft-wrapped continuation lines', () => {
  const peek = parseChangelogPeek('- Bullet that\nkeeps going.\n- Next bullet');
  assert.deepEqual(peek, ['Bullet that keeps going.', 'Next bullet']);
});

test('parseChangelogPeek picks the Spanish block when the language is es', () => {
  globalThis.window.ccI18n.getEffectiveLang = () => 'es';
  const peek = parseChangelogPeek(nestedBody);
  assert.equal(peek.length, 1);
  assert.match(peek[0], /^🕐 Ventanas del Modo Mini/);
  // The install guidance stays stripped from in-app previews.
  assert.doesNotMatch(peek[0], /firmada digitalmente/);
  globalThis.window.ccI18n.getEffectiveLang = () => 'en';
});

test('parseChangelogPeek falls back to paragraphs when no bullets exist', () => {
  const peek = parseChangelogPeek('Just a paragraph.\n\nAnother one.');
  assert.deepEqual(peek, ['Just a paragraph.', 'Another one.']);
});

test('parseChangelogPeek respects the limit and dedupes', () => {
  const peek = parseChangelogPeek('- One\n- One\n- Two\n- Three\n- Four\n- Five', 4);
  assert.deepEqual(peek, ['One', 'Two', 'Three', 'Four']);
});

test('releaseUrl handles missing and prefixed versions', () => {
  assert.match(releaseUrl(null), /releases$/);
  assert.match(releaseUrl('v1.2.3'), /releases\/tag\/v1\.2\.3$/);
});
