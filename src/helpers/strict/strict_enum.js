const is_unset = require('./is_unset');

// A `before` validator, case-insensitive: unset falls through to the field
// default, an unrecognized value is a startup error. Returns the canonical
// lowercase option so downstream comparisons and the docs assume one
// spelling. See strict_int.
function strict_enum(env_name, options)
{
    return function (value) {
        if (is_unset(value)) {
            return undefined;
        }
        const normalized = String(value).trim().toLowerCase();
        if (!options.includes(normalized)) {
            throw new Error(`${env_name} must be one of ${options.join(', ')}, got ${JSON.stringify(value)}`);
        }
        return normalized;
    };
}

module.exports = strict_enum;
