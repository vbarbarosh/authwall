function parse_authwall_seed(value)
{
    if (!value) {
        return [];
    }

    // YAML-parsed array (inline config in settings.yaml)
    if (Array.isArray(value)) {
        return value;
    }

    const str = String(value).trim();
    if (!str) {
        return [];
    }

    // JSON format: [{"username":"foo","password":"pass123","emails":["email@domain.com"]}]
    if (str.startsWith('[')) {
        return parse_seed_json(str).map(function (v) {
            return {
                username: v.username,
                password: v.password,
                display_name: v.display_name,
                email: Array.isArray(v.emails) ? v.emails : (v.emails ? [v.emails] : []),
            };
        });
    }

    // Compact format: username:password:email1,email2;username2:password2:email3
    return str.split(';').filter(Boolean).map(function (v) {
        const parts = v.split(':');
        return {
            username: parts[0],
            password: parts[1],
            email: (parts[2] ?? '').split(',').filter(Boolean),
        };
    });
}

// The seed's JSON, or an error that names the place and never the text: an
// uncaught JSON.parse error prints its input, every password of the seed,
// at every restart (AW-127). AUTHWALL_SEED_FILE's parser does the same.
function parse_seed_json(str)
{
    let out = null;
    try {
        out = JSON.parse(str);
    }
    catch {
        throw new Error('AUTHWALL_SEED: not valid JSON');
    }
    if (!Array.isArray(out) || out.some(v => (typeof v !== 'object') || (v === null) || Array.isArray(v))) {
        throw new Error('AUTHWALL_SEED: a JSON seed is an array of objects');
    }
    return out;
}

module.exports = parse_authwall_seed;
