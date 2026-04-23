const http = require('http');

function parse_unset_headers(value)
{
    if (!value) {
        return [];
    }

    return String(value)
        .split(';')
        .map(v => v.trim())
        .filter(Boolean)
        .map(parse_unset_header);
}

function parse_unset_header(value)
{
    http.validateHeaderName(value);
    return value;
}

module.exports = parse_unset_headers;
