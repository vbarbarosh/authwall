const async_hooks = require('async_hooks');
const config = require('../config');
const knex = require('knex');

const als = new async_hooks.AsyncLocalStorage();
const inst = knex(config.knexvars);

als.enterWith(inst);

function current()
{
    return als.getStore();// ?? inst;
}

const db = new Proxy(function () {}, {
    apply(_, __, args) {
        return current()(...args);
    },
    get(_, prop) {
        if (prop === '__mocha__') {
            return {als, inst};
        }
        if (prop === 'destroy') {
            return inst.destroy.bind(inst);
        }
        if (prop === 'transaction') {
            return async function (fn) {
                if (!fn) {
                    throw new Error('db.transaction(fn) requires a callback');
                }
                if (fn.length > 0) {
                    throw new Error('db.transaction(fn) must not accept arguments');
                }
                // Nested transactions: always create a savepoint
                return current().transaction(trx => als.run(trx, fn));
            };
        }
        const target = current();
        const value = target[prop];
        if (typeof value === 'function') {
            return value.bind(target);
        }
        return value;
    }
});

module.exports = db;
