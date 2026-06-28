const assert = require('assert');
const config = require('../../../config');
const fs_path_join = require('@vbarbarosh/node-helpers/src/fs_path_join');
const fs_read_utf8 = require('@vbarbarosh/node-helpers/src/fs_read_utf8');
const fs_tempdir = require('@vbarbarosh/node-helpers/src/fs_tempdir');
const make_logger_daily = require('./make_logger_daily');

describe('make_logger_daily', function () {

    let saved_logs_dir;

    before(function () {
        saved_logs_dir = config.logs_dir;
    });

    after(function () {
        config.logs_dir = saved_logs_dir;
    });

    it('can be disposed with await using', async function () {
        await fs_tempdir(async function (d) {
            config.logs_dir = d;
            {
                await using logger = make_logger_daily();
                logger.write('hello');
            }

            const file = fs_path_join(d, `app-${new Date().toISOString().slice(0, 10)}.log`);
            const text = await fs_read_utf8(file);
            assert.match(text, /\] hello\n$/);
        });
    });

});
