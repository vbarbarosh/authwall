const async_hooks = require('async_hooks');

const inst = new async_hooks.AsyncLocalStorage();

function current(prop)
{
    const obj = inst.getStore();
    if (!obj) {
        throw new Error('No ALS context');
    }
    if (!obj[prop]) {
        throw new Error(`Service Not Configured: ${prop}`);
    }
    return obj[prop];
}

const als = {
    get db() {
        return current('db');
    },
    get logger() {
        return current('logger');
    },
    get mailer() {
        return current('mailer');
    },
    run(extend, fn) {
        return inst.run({...(inst.getStore() ?? {}), ...extend}, fn);
    },
};

module.exports = als;
