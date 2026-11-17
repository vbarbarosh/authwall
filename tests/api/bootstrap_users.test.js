const assert = require('assert');
const bcrypt = require('bcrypt');
const bootstrap_users = require('../../src/helpers/bootstrap_users');
const config = require('../../config');
const const_user_identity = require('../../src/helpers/const/const_user_identity');
const db = require('../../db');
const fs = require('fs');
const os = require('os');
const parse_authwall_seed = require('../../src/helpers/parse/parse_authwall_seed');
const parse_authwall_seed_file = require('../../src/helpers/parse/parse_authwall_seed_file');
const path = require('path');

describe('bootstrap_users', function () {

    it('does not write the password of a rejected seed to the log', async function () {
        config.seed_users = [{username: '<bad>', password: 'hunter2-plain', password_hash: '$2b$12$hash', email: []}];

        await bootstrap_users();

        const logs = this.written_logs.join('\n');
        assert.ok(logs.includes('Skipping invalid user seed'));
        assert.strictEqual(logs.includes('hunter2-plain'), false);
        assert.strictEqual(logs.includes('$2b$12$hash'), false);
        assert.ok(logs.includes('[Filtered]'));
    });

    it('seeds the users of AUTHWALL_SEED_FILE, who sign in with the password behind the hash', async function () {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-file-'));
        await using _ = {[Symbol.asyncDispose]: () => fs.promises.rm(dir, {recursive: true, force: true})};
        const file = path.join(dir, 'users.csv');
        fs.writeFileSync(file, `username,emails,password_hash\nalice,,${await bcrypt.hash('alice-pass-1', 4)}\n`);
        config.seed_users = parse_authwall_seed_file(file);

        await bootstrap_users();
        await this.http_post_json('/auth/sign-in', {username: 'alice', password: 'alice-pass-1'});

        const status = await this.http_get_json('/auth/status');
        assert.strictEqual(status.authenticated, true);
        assert.strictEqual(this.written_logs.join('\n').includes('alice-pass-1'), false);
    });

    it('adds the missing address to the user found by username, and says so', async function () {
        const {user_id} = await this.add_user({username: 'admin'});
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');

        await bootstrap_users();

        const identities = await db('user_identities').orderBy('type');
        assert.deepStrictEqual(identities.map(v => `${v.type}:${v.value}:${v.user_id}`), [`email:admin@myapp.test:${user_id}`, `username:admin:${user_id}`]);
        assert.ok(this.written_logs.some(v => v.includes('➕ Added identities username=[admin]')));
    });

    it('says no changes when the seeded user already has every identity', async function () {
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');
        await bootstrap_users();
        this.written_logs.splice(0);

        await bootstrap_users();

        assert.strictEqual((await db('users')).length, 1);
        assert.strictEqual((await db('user_identities')).length, 2);
        assert.ok(this.written_logs.some(v => v.includes('⏭️ No changes username=[admin]')));
    });

    // Two copies starting at once on one fresh database: each finds no
    // identity, and only one of them may end up owning the user.
    it('leaves one user, owning every identity, when two copies seed it at once [concurrent]', async function () {
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');

        await Promise.all([bootstrap_users(), bootstrap_users()]);

        const users = await db('users');
        const identities = await db('user_identities').orderBy('type');
        assert.strictEqual(users.length, 1);
        assert.deepStrictEqual(identities.map(v => `${v.type}:${v.value}:${v.user_id}`), [`email:admin@myapp.test:${users[0].id}`, `username:admin:${users[0].id}`]);
        assert.strictEqual(this.written_logs.filter(v => v.includes('👤 Created user')).length, 1);
        assert.strictEqual(this.written_logs.filter(v => v.includes('⏭️ No changes')).length, 1);
    });

    it('creates the user of a seed that names one address twice, in another case', async function () {
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test,ADMIN@myapp.test');

        await bootstrap_users();

        const users = await db('users');
        const identities = await db('user_identities').orderBy('type');
        assert.strictEqual(users.length, 1);
        assert.deepStrictEqual(identities.map(v => `${v.type}:${v.value}:${v.user_id}`), [`email:admin@myapp.test:${users[0].id}`, `username:admin:${users[0].id}`]);
        assert.ok(this.written_logs.some(v => v.includes('👤 Created user username=[admin]')));
    });

    // A stranger signs up with the admin's address and never confirms it;
    // the operator seeds the admin with that address a moment later.
    it('takes an address another account holds unconfirmed, and does not join that account', async function () {
        await this.http_post_json('/auth/sign-up', {email: 'admin@myapp.test', password: 'strangers-pass-1', password_confirm: 'strangers-pass-1'});
        const pending = await db('user_identities').where({type: const_user_identity.email, value_normalized: 'admin@myapp.test'}).first();
        assert.strictEqual(pending.verified_at, null);
        this.client.cookies.clear();
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');

        await bootstrap_users();
        await this.http_post_json('/auth/sign-in', {username: 'admin', password: 'change-me'});

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: true, error: null});
        const admin = await db('user_identities').where({type: const_user_identity.username, value_normalized: 'admin'}).first();
        const address = await db('user_identities').where({type: const_user_identity.email, value_normalized: 'admin@myapp.test'}).first();
        assert.notStrictEqual(admin.user_id, pending.user_id);
        assert.strictEqual(address.user_id, admin.user_id);
        assert.ok(address.verified_at);
        assert.deepStrictEqual(await db('user_identities').where({user_id: pending.user_id}), []);
        assert.partialDeepStrictEqual(await db('auth_events').where({user_id: pending.user_id, event_type: 'identity_removed'}).first(), {identity_value_normalized: 'admin@myapp.test', custom: JSON.stringify({reason: 'pending_email_seeded'})});
        assert.ok(this.written_logs.some(v => v.includes('👤 Created user username=[admin]')));
    });

    it('takes an address another account holds unconfirmed for the user found by username', async function () {
        const {user_id} = await this.add_user({username: 'admin'});
        const stranger = await this.add_user({email: 'admin@myapp.test', verified: false});
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');

        await bootstrap_users();

        const identities = await db('user_identities').orderBy('type');
        assert.deepStrictEqual(identities.map(v => `${v.type}:${v.value}:${v.user_id}:${Boolean(v.verified_at)}`), [`email:admin@myapp.test:${user_id}:true`, `username:admin:${user_id}:true`]);
        assert.ok(await db('auth_events').where({user_id: stranger.user_id, event_type: 'identity_removed'}).first());
        assert.ok(this.written_logs.some(v => v.includes('➕ Added identities username=[admin]')));
    });

    it('adds the missing username to the user found by a confirmed address', async function () {
        const {user_id} = await this.add_user({email: 'admin@myapp.test'});
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');

        await bootstrap_users();

        const identities = await db('user_identities').orderBy('type');
        assert.deepStrictEqual(identities.map(v => `${v.type}:${v.value}:${v.user_id}`), [`email:admin@myapp.test:${user_id}`, `username:admin:${user_id}`]);
        assert.strictEqual(await db('auth_events').where({event_type: 'identity_removed'}).first(), undefined);
        assert.ok(this.written_logs.some(v => v.includes('➕ Added identities username=[admin]')));
    });

});
