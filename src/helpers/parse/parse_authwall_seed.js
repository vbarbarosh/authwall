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
        return JSON.parse(str).map(function (v) {
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

module.exports = parse_authwall_seed;
