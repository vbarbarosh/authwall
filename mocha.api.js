require('dotenv/config');
// A per-run database: the suite must never touch data/db.sqlite3 (the
// developer's working copy) or whatever .env points at unless asked to
// explicitly by exporting AUTHWALL_DB.
const test_db_file = require('path').join(require('os').tmpdir(), `authwall-test-${process.pid}.sqlite3`);
process.env.AUTHWALL_DB ??= `sqlite://${test_db_file}`;
process.env.AUTHWALL_SECRET ??= require('crypto').randomBytes(32).toString('base64url');
process.env.AUTHWALL_RATE_LIMITING ??= '0';
process.env.AUTHWALL_MAILER = 'fake';
process.env.AUTHWALL_FLOWS = 'username,email,magic_link_and_code';
process.env.AUTHWALL_CONFIRM_EMAIL_REQUIRED = 'false';
process.env.AUTHWALL_BCRYPT_ROUNDS = '4';

const als = require('./src/helpers/als');
const bootstrap_database = require('./src/helpers/bootstrap_database');
const config = require('./config');
const knex = require('knex');
const make_logger_fake = require('./src/services/logger/make_logger_fake');
const make_logger_stdout = require('./src/services/logger/make_logger_stdout');
const make_mailer_fake = require('./src/services/mailer/make_mailer_fake');
const setup_servers = require('./tests/setup_servers');
const {Runnable} = require('mocha/lib/runnable');

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

// Children before parents: every other table references users.
const tables_in_delete_order = [
    'auth_events',
    'sessions',
    'personal_access_tokens',
    'password_reset_tokens',
    'email_verify_tokens',
    'email_change_tokens',
    'magic_links',
    'user_identities',
    'users',
];

async function truncate_all()
{
    for (const table of tables_in_delete_order) {
        await db(table).del();
    }
}

Runnable.prototype.run = function (fn) {
    if (this.type === 'test' && !this.fn.__wrapped__) {
        const original_fn = this.fn;
        this.fn = async function (...args) {
            this.written_logs = [];
            this.sent_emails = [];
            this.wait_for_emails = count => wait_for_emails(this.sent_emails, count);
            await using logger = make_logger_fake(this.written_logs);
            await using mailer = make_mailer_fake(this.sent_emails);
            if (this._runnable.title.includes('[concurrent]')) {
                // A test that fires simultaneous requests needs each request's
                // transaction on its own pooled connection, as in production.
                // Inside the per-test transaction below they would all share
                // one connection, the app's transactions would become savepoints
                // on it, and one request's ROLLBACK TO SAVEPOINT would erase
                // what another request had already written in between. Such a
                // test runs against the pool and is cleaned up by truncation.
                await using _ = {[Symbol.asyncDispose]: () => als.run({db}, truncate_all)};
                await setup_servers.spin({db, logger, mailer}, this, () => original_fn.apply(this, args));
                return;
            }
            const trx = await db.transaction();
            await using _ = {[Symbol.asyncDispose]: () => trx.rollback()};
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
            if (process.env.AUTHWALL_DB === `sqlite://${test_db_file}`) {
                await require('fs/promises').rm(test_db_file, {force: true});
            }
        },
        beforeEach: function () {
            for (const key of Object.keys(config)) {
                delete config[key];
            }
            Object.assign(config, structuredClone(saved_config));
        },
    },
};
