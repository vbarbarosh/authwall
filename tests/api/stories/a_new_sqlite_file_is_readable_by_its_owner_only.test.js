const assert = require('assert');
const child_process = require('child_process');
const fs = require('fs/promises');
const net = require('net');
const os = require('os');
const path = require('path');
const promisify = require('../../../src/helpers/promisify');

const ROOT = path.resolve(__dirname, '../../..');

// See a_new_sqlite_file_is_readable_by_its_owner_only.md.
describe('A new SQLite file is readable by its owner only | stories', function () {

    this.timeout(30000);

    let umask = null;

    beforeEach(function () {
        umask = process.umask(0o022);
    });

    afterEach(function () {
        process.umask(umask);
    });

    it('bin/migrate makes it rw------- under umask 022 (AW-169)', async function () {
        await using dir = await make_temp_dir();
        const file = path.join(dir.path, 'db.sqlite3');
        const run = await run_node(['bin/migrate'], {AUTHWALL_DB: `sqlite://${file}`});
        assert.strictEqual(run.code, 0, run.output);
        assert.strictEqual((await fs.stat(file)).mode & 0o777, 0o600);
    });

    it('the first start makes it rw------- under umask 022 (AW-169)', async function () {
        await using dir = await make_temp_dir();
        const file = path.join(dir.path, 'db.sqlite3');
        const port = await find_free_port();
        const env = {AUTHWALL_DB: `sqlite://${file}`, AUTHWALL_LOGGER: 'stdout', AUTHWALL_SECRET: 'a'.repeat(32), LISTEN: '127.0.0.1', PORT: String(port)};
        const run = await run_node(['src/index.js'], env, `http://127.0.0.1:${port}/auth/health`);
        assert.strictEqual(run.code, 0, run.output);
        assert.strictEqual((await fs.stat(file)).mode & 0o777, 0o600);
    });

});

async function make_temp_dir()
{
    const dir_path = await fs.mkdtemp(path.join(os.tmpdir(), 'authwall-db-file-'));
    return {path: dir_path, [Symbol.asyncDispose]: () => fs.rm(dir_path, {recursive: true, force: true})};
}

async function find_free_port()
{
    const server = net.createServer();
    await promisify(v => server.listen(0, '127.0.0.1', v));
    const {port} = server.address();
    await promisify(v => server.close(v));
    return port;
}

// Node with none of this run's AUTHWALL_ settings, only the case's. A server
// is sent SIGTERM once its health_url answers 200.
function run_node(args, env, health_url = null)
{
    const clean_env = Object.fromEntries(Object.entries(process.env).filter(v => !v[0].startsWith('AUTHWALL_')));
    return new Promise(function (resolve) {
        const chunks = [];
        const child = child_process.spawn(process.execPath, args, {cwd: ROOT, env: {...clean_env, ...env}});
        child.stdout.on('data', v => chunks.push(v));
        child.stderr.on('data', v => chunks.push(v));
        child.on('close', function (code, signal) {
            resolve({code: code ?? signal, output: Buffer.concat(chunks).toString()});
        });
        if (health_url) {
            health_wait_tick();
        }
        async function health_wait_tick() {
            const response = await fetch(health_url).catch(() => null);
            if (response?.status === 200) {
                child.kill('SIGTERM');
                return;
            }
            if (child.exitCode === null) {
                setTimeout(health_wait_tick, 100);
            }
        }
    });
}
