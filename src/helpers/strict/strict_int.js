const is_unset = require('./is_unset');

// The `make` helper coerces silently: an out-of-range integer clamps. For an
// operator-facing setting that is the wrong default — docs/config.md promises
// Authwall "refuses to start" on a value it cannot honor. Used as a `before`
// validator: unset falls through to the field default, anything else invalid
// throws a startup error naming the variable.
function strict_int(env_name, {min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER} = {})
{
    return function (value) {
        if (is_unset(value)) {
            return undefined;
        }
        const n = Number(String(value).trim());
        if (!Number.isInteger(n) || n < min || n > max) {
            throw new Error(`${env_name} must be an integer in [${min}, ${max}], got ${JSON.stringify(value)}`);
        }
        return n;
    };
}

module.exports = strict_int;
