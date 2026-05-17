# Docs search — spec (for review)

Draft spec for adding search to the generated docs. **Nothing is implemented
yet** — review this, edit/annotate, then decide. Open decisions are marked
**[DECIDE]**.

## 1. Goal

Client-side search for the static docs produced by `bin/build-docs`. No server,
no new build dependency. Works offline (the mermaid CDN is the only view-time
external dependency; search must not add another).

## 2. Requirements (as requested)

1. Add a search input to the top bar (`.site-header`).
2. Any keydown (while not typing in another field) focuses the search input.
3. In search mode: show only matching sections; highlight matched words in them.
4. Pressing Enter scrolls to the first match; the filtered view stays —
   hidden sections are restored only when the search is cleared.
5. Reuse the `filter1_from_spec` filtering engine — copy it into the static
   assets (`.docs/static/`) rather than importing from `node_modules`.
6. Items 3–4 describe **single-page mode**.
7. **Classic mode**: pressing Enter opens the first matched page.

Refinements added during review and testing:

8. Sections split at `h2` **and** `h3`, so an `h3` subsection is its own
   landable result.
9. Fuzzy matching — the search can tolerate small typos (§9; currently
   disabled — matching is exact).
10. Only the **last** `/`-separated term is highlighted; earlier terms only
    filter.
11. Filtered-out sections are hidden in the sidebar too.
12. A ✕ clear button (besides Escape) clears the box and the highlights.
13. Classic mode carries the query as `?q=` so the destination page keeps the
    matched words highlighted.

## 3. The filtering engine — `filter1_from_spec`

Source: `node_modules/@vbarbarosh/node-helpers/src/filter1_from_spec.js`.
The text typed into the search box **is the spec string**.

Spec syntax:

- `/` separates substrings; all must match (logical AND).
- `^substr` — substring must appear at the start of the text.
- `substr$` — substring must appear at the end.
- `!substr` — negation: substring must NOT appear (each `!` toggles; an even
  number cancels out).
- Empty spec → matches everything.

`filter1_from_spec(spec)` returns a predicate `(text) => boolean`. Examples
(from its test): `^start/end$`, `substr1/substr2`, `substr/!not`.

Notes / consequences:

- **Case sensitivity** — the engine uses `includes`/`startsWith`/`endsWith`, so
  it is case-sensitive. For search we will lowercase both the section text and
  the input before calling it. The copied engine file stays byte-identical.
- **No match positions** — the engine returns only true/false. Highlighting is
  handled separately, and only the **last** `/`-separated term is highlighted
  (it is the active term; earlier terms just narrow the filter). The `^`/`$`
  anchors are stripped; a negated (`!`) or empty last term highlights nothing.
- **Browser use** — **[RESOLVED]** the copy is `filter1_from_spec_fuzzy.js`
  (renamed to make the fuzziness explicit). The final
  `module.exports = filter1_from_spec;` becomes
  `window.filter1_from_spec_fuzzy = filter1_from_spec_fuzzy;`; it loads with a
  plain `<script>` before `docs.js`.

## 4. Build structure (facts the design relies on)

- **Classic mode** — one HTML file per page (`config.html`, `overview.html`, …).
  Only the current page's content is in the DOM.
- **Single-page mode** — `build/docs/single/index.html`; every page is a
  `<section class="doc-page" id="{page-slug}">`. Headings inside get ids
  prefixed with the page slug.
- `bin/build-docs` already enumerates every page and extracts a per-page `toc`
  (h2/h3 headings → anchors).
- `docs.js` is a classic IIFE; `render_shell()` builds the header.

## 5. Behavior — single-page mode

A **section** is a heading block: an `h2` or `h3` heading and the content
following it up to the next `h2`/`h3`. The text after a page's `h1` and before
its first heading is that page's intro section. `bin/build-docs` wraps each
block in a `<section class="doc-section">` so it can be shown/hidden as a unit.
**[RESOLVED — h2/h3 heading block]**

- **Search box** in the top bar, alongside the theme/mode/GitHub controls.
- **Global focus** — a `keydown` on `document`, when focus is not already in an
  input/textarea, focuses the search box so the keystroke lands in it.
- **Live filtering** — on every input change: lowercase the value, build the
  predicate via `filter1_from_spec_fuzzy`, test each section's text, and hide
  non-matching sections; a page (`.doc-page`) with no visible section is hidden
  too. Empty box → everything visible.
- **`/` is progressive AND** — `aa/bb` keeps only sections matching `aa` *and*
  `bb`; each term narrows the result further. This is `filter1_from_spec`'s
  built-in behaviour.
- **Highlighting** — only the **last** `/`-separated term is wrapped in
  `<mark>` in the visible sections; earlier terms only filter. A negated (`!`)
  or empty last term highlights nothing; `^`/`$` anchors are stripped first.
  **[RESOLVED]**
- **Sidebar** — nav entries in the sidebar whose target section/page is
  filtered out are hidden too, so the sidebar tracks the visible results.
  **[RESOLVED]**
- **No matches** — when the filter hides every section, a "No sections match"
  message is shown in place of the content. (Classic mode shows "No matches"
  in its results dropdown.) **[RESOLVED]**
- **Enter** — keep the filtered view (non-matching sections stay hidden) and
  smooth-scroll to the first matched section; highlights stay. Hidden sections
  are restored only when the search is cleared. **[RESOLVED]**
