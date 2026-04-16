const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');

function make_rate_limit_middleware(max, window_ms)
{
    if (process.env.AUTHWALL_RATE_LIMITING === '0') {
        return function rate_limit_middleware(req, res, next) { next(); };
    }

    const counts = new Map();

    // Periodically evict expired entries to keep the Map bounded
    const timer = setInterval(tick, window_ms);
    timer.unref();

    return rate_limit_middleware;

    function rate_limit_middleware(req, res, next) {
        const now = Date.now();
        const key = req.ip;
        const entry = counts.get(key) ?? {count: 0, reset_at: now + window_ms};

        if (now > entry.reset_at) {
            entry.count = 0;
            entry.reset_at = now + window_ms;
        }

        entry.count++;
        counts.set(key, entry);

        if (entry.count > max) {
            next(new UserFriendlyError('Too many requests, please try again later'));
            return;
        }

        next();
    }

    function tick() {
        const now = Date.now();
        for (const [key, entry] of counts) {
            if (now > entry.reset_at) {
                counts.delete(key);
            }
        }
    }
}

module.exports = make_rate_limit_middleware;
