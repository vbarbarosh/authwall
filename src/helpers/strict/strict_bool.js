const is_unset = require('./is_unset');

const BOOL_TRUE = new Set(['1', 'yes', 'true', 'on', 'y']);
const BOOL_FALSE = new Set(['0', 'no', 'false', 'off', 'n']);

// A `before` validator: unset falls through to the field default, an
// unparseable value is a startup error. See strict_int.
function strict_bool(env_name)
{
    return function (value) {
        // A nullable field (default null) reaches here with null when unset;
        // pass it through so the field stays null rather than becoming false.
        if (value === null) {
            return null;
        }
        if (is_unset(value)) {
            return undefined;
        }
        const normalized = String(value).trim().toLowerCase();
        if (BOOL_TRUE.has(normalized)) {
            return 1;
        }
        if (BOOL_FALSE.has(normalized)) {
            return 0;
        }
        throw new Error(`${env_name} must be a boolean (yes/no/true/false/on/off), got ${JSON.stringify(value)}`);
    };
}

module.exports = strict_bool;
