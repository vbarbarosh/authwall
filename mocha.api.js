const Runnable = require('mocha/lib/runnable');
const config = require('./config');
const knex = require('knex');
const make_logger_fake = require('./src/services/logger/make_logger_fake');
const make_mailer_fake = require('./src/services/mailer/make_mailer_fake');
const setup_servers = require('./tests/setup_servers');

const db = knex(config.knexvars);
const original_run = Runnable.prototype.run;

Runnable.prototype.run = function (fn) {
    if (this.type === 'test' && !this.fn.__wrapped__) {
        const original_fn = this.fn;
        this.fn = async function (...args) {
            this.written_logs = [];
            this.sent_emails = [];
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
        afterAll: async function () {
            await db.destroy();
        },
    },
};
