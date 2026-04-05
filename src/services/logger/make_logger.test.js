const assert = require('assert');
const make_logger = require('./make_logger');

describe('make_logger', function () {

    it('logs a message', function () {
        const lines = [];
        const log = make_logger({append: s => lines.push(s)});

        log('hello');

        assert.deepStrictEqual(lines, [
            `[${log.group_uid}] hello`,
        ]);
    });

    it('spawn creates new group_uid', function () {
        const lines = [];
        const log = make_logger({append: s => lines.push(s)});

        log('a');
        const child = log.spawn();
        child('b');

        assert.deepStrictEqual(lines, [
            `[${log.group_uid}] a`,
            `[${child.group_uid}][parent] ${log.group_uid}`,
            `[${child.group_uid}] b`
        ]);
    });

    it('decorate modifies message', function () {
        const lines = [];
        const log = make_logger({append: s => lines.push(s), decorate: s => s + '!'});

        log('hello');

        assert.deepStrictEqual(lines, [
            `[${log.group_uid}] hello!`,
        ]);
    });

    it('does not add extra space if message starts with [', function () {
        const lines = [];
        const log = make_logger({append: s => lines.push(s)});

        log('[x]');

        assert.deepStrictEqual(lines, [
            `[${log.group_uid}][x]`,
        ]);
    });

    it('adds timestamp to each line', function () {
        const lines = [];
        const log = make_logger({append: s => lines.push(`[2021/01/01 01:01:01]${s}`)});

        log('foo');
        log('bar');

        assert.deepStrictEqual(lines, [
            `[2021/01/01 01:01:01][${log.group_uid}] foo`,
            `[2021/01/01 01:01:01][${log.group_uid}] bar`,
        ]);
    });

    it('adds delta to each line', function () {
        const lines = [];
        const log = make_logger({append: s => lines.push(s), decorate: s => `[+0.1234s]${s}`});

        log('foo');
        log('bar');
        log('[checkpoint1] foo');
        log('[checkpoint2] bar');

        assert.deepStrictEqual(lines, [
            `[${log.group_uid}][+0.1234s] foo`,
            `[${log.group_uid}][+0.1234s] bar`,
            `[${log.group_uid}][+0.1234s][checkpoint1] foo`,
            `[${log.group_uid}][+0.1234s][checkpoint2] bar`,
        ]);
    });

});
