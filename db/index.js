const als = require('../src/helpers/als');

const db = new Proxy(function () {}, {
    apply(_, __, args) {
        return als.db(...args);
    },
    get(_, prop) {
        if (prop === 'transaction') {
            return async function (fn) {
                if (!fn) {
                    throw new Error('db.transaction(fn) requires a callback');
                }
                if (fn.length > 0) {
                    throw new Error('db.transaction(fn) must not accept arguments');
                }
                // Nested transactions: always create a savepoint
                return als.db.transaction(trx => als.run({db: trx}, fn));
            };
        }
        const target = als.db;
        const value = target[prop];
        if (typeof value === 'function') {
            return value.bind(target);
        }
        return value;
    }
});

module.exports = db;
