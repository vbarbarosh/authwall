const assert = require('assert');
const child_process = require('child_process');
const config = require('../../../config');
const fs = require('fs/promises');
const knex = require('knex');
const knexfile = require('../../../knexfile');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

// See migrations_run_on_the_configured_database.md.
describe('Migrations run on the configured database | stories', function () {

    this.timeout(30000);

    it('bin/migrate and bin/migrate-rollback work on the SQLite file AUTHWALL_DB names (M-11)', async function () {
        await using dir = await make_temp_dir();
        const file = path.join(dir.path, 'app.sqlite3');
        const files = await fs.readdir(path.join(ROOT, 'db/migrations')).then(v => v.filter(vv => vv.endsWith('.js')).sort());

        const migrated = await run_bin('migrate', {AUTHWALL_DB: `sqlite://${file}`});
        assert.strictEqual(migrated.code, 0, migrated.output);
        assert.ok(migrated.output.startsWith(`🗄️ SQLite 3 ${file}\nBatch 1: ${files.length} applied\n`), migrated.output);
        assert.deepStrictEqual(await read_applied(file), files);

        const rolled_back = await run_bin('migrate-rollback', {AUTHWALL_DB: `sqlite://${file}`});
        assert.strictEqual(rolled_back.code, 0, rolled_back.output);
        assert.ok(rolled_back.output.startsWith(`🗄️ SQLite 3 ${file}\nBatch 1: ${files.length} rolled back\n`), rolled_back.output);
        assert.deepStrictEqual(await read_applied(file), []);
    });

    it('bin/migrate finds the database of this run up to date, on its engine (M-11)', async function () {
        const migrated = await run_bin('migrate', {AUTHWALL_DB: process.env.AUTHWALL_DB});
        assert.strictEqual(migrated.code, 0, migrated.output);
        assert.ok(migrated.output.startsWith(`🗄️ ${config.knexvars.custom.label} `), migrated.output);
        assert.match(migrated.output, /\nAlready up to date\n$/);
    });

});

async function make_temp_dir()
{
    const dir_path = await fs.mkdtemp(path.join(os.tmpdir(), 'authwall-migrate-'));
    return {path: dir_path, [Symbol.asyncDispose]: () => fs.rm(dir_path, {recursive: true, force: true})};
}

async function read_applied(file)
{
    const db = knex({...knexfile.sqlite, connection: {filename: file}});
    await using _ = {[Symbol.asyncDispose]: () => db.destroy()};
    return await db('knex_migrations').orderBy('id').pluck('name');
}

// A script of bin/ with none of this run's AUTHWALL_ settings: only those of
// the case.
function run_bin(name, env)
{
    const clean_env = Object.fromEntries(Object.entries(process.env).filter(v => !v[0].startsWith('AUTHWALL_')));
    return new Promise(function (resolve) {
        const chunks = [];
        const child = child_process.spawn(path.join(ROOT, 'bin', name), [], {cwd: ROOT, env: {...clean_env, ...env}});
        child.stdout.on('data', v => chunks.push(v));
        child.stderr.on('data', v => chunks.push(v));
        child.on('close', function (code, signal) {
            resolve({code: code ?? signal, output: Buffer.concat(chunks).toString()});
        });
    });
}
