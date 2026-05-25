const assert = require('assert');
const make_failure_counter = require('./make_failure_counter');

describe('make_failure_counter', function () {

    it('starts unblocked', function () {
        const limiter = make_failure_counter(3, 60000);
        assert.strictEqual(limiter.is_blocked('1.1.1.1'), false);
    });

    it('blocks once max failures are recorded', function () {
        const limiter = make_failure_counter(3, 60000);
        for (let i = 0; i < 3; i++) limiter.record_failure('1.1.1.1');
        assert.strictEqual(limiter.is_blocked('1.1.1.1'), true);
    });

    it('does not block at max minus one', function () {
        const limiter = make_failure_counter(3, 60000);
        for (let i = 0; i < 2; i++) limiter.record_failure('1.1.1.1');
        assert.strictEqual(limiter.is_blocked('1.1.1.1'), false);
    });

    it('tracks limits per key independently', function () {
        const limiter = make_failure_counter(2, 60000);
        limiter.record_failure('1.1.1.1');
        limiter.record_failure('1.1.1.1');
        assert.strictEqual(limiter.is_blocked('1.1.1.1'), true);
        assert.strictEqual(limiter.is_blocked('2.2.2.2'), false);
    });

    it('resets count after window expires', async function () {
        const limiter = make_failure_counter(2, 1);
        limiter.record_failure('1.1.1.1');
        limiter.record_failure('1.1.1.1');
        assert.strictEqual(limiter.is_blocked('1.1.1.1'), true);
        await new Promise(resolve => setTimeout(resolve, 10));
        assert.strictEqual(limiter.is_blocked('1.1.1.1'), false);
    });

    it('reports retry_after_seconds when blocked', function () {
        const limiter = make_failure_counter(1, 60000);
        limiter.record_failure('1.1.1.1');
        const retry = limiter.retry_after_seconds('1.1.1.1');
        assert.ok(retry > 0 && retry <= 60, `expected 1..60, got ${retry}`);
    });

    it('returns 0 retry_after_seconds for unknown keys', function () {
        const limiter = make_failure_counter(1, 60000);
        assert.strictEqual(limiter.retry_after_seconds('1.1.1.1'), 0);
    });

    it('is bypassed when AUTHWALL_RATE_LIMITING=0', function () {
        process.env.AUTHWALL_RATE_LIMITING = '0';
        try {
            const limiter = make_failure_counter(1, 60000);
            for (let i = 0; i < 5; i++) limiter.record_failure('1.1.1.1');
            assert.strictEqual(limiter.is_blocked('1.1.1.1'), false);
            assert.strictEqual(limiter.retry_after_seconds('1.1.1.1'), 0);
        }
        finally {
            delete process.env.AUTHWALL_RATE_LIMITING;
        }
    });

});
