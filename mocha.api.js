// util._extend used in http-proxy (transitive dep of http-proxy-middleware) — cannot be fixed upstream
//
// node_modules/http-proxy$ g _extend
// lib/http-proxy/index.js
// 2:    extend    = require('util')._extend,
//
// lib/http-proxy/common.js
// 3:    extend   = require('util')._extend,
process.removeAllListeners('warning');
process.on('warning', function (event) {
    if (event.code === 'DEP0060') {
        return;
    }
    process.stderr.write(event.stack + '\n');
});

require('dotenv/config');
process.env.AUTHWALL_SECRET ??= require('crypto').randomBytes(32).toString('base64url');
process.env.AUTHWALL_RATE_LIMITING ??= '0';
process.env.AUTHWALL_MAILER = 'fake';
process.env.AUTHWALL_BCRYPT_ROUNDS = '4';

const Runnable = require('mocha/lib/runnable');
const als = require('./src/helpers/als');
const bootstrap_database = require('./src/helpers/bootstrap_database');
const config = require('./config');
const knex = require('knex');
const make_logger_fake = require('./src/services/logger/make_logger_fake');
const make_logger_stdout = require('./src/services/logger/make_logger_stdout');
const make_mailer_fake = require('./src/services/mailer/make_mailer_fake');
const setup_servers = require('./tests/setup_servers');

const db = knex(config.knexvars);
const original_run = Runnable.prototype.run;
const saved_config = structuredClone(config);

async function wait_for_emails(sent_emails, count, timeout_ms = 500)
{
    const deadline = Date.now() + timeout_ms;
    while (sent_emails.length < count) {
        if (Date.now() >= deadline) {
            throw new Error(`Timed out waiting for ${count} email(s) (got ${sent_emails.length})`);
        }
        await new Promise(resolve => setImmediate(resolve));
    }
}

Runnable.prototype.run = function (fn) {
    if (this.type === 'test' && !this.fn.__wrapped__) {
        const original_fn = this.fn;
        this.fn = async function (...args) {
            this.written_logs = [];
            this.sent_emails = [];
            this.wait_for_emails = count => wait_for_emails(this.sent_emails, count);
            const trx = await db.transaction();
            await using _ = {[Symbol.asyncDispose]: () => trx.rollback()};
            await using logger = make_logger_fake(this.written_logs);
            await using mailer = make_mailer_fake(this.sent_emails);
            await setup_servers.spin({db: trx, logger, mailer}, this, () => original_fn.apply(this, args));
        };
        this.fn.__wrapped__ = true;
    }
    return original_run.call(this, fn);
};

module.exports = {
    spec: 'tests/api/**/*.test.js',
    timeout: 10000,
    require: [__filename],
    mochaHooks: {
        beforeAll: async function () {
            this.timeout(30000);
            await using logger = make_logger_stdout();
            await als.run({db, logger}, () => bootstrap_database());
            process.stdout.write('\n');
        },
        afterAll: async function () {
            await db.destroy();
        },
        beforeEach: function () {
            for (const key of Object.keys(config)) {
                delete config[key];
            }
            Object.assign(config, structuredClone(saved_config));
        },
    },
};
