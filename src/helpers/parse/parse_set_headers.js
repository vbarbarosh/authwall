const http = require('http');

function parse_set_headers(value)
{
    if (!value) {
        return [];
    }

    return String(value).split(';').map(v => v.trim()).filter(Boolean).map(parse_set_header);
}

function parse_set_header(value)
{
    const i = value.indexOf('=');
    if (i === -1) {
        throw new Error(`AUTHWALL_SET_HEADERS entry must contain "=": ${JSON.stringify(value)}`);
    }

    const name = value.slice(0, i).trim();
    const header_value = value.slice(i + 1).trim();

    if (!name) {
        throw new Error(`AUTHWALL_SET_HEADERS entry must have a header name: ${JSON.stringify(value)}`);
    }

    http.validateHeaderName(name);
    http.validateHeaderValue(name, header_value);

    return {name, value: header_value};
}

module.exports = parse_set_headers;
