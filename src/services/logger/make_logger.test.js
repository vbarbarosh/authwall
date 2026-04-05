const assert = require('assert');
const make_logger = require('./make_logger');

describe('make_logger', function () {

    it('logs a message', function () {
        const lines = [];
        using logger = make_logger({append: s => lines.push(s)});

        logger.write('hello');

        assert.deepStrictEqual(lines, [
            `[${logger.group_uid}] hello`,
        ]);
    });

    it('spawn creates new group_uid', function () {
        const lines = [];
        using logger = make_logger({append: s => lines.push(s)});

        logger.write('a');
        using child = logger.spawn();
        child.write('b');

        assert.deepStrictEqual(lines, [
            `[${logger.group_uid}] a`,
            `[${child.group_uid}][parent] ${logger.group_uid}`,
            `[${child.group_uid}] b`
        ]);
    });

    it('decorate modifies message', function () {
        const lines = [];
        using logger = make_logger({append: s => lines.push(s), decorate: s => s + '!'});

        logger.write('hello');

        assert.deepStrictEqual(lines, [
            `[${logger.group_uid}] hello!`,
        ]);
    });

    it('does not add extra space if message starts with [', function () {
        const lines = [];
        using logger = make_logger({append: s => lines.push(s)});

        logger.write('[x]');

        assert.deepStrictEqual(lines, [
            `[${logger.group_uid}][x]`,
        ]);
    });

    it('adds timestamp to each line', function () {
        const lines = [];
        using logger = make_logger({append: s => lines.push(`[2021/01/01 01:01:01]${s}`)});

        logger.write('foo');
        logger.write('bar');

        assert.deepStrictEqual(lines, [
            `[2021/01/01 01:01:01][${logger.group_uid}] foo`,
            `[2021/01/01 01:01:01][${logger.group_uid}] bar`,
        ]);
    });

    it('adds delta to each line', function () {
        const lines = [];
        const logger = make_logger({append: s => lines.push(s), decorate: s => `[+0.1234s]${s}`});

        logger.write('foo');
        logger.write('bar');
        logger.write('[checkpoint1] foo');
        logger.write('[checkpoint2] bar');

        assert.deepStrictEqual(lines, [
            `[${logger.group_uid}][+0.1234s] foo`,
            `[${logger.group_uid}][+0.1234s] bar`,
            `[${logger.group_uid}][+0.1234s][checkpoint1] foo`,
            `[${logger.group_uid}][+0.1234s][checkpoint2] bar`,
        ]);
    });

});
