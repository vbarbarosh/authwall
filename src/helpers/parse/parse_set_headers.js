const http = require('http');

function parse_set_headers(value)
{
    if (!value) {
        return [];
    }

    return String(value).split(';').map(v => v.trim()).filter(Boolean).map(parse_set_header);
}

// An entry may carry a credential for the upstream, and a wrong one is
// printed to the log at every restart: an error names the entry by its
// number and the form expected, never its text. Node's own checks quote the
// name, which holds the value when a space stands for the "=" (AW-173).
function parse_set_header(value, index)
{
    const entry = `AUTHWALL_SET_HEADERS entry ${index + 1}`;
    const i = value.indexOf('=');
    if (i === -1) {
        throw new Error(`${entry} must contain "=": Header-Name=value`);
    }

    const name = value.slice(0, i).trim();
    const header_value = value.slice(i + 1).trim();

    if (!name) {
        throw new Error(`${entry} must have a header name: Header-Name=value`);
    }
    try {
        http.validateHeaderName(name);
    }
    catch {
        throw new Error(`${entry} must have a header name of letters, digits and -: Header-Name=value`);
    }
    try {
        http.validateHeaderValue(name, header_value);
    }
    catch {
        throw new Error(`${entry} must have a value a header can carry: no control characters`);
    }

    return {name, value: header_value};
}

module.exports = parse_set_headers;
