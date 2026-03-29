function parse_domains(value)
{
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.map(v => v.toLowerCase());
    }

    // string from env
    return value.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
}

module.exports = parse_domains;
