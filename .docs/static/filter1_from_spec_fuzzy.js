/**
 * Creates a filtering function based on the following spec:
 * 1. Substrings are separated by `/`.
 * 2. Each substring may have special characters:
 *    - `^`: Substring must appear at the beginning.
 *    - `$`: Substring must appear at the end.
 *    - `!`: Negates the condition (substring must not appear).
 *
 * Browser copy of node-helpers/src/filter1_from_spec.js, exported as
 * `filter1_from_spec_fuzzy`. The leaf matcher (see .docs/search-spec.md §9,
 * option B) can match plain `includes` terms fuzzily via fuzzy_substr().
 * Typo tolerance is currently disabled in fuzzy_errors() — matching is exact;
 * anchored `^`/`$` terms are always exact.
 */
function filter1_from_spec_fuzzy(spec)
{
    let a, b, c, d;
    const parts = parse_spec(spec);
    switch (parts.length) {
    case 0:
        // No filters, always true
        return () => true;
    case 1:
        return parts[0];
    case 2:
        [a, b] = parts;
        return s => a(s) && b(s);
    case 3:
        [a, b, c] = parts;
        return s => a(s) && b(s) && c(s);
    case 4:
        [a, b, c, d] = parts;
        return s => a(s) && b(s) && c(s) && d(s);
    default:
        return s => parts.every(fn => fn(s));
    }
}

function parse_spec(spec)
{
    return spec.split('/').filter(v => v).map(parse_expr);
}

// convert expr into an array of objects {substr, starts, ends}
function parse_expr(expr)
{
    let substr;
    let starts = false; // ^
    let ends = false; // $
    substr = expr.replaceAll('^', '');
    starts = (substr.length !== expr.length);
    expr = substr;
    substr = expr.replaceAll('$', '');
    ends = (substr.length !== expr.length);
    expr = substr;
    substr = expr.replaceAll('!', '');
    if ((expr.length - substr.length) % 2) { // not
        if (starts && ends) {
            return s => !s.startsWith(substr) && !s.endsWith(substr);
        }
        if (starts) {
            return s => !s.startsWith(substr);
        }
        if (ends) {
            return s => !s.endsWith(substr);
        }
        return s => !fuzzy_substr(s, substr);
    }
    if (starts && ends) {
        return s => s.startsWith(substr) && s.endsWith(substr);
    }
    if (starts) {
        return s => s.startsWith(substr);
    }
    if (ends) {
        return s => s.endsWith(substr);
    }
    return s => fuzzy_substr(s, substr);
}

// Approximate substring match: true when `text` contains a window within
// fuzzy_errors(pattern) edits of `pattern`. Standard fuzzy-substring DP — the
// empty-pattern row is all zeros so the pattern may align anywhere in `text`.
function fuzzy_substr(text, pattern)
{
    const n = pattern.length;
    if (n === 0) {
        return true;
    }
    const max_errors = fuzzy_errors(pattern);
    if (max_errors === 0) {
        return text.includes(pattern);
    }
    const m = text.length;
    let prev = new Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
        const cur = new Array(m + 1);
        cur[0] = i;
        for (let j = 1; j <= m; j++) {
            const cost = pattern[i - 1] === text[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j - 1] + cost, prev[j] + 1, cur[j - 1] + 1);
        }
        prev = cur;
    }
    let best = n;
    for (let j = 0; j <= m; j++) {
        if (prev[j] < best) {
            best = prev[j];
        }
    }
    return best <= max_errors;
}

// Typo tolerance is disabled for now (the fuzzy matches were confusing) —
// returning 0 makes fuzzy_substr() fall back to an exact `includes`. To
// re-enable, return errors by term length again, e.g. 0 for length <= 3,
// 1 for <= 6, else 2. See .docs/search-spec.md §9.
function fuzzy_errors()
{
    return 0;
}

window.filter1_from_spec_fuzzy = filter1_from_spec_fuzzy;
