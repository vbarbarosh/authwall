const assert = require('assert');
const db_from_knexvars = require('./db_from_knexvars');
const fs = require('fs/promises');
const knexfile = require('../../knexfile');
const os = require('os');
const path = require('path');

describe('db_from_knexvars', function () {

    let umask = null;

    beforeEach(function () {
        umask = process.umask(0o022);
    });

    afterEach(function () {
        process.umask(umask);
    });

    // AW-169: SQLite made it 0644 under umask 022, readable by every user.
    it('makes a new SQLite file readable by its owner only', async function () {
        await using dir = await make_temp_dir();
        const file = path.join(dir.path, 'db.sqlite3');
        const db = db_from_knexvars({...knexfile.sqlite, connection: {filename: file}});
        await using _ = {[Symbol.asyncDispose]: () => db.destroy()};
        await db.raw('CREATE TABLE t (v INTEGER)');
        await db('t').insert({v: 1});
        assert.strictEqual((await fs.stat(file)).mode & 0o777, 0o600);
    });

    it('keeps the mode and the data of an existing file', async function () {
        await using dir = await make_temp_dir();
        const file = path.join(dir.path, 'db.sqlite3');
        const first = db_from_knexvars({...knexfile.sqlite, connection: {filename: file}});
        await first.raw('CREATE TABLE t (v INTEGER)');
        await first('t').insert({v: 1});
        await first.destroy();
        await fs.chmod(file, 0o640);
        const db = db_from_knexvars({...knexfile.sqlite, connection: {filename: file}});
        await using _ = {[Symbol.asyncDispose]: () => db.destroy()};
        assert.deepStrictEqual(await db('t').pluck('v'), [1]);
        assert.strictEqual((await fs.stat(file)).mode & 0o777, 0o640);
    });

});

async function make_temp_dir()
{
    const dir_path = await fs.mkdtemp(path.join(os.tmpdir(), 'authwall-db-file-'));
    return {path: dir_path, [Symbol.asyncDispose]: () => fs.rm(dir_path, {recursive: true, force: true})};
}
