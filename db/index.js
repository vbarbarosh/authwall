const async_hooks = require('async_hooks');
const config = require('../config');
const knex = require('knex');

const als = new async_hooks.AsyncLocalStorage();
const inst = knex(config.knexvars);

function current()
{
    const out = als.getStore();
    if (out) {
        return out;
    }
    throw new Error('db out of AsyncLocalStorage');
}

function root_als(fn)
{
    return als.run(inst, fn);
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
        if (prop === 'root_als') {
            return root_als;
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
