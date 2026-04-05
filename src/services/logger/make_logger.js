const cuid2 = require('@paralleldrive/cuid2');

const inst = cuid2.init();

/**
 * make_logger(params)
 *
 * Minimal plain-string logger with grouping.
 *
 * Each log line has the form:
 *
 *     [group_uid][tag1][tag2] message
 *
 * Structure:
 *   1) Leading sequence of tags: [ ... ][ ... ][ ... ]
 *   2) Exactly one space
 *   3) Message (free text; no further parsing)
 *
 * Examples:
 *     [abc123] hello
 *     [abc123][req_begin] GET /foo
 *     [abc123][+0.1234s][checkpoint] done
 *
 * Normalization rules:
 *   - All leading [tag] blocks are grouped together without spaces between them
 *   - Exactly one space is inserted before the message (if any)
 *   - Anything after the first non-tag character is treated as message and left untouched
 *
 *     "[][][]message"       → "[][][] message"
 *     "[][] []message"      → "[][][] message"
 *     "[][][] message[][]"  → "[][][] message[][]"
 *
 * Logger behavior:
 *   - Each logger instance has a unique `group_uid`
 *   - `spawn()` creates a new logger with a new `group_uid`
 *   - Spawned logger emits a linkage line:
 *
 *         [child_uid][parent] parent_uid
 *
 * Pipeline:
 *   message → decorate → format_line → append
 *
 *   decorate(message): optional transformation (e.g. add tags)
 *   format_line(uid, message): enforces structure
 *   append(line): output (console, file, etc.)
 *
 * Notes:
 *   - Logger operates on plain strings only (no JSON, no structure)
 *   - Time, persistence, and side effects belong to `append`
 */
function make_logger(params = {})
{
    const parent_uid = params.parent_uid ?? null;
    const decorate = params.decorate ?? (s => s);
    const append = params.append ?? (s => console.log(s));

    const log = function (message) {
        append(format_line(log.group_uid, decorate(message)));
    };
    log.group_uid = inst();
    log.parent_uid = parent_uid;
    log.spawn = function () {
        return make_logger({parent_uid: log.group_uid, decorate, append});
    };

    if (parent_uid) {
        log(`[parent] ${parent_uid}`);
    }

    return log;
}

// function format_line(group_uid, message)
// {
//     const s = message.trim();
//
//     // extract leading [tag][tag]...
//     const m = s.match(/^(\[[^\]]*])+/);
//
//     if (m) {
//         const tags = m[0].replace(/]\s+\[/g, ']['); // normalize spaces between tags
//         const rest = s.slice(m[0].length).trimStart();
//         return `[${group_uid}]${tags}${rest ? ' ' + rest : ''}`;
//     }
//
//     return `[${group_uid}] ${s}`;
// }

function format_line(group_uid, message)
{
    const s = message.trim();

    // collect leading tags: [..][..]...
    let i = 0;
    let tags = '';

    while (s[i] === '[') {
        const j = s.indexOf(']', i);
        if (j === -1) {
            break;
        }
        tags += s.slice(i, j + 1);
        i = j + 1;

        // skip spaces between tags
        while (s[i] === ' ') {
            i++;
        }
    }

    const rest = s.slice(i);
    return `[${group_uid}]` + tags + (rest ? ' ' + rest : '');
}

module.exports = make_logger;
