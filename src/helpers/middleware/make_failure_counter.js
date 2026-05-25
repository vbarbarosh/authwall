function make_failure_counter(max, window_ms)
{
    if (process.env.AUTHWALL_RATE_LIMITING === '0') {
        return {
            is_blocked: () => false,
            retry_after_seconds: () => 0,
            record_failure: () => {},
        };
    }

    const counts = new Map();
    const timer = setInterval(tick, window_ms);
    timer.unref();

    return {is_blocked, retry_after_seconds, record_failure};

    function is_blocked(key) {
        const entry = counts.get(key);
        return !!entry && Date.now() <= entry.reset_at && entry.count >= max;
    }

    function retry_after_seconds(key) {
        const entry = counts.get(key);
        if (!entry) {
            return 0;
        }
        return Math.max(0, Math.ceil((entry.reset_at - Date.now()) / 1000));
    }

    function record_failure(key) {
        const now = Date.now();
        const entry = counts.get(key) ?? {count: 0, reset_at: now + window_ms};
        if (now > entry.reset_at) {
            entry.count = 0;
            entry.reset_at = now + window_ms;
        }
        entry.count++;
        counts.set(key, entry);
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

module.exports = make_failure_counter;
