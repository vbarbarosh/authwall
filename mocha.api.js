const Runnable = require('mocha/lib/runnable');
const db = require('./db');
const setup_servers = require('./tests/setup_servers');

const original_run = Runnable.prototype.run;

Runnable.prototype.run = function (fn) {
    if (!this.fn.__als_wrapped__) {
        const original_fn = this.fn;
        this.fn = function (...args) {
            if (this.__db_als__) {
                return this.__db_als__(original_fn, args);
            }
            return original_fn.apply(this, args);
        };
        this.fn.__als_wrapped__ = true;
    }
    return original_run.call(this, fn);
};

module.exports = {
    spec: 'tests/api/**/*.test.js',
    timeout: 10000,
    require: [__filename],
    mochaHooks: {
        beforeEach: async function () {
            await setup_servers.setup_servers_before_each.call(this);
        },
        afterEach: async function () {
            await setup_servers.setup_servers_after_each.call(this);
        },
        afterAll: async function () {
            await db.destroy();
        },
    },
};
