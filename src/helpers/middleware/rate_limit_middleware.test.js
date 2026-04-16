const assert = require('assert');
const make_rate_limit_middleware = require('./rate_limit_middleware');

describe('make_rate_limit_middleware', function () {

    function make_req(ip = '1.2.3.4') {
        return {ip};
    }

    function collect_next() {
        const errors = [];
        const next = (err) => errors.push(err ?? null);
        next.errors = errors;
        return next;
    }

    it('allows requests under the limit', function () {
        const middleware = make_rate_limit_middleware(3, 60000);
        const req = make_req();
        for (let i = 0; i < 3; i++) {
            const next = collect_next();
            middleware(req, {}, next);
            assert.strictEqual(next.errors[0], null);
        }
    });

    it('blocks requests over the limit', function () {
        const middleware = make_rate_limit_middleware(3, 60000);
        const req = make_req();
        for (let i = 0; i < 3; i++) {
            middleware(req, {}, collect_next());
        }
        const next = collect_next();
        middleware(req, {}, next);
        assert.ok(next.errors[0] instanceof Error);
        assert.strictEqual(next.errors[0].message, 'Too many requests, please try again later');
    });

    it('tracks limits per IP independently', function () {
        const middleware = make_rate_limit_middleware(2, 60000);
        const req_a = make_req('1.1.1.1');
        const req_b = make_req('2.2.2.2');
        middleware(req_a, {}, collect_next());
        middleware(req_a, {}, collect_next());
        // req_a is now at limit; req_b should still be allowed
        const next_a = collect_next();
        middleware(req_a, {}, next_a);
        assert.ok(next_a.errors[0] instanceof Error);
        const next_b = collect_next();
        middleware(req_b, {}, next_b);
        assert.strictEqual(next_b.errors[0], null);
    });

    it('resets count after window expires', function () {
        const middleware = make_rate_limit_middleware(2, 1);
        const req = make_req();
        middleware(req, {}, collect_next());
        middleware(req, {}, collect_next());
        // exceed limit
        const blocked = collect_next();
        middleware(req, {}, blocked);
        assert.ok(blocked.errors[0] instanceof Error);
        // wait for window to expire
        return new Promise(resolve => setTimeout(() => {
            const next = collect_next();
            middleware(req, {}, next);
            assert.strictEqual(next.errors[0], null);
            resolve();
        }, 10));
    });

    it('is bypassed when AUTHWALL_RATE_LIMITING=0', function () {
        process.env.AUTHWALL_RATE_LIMITING = '0';
        try {
            const middleware = make_rate_limit_middleware(1, 60000);
            const req = make_req();
            for (let i = 0; i < 5; i++) {
                const next = collect_next();
                middleware(req, {}, next);
                assert.strictEqual(next.errors[0], null);
            }
        }
        finally {
            delete process.env.AUTHWALL_RATE_LIMITING;
        }
    });

});
