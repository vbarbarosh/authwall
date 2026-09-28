// Express reads req.path with url.parse, which ends the path at "#", while the
// proxy forwards the raw target: "/favicon.ico#/../admin" is judged as
// "/favicon.ico" and served as "/admin" by an upstream that keeps the "#".
// Only an origin-form target (RFC 9112 3.2.1) is judged: a path, no fragment.
function is_origin_form(target)
{
    return (typeof target === 'string') && target.startsWith('/') && !target.includes('#');
}

module.exports = is_origin_form;
