// A URL with its password as ***, for a line an operator reads: the startup
// summary, the migrate scripts. A value that is not a URL comes back as is.
function redact_url_password(value)
{
    try {
        const url = new URL(value);
        if (url.password) {
            url.password = '***';
        }
        return url.toString();
    }
    catch {
        return value;
    }
}

module.exports = redact_url_password;
