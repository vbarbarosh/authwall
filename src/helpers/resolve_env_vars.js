// ⚠️ FIXME Take care of recursive objects
function resolve_env_vars(input)
{
    if (typeof input === 'string') {
        return input.replace(/\$\{([^}]+)}/g, function (_, name) {
            return process.env[name] ?? '';
        });
    }

    if (Array.isArray(input)) {
        return input.map(resolve_env_vars);
    }

    if (input && typeof input === 'object') {
        const out = {};
        for (const [key, value] of Object.entries(input)) {
            out[key] = resolve_env_vars(value);
        }
        return out;
    }

    return input;
}

module.exports = resolve_env_vars;
