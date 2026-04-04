const Runnable = require('mocha/lib/runnable');
const db = require('../../db');

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
    mochaHooks: {
        afterAll: async function () {
            await db.destroy();
        },
    },
};