- **Clear** — two ways, both empty the box, remove every `<mark>` highlight,
  and reset: the **Escape** key, and a **✕ clear button** inside the search box
  (shown whenever there is text or a highlight to clear). **[RESOLVED]**

## 6. Behavior — classic mode

Each classic page holds only its own content in the DOM, so search must cover
**all** pages. This requires a build-time **search index**:
`build/docs/static/search-index.json` — a list of `{page, title, anchor, text}`
entries (one per section) written by `bin/build-docs`.

While typing, classic mode searches the whole index (every page's text) and
shows the matches in a **results dropdown** anchored under the search box —
since the matching content lives on other pages and cannot be revealed in
place:

- Each result row: page title › section heading, plus a short snippet with the
  matched substrings highlighted.
- Arrow keys move the active row; clicking a row (or Enter on it) navigates to
  `page.html#anchor`.
- **Enter** → navigate to the first matched section (item 7).
- Navigation carries the query as `?q=` so the destination page highlights the
  matched words on arrival; Escape clears those highlights.
- Empty box / no matches → dropdown hidden.

The current classic page's own sections are not filtered in place — the
dropdown is the single result view. (Single-page mode keeps its in-page section
filtering from §5.) **[CONFIRM]** the dropdown UI.

## 7. Files (implemented)

| File | Change |
|------|--------|
| `.docs/static/filter1_from_spec_fuzzy.js` | new — copied engine, renamed, fuzzy leaf (§3, §9) |
| `bin/build-docs` | wrap each `h2`/`h3` block in `<section class="doc-section">`; emit `static/search-index.json`; add the search box + ✕ clear button to `render_shell()` |
| `.docs/static/docs.js` | `setup_search` — global-focus keydown; single-mode live filter, highlight, sidebar sync, no-match message, Enter/Escape, clear button; classic-mode index search, results dropdown, `?q=` carry-through highlight |
| `.docs/static/docs.css` | search box, ✕ clear button, `mark` highlight, results dropdown, no-match message |

## 8. Open decisions — summary

1. ~~**§3** Browser adaptation of the engine~~ — **RESOLVED**: copied file ends
   with `window.filter1_from_spec = filter1_from_spec;`.
2. ~~**§5** Section granularity~~ — **RESOLVED**: a section is an `h2`/`h3`
   heading block.
3. ~~**§5** Enter keeps or clears highlights~~ — **RESOLVED**: Enter keeps
   highlights; the Escape key and the ✕ clear button clear them.
4. ~~**§6** Classic mode behavior~~ — **RESOLVED**: searches all pages via the
   index while typing, shows a results dropdown, Enter opens the first match.
   Still **[CONFIRM]** the dropdown UI.
5. ~~Search scope~~ — **RESOLVED**: every bit of text is searchable, code
   blocks included.
6. Index size is fine for ~13 pages (tens of KB); no concern unless docs grow.
7. ~~Fuzzy / typo tolerance~~ — option B implemented (§9) but **currently
   disabled** — `fuzzy_errors()` returns 0, so matching is exact, pending
   review of the behaviour.

## 9. Fuzzy search (typo tolerance) — [DECIDE]

`filter1_from_spec` matches **exact** substrings (`includes` / `startsWith` /
`endsWith`). Typo tolerance is a separate algorithm — it cannot come out of
`filter1_from_spec` unchanged, so requirement 5 (reuse the engine) and fuzzy
matching pull against each other. Options:

- **A — exact only** (current plan). Zero extra work. The `/`-separated model
  tolerates *partial* words; it does not tolerate wrong or transposed letters.

- **B — fuzzy leaf, keep the spec engine.** `filter1_from_spec` still parses and
  combines the spec (`/`, `^`, `$`, `!`, AND); only its leaf test changes from
  `text.includes(term)` to an approximate substring match — a bounded
  fuzzy-substring DP (~25 lines: edit distance of `term` against the
  best-aligned window of `text`, accept if ≤ k errors; k = 1 for short terms,
  2 for longer). `^`/`$`/`!` stay exact. This means a small **fuzzy variant**
  of the engine, not a byte-identical copy. Effort: ~half a day.

- **C — fuzzy library** (Fuse.js / MiniSearch). Best ranking and typo handling
  for free, but replaces `filter1_from_spec` entirely (contradicts req. 5) and
  vendors a ~10–20 KB dependency.

Performance is not a constraint for any option: ~13 pages of text, so even a
full fuzzy pass over every section on each keystroke stays well under a
millisecond.

**Recommendation: B** — keeps the `filter1_from_spec` spec syntax users would
expect, and adds typo tolerance as a swapped-in leaf matcher.

**Chosen: B.** The copy `.docs/static/filter1_from_spec_fuzzy.js` keeps the spec
parser/combiner intact and replaces the leaf `text.includes(term)` with the
bounded fuzzy-substring match; `^`/`$` stay exact; the file ends with
`window.filter1_from_spec_fuzzy = filter1_from_spec_fuzzy;` for browser use.

**Status — typo tolerance is currently disabled.** It behaved unexpectedly, so
`fuzzy_errors()` returns 0 and matching is exact. The fuzzy machinery stays in
place; restore the length-based thresholds in `fuzzy_errors()` to turn it back
on.
