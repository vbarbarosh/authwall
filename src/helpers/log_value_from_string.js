// A string as a value in a log line's details (LOG-17): a printable ASCII
// word without spaces, double quotes, backslashes or square brackets is
// written bare, every other string JSON-quoted, so it can neither break the
// line nor mint a fake [tag].
function log_value_from_string(s)
{
    return /^[!#-Z^-~]+$/.test(s) ? s : JSON.stringify(s);
}

module.exports = log_value_from_string;
