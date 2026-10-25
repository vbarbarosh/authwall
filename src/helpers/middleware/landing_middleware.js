// The SPA posts with fetch and asks for its landing (X-Authwall-Landing: ask):
// a fetch that followed the redirect loaded the landing before the page opened
// it, twice in all, and never reached a subdomain return, which the page's
// connect-src 'self' refuses (AW-32). Such a post gets {next} instead of the
// redirect, and the page goes there itself, once. The browser's own forms and
// links send no such header and keep the redirect.
function landing_middleware(req, res, next)
{
    if (req.get('x-authwall-landing') === 'ask') {
        res.redirect = function (...args) {
            res.json({next: args.at(-1)});
        };
    }
    next();
}

module.exports = landing_middleware;
