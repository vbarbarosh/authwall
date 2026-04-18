const UNSET = Symbol('resolve_yaml_vars.unset');

/**
 * Resolves yaml variables in the for of ${VAR_NAME} inplace.
 */
function resolve_yaml_vars(input, vars = {})
{
    return resolve_yaml_vars_int(new Set(), input, vars);
}

function resolve_yaml_vars_int(seen, input, vars = {})
{
    if (typeof input === 'string') {
        const match = input.match(/^\$\{([^}]+)}$/);
        if (match && !Object.hasOwn(vars, match[1])) {
            return UNSET;
        }
        return input.replace(/\$\{([^}]+)}/g, function (_, name) {
            return Object.hasOwn(vars, name) ? vars[name] : '';
        });
    }

    if (Array.isArray(input)) {
        if (seen.has(input)) {
            return input;
        }
        seen.add(input);
        for (let i = 0, ii = input.length; i < ii; ++i) {
            input[i] = resolve_yaml_vars_int(seen, input[i], vars);
        }
        return input;
    }

    if (input && typeof input === 'object') {
        if (seen.has(input)) {
            return input;
        }
        seen.add(input);
        const entries = Object.entries(input);
        for (let i = 0, ii = entries.length; i < ii; ++i) {
            const [key, value] = entries[i];
            const resolved = resolve_yaml_vars_int(seen, value, vars);
            if (resolved === UNSET) {
                delete input[key];
            }
            else {
                input[key] = resolved;
            }
        }
        return input;
    }

    return input;
}

module.exports = resolve_yaml_vars;
