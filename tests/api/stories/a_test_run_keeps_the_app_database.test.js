const assert = require('assert');
const child_process = require('child_process');
const fs = require('fs/promises');
const knex = require('knex');
const knexfile = require('../../../knexfile');
const net = require('net');
const os = require('os');
const path = require('path');
const promisify = require('../../../src/helpers/promisify');

const MOCHA_BIN = require.resolve('mocha/bin/mocha.js');
const ROOT = path.resolve(__dirname, '../../..');

describe('A test run keeps the app database | stories', function () {

    this.timeout(60000);

    it('runs the API suite on its own database when .env names the app database', async function () {
        await using dir = await make_app_dir();
        await fs.writeFile(path.join(dir.path, '.env'), `AUTHWALL_DB=${dir.app_db_url}\n`);
        const run = await run_node(dir.path, {}, [MOCHA_BIN, '--no-package', '--config', dir.mocha_config_file]);
        assert.strictEqual(run.code, 0, run.output);
        assert.match(run.output, /1 passing/);
        assert.deepStrictEqual(await read_app_db(dir), {uids: ['mocha'], marked: false});
    });

    it('refuses the app database exported as AUTHWALL_DB before the API suite migrates or empties it', async function () {
        await using dir = await make_app_dir();
        const run = await run_node(dir.path, {AUTHWALL_DB: dir.app_db_url}, [MOCHA_BIN, '--no-package', '--config', dir.mocha_config_file]);
        assert.notStrictEqual(run.code, 0, run.output);
        assert.match(run.output, /Refused: \S+app\.sqlite3 holds the table "knex_migrations" and no "test_database_mark"/);
        assert.deepStrictEqual(await read_app_db(dir), {uids: ['mocha'], marked: false});
    });

    it('starts the e2e server on its own database, never on a server already running', async function () {
        await using dir = await make_app_dir();
        await fs.writeFile(path.join(dir.path, '.env'), `AUTHWALL_DB=${dir.app_db_url}\n`);
        const script = `const v = require(${JSON.stringify(path.join(ROOT, 'playwright.config.js'))}).webServer[0]; process.stdout.write(JSON.stringify({db: v.env.AUTHWALL_DB, reuse: v.reuseExistingServer}));`;
        const run = await run_node(dir.path, {}, ['-e', script]);
        assert.strictEqual(run.code, 0, run.output);
        const actual = JSON.parse(run.output);
        assert.notStrictEqual(actual.db, dir.app_db_url);
        assert.strictEqual(actual.reuse, false);
    });

    it('refuses to start the e2e server on the app database', async function () {
        await using dir = await make_app_dir();
        const env = {AUTHWALL_DB: dir.app_db_url, AUTHWALL_LOGGER: 'stdout', AUTHWALL_SECRET: 'a'.repeat(32), PORT: String(await find_free_port()), LISTEN: '127.0.0.1'};
        const run = await run_node(dir.path, env, [path.join(ROOT, 'tests/playwright/start_server.js')]);
        assert.notStrictEqual(run.code, 0, run.output);
        assert.match(run.output, /Refused: \S+app\.sqlite3 holds the table "knex_migrations" and no "test_database_mark"/);
        assert.deepStrictEqual(await read_app_db(dir), {uids: ['mocha'], marked: false});
    });

});

// A folder with the app's database, Mocha's account in it, and a run of the
// API harness whose one test is [concurrent], so it empties the tables after.
async function make_app_dir()
{
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'authwall-app-db-'));
    const app_db_file = path.join(dir, 'app.sqlite3');
    const db = open_sqlite(app_db_file);
    try {
        await db.migrate.latest();
        await db('users').insert({uid: 'mocha', slug: 'mocha', created_at: new Date(), updated_at: new Date()});
    }
    finally {
        await db.destroy();
    }
    const spec_file = path.join(dir, 'empties_its_tables.js');
    await fs.writeFile(spec_file, `describe('the harness', function () {\n    it('[concurrent] empties the tables after this test', function () {});\n});\n`);
    const mocha_config_file = path.join(dir, 'mocha.config.js');
    await fs.writeFile(mocha_config_file, `module.exports = {...require(${JSON.stringify(path.join(ROOT, 'mocha.api.js'))}), spec: [${JSON.stringify(spec_file)}]};\n`);
    return {
        path: dir,
        app_db_file,
        app_db_url: `sqlite://${app_db_file}`,
        mocha_config_file,
        [Symbol.asyncDispose]: () => fs.rm(dir, {recursive: true, force: true}),
    };
}

async function read_app_db(dir)
{
    const db = open_sqlite(dir.app_db_file);
    try {
        const uids = await db('users').pluck('uid');
        const marked = await db.schema.hasTable('test_database_mark');
        return {uids, marked};
    }
    finally {
        await db.destroy();
    }
}

async function find_free_port()
{
    const server = net.createServer();
    await promisify(v => server.listen(0, '127.0.0.1', v));
    const {port} = server.address();
    await promisify(v => server.close(v));
    return port;
}

function open_sqlite(file)
{
    return knex({...knexfile.sqlite, connection: {filename: file}});
}

// Node in a folder of its own, with none of this run's AUTHWALL_ settings:
// only those of the case. Killed after 30 seconds, as a server that started.
function run_node(cwd, env, args)
{
    const clean_env = Object.fromEntries(Object.entries(process.env).filter(v => !v[0].startsWith('AUTHWALL_')));
    return new Promise(function (resolve) {
        const chunks = [];
        const child = child_process.spawn(process.execPath, args, {cwd, env: {...clean_env, ...env}});
        const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
        child.stdout.on('data', v => chunks.push(v));
        child.stderr.on('data', v => chunks.push(v));
        child.on('close', function (code, signal) {
            clearTimeout(timer);
            resolve({code: code ?? signal, output: Buffer.concat(chunks).toString()});
        });
    });
}
