const is_unset = require('./is_unset');

// Unlike the others this takes the value directly (PORT is read straight from
// env, not through a make() spec): returns undefined when unset so the caller
// can apply its default, throws on a non-numeric or out-of-range value.
function strict_port(env_name, value)
{
    if (is_unset(value)) {
        return undefined;
    }
    const n = Number(String(value).trim());
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        throw new Error(`${env_name} must be a port number in [1, 65535], got ${JSON.stringify(value)}`);
    }
    return n;
}

module.exports = strict_port;
