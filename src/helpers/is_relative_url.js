function is_relative_url(value)
{
    if (typeof value !== 'string') {
        return false;
    }

    if (!value.startsWith('/')) {
        return false;
    }

    // prevent protocol-relative
    if (value[1] === '/') {
        return false;
    }

    // prevent backslash tricks
    if (value.includes('\\')) {
        return false;
    }

    // prevent encoded leading slash (%2f or %2F)
    if (value.startsWith('/%2f') || value.startsWith('/%2F')) {
        return false;
    }

    return true;
}

module.exports = is_relative_url;
