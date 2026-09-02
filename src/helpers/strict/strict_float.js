const is_unset = require('./is_unset');

// A `before` validator: unset falls through to the field default, an
// out-of-range or non-numeric value is a startup error. See strict_int.
function strict_float(env_name, {min = -Infinity, max = Infinity} = {})
{
    return function (value) {
        if (is_unset(value)) {
            return undefined;
        }
        const n = Number(String(value).trim());
        if (!Number.isFinite(n) || n < min || n > max) {
            throw new Error(`${env_name} must be a number in [${min}, ${max}], got ${JSON.stringify(value)}`);
        }
        return n;
    };
}

module.exports = strict_float;
