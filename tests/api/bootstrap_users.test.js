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

// A seed whose second entry names two people's addresses, a pending one and
// a new one.
const SEED_TWO_OWNERS = [
    {username: 'ops', emails: ['ops@myapp.test']},
    {username: 'admin', emails: ['alice@myapp.test', 'bob@myapp.test', 'pending@myapp.test', 'new@myapp.test']},
];

// Each form an operator can write a seed in.
const SEED_SOURCES = [
    {name: 'AUTHWALL_SEED, compact', parse: v => parse_authwall_seed(v.map(vv => `${vv.username}:pass-1234:${vv.emails.join(',')}`).join(';'))},
    {name: 'AUTHWALL_SEED, JSON', parse: v => parse_authwall_seed(JSON.stringify(v))},
    {name: 'AUTHWALL_SEED_FILE, CSV', parse: v => seed_from_file('users.csv', `username,emails,password_hash\n${v.map(vv => `${vv.username},"${vv.emails.join(' ')}",`).join('\n')}\n`)},
    {name: 'AUTHWALL_SEED_FILE, JSON', parse: v => seed_from_file('users.json', JSON.stringify(v))},
];

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

    // A stranger signs up as admin while sign-up is open; the operator seeds
    // admin with the company address a moment later.
    it('leaves alone the account a stranger signed up with its username, and warns', async function () {
        await this.http_post_json('/auth/sign-up', {username: 'admin', password: 'strangers-pass-1', password_confirm: 'strangers-pass-1'});
        const stranger = await db('user_identities').where({type: const_user_identity.username, value_normalized: 'admin'}).first();
        this.client.cookies.clear();
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');

        await bootstrap_users();
        await this.http_post_json('/auth/sign-in', {username: 'admin', password: 'change-me'});

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {authenticated: false});
        const identities = await db('user_identities').orderBy('type');
        assert.deepStrictEqual(identities.map(v => `${v.type}:${v.value}:${v.user_id}`), [`username:admin:${stranger.user_id}`]);
        assert.strictEqual((await db('users')).length, 1);
        assert.ok(this.written_logs.some(v => v.includes('[seed_user_left_alone] ⚠️ username=admin ')));
        assert.strictEqual(this.written_logs.some(v => v.includes('Added identities')), false);
    });

    // The cost of the above: the seed cannot tell its own admin, made before
    // the seed had an address, from a stranger's.
    it('gives no new address to its own user that holds none of its addresses yet, and warns', async function () {
        config.seed_users = parse_authwall_seed('admin:change-me');
        await bootstrap_users();
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');
        this.written_logs.splice(0);

        await bootstrap_users();

        const identities = await db('user_identities').orderBy('type');
        assert.deepStrictEqual(identities.map(v => v.type), ['username']);
        assert.ok(this.written_logs.some(v => v.includes('[seed_user_left_alone] ⚠️ username=admin ')));
    });

    // A stranger takes the username between the seed's lookup and its insert:
    // the seed, rolled back, finds that account by its username alone.
    it('leaves alone the account that took its username while it was seeding [concurrent]', async function () {
        const stranger = await this.add_user({email: 'stranger@evil.test', password: 'strangers-pass-1'});
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');
        let taken = null;
        function take(query) {
            // The first lookup holds the one connection; this insert is next.
            if (!taken && query.sql.startsWith('select') && query.sql.includes('user_identities')) {
                const now = new Date();
                taken = db('user_identities').insert({uid: 'stranger-admin', user_id: stranger.user_id, type: const_user_identity.username, value: 'admin', value_normalized: 'admin', created_at: now, updated_at: now, verified_at: now}).then();
            }
        }
        db.on('query', take);
        await using _ = {[Symbol.asyncDispose]: () => db.removeListener('query', take)};

        await bootstrap_users();
        await taken;

        const identities = await db('user_identities').orderBy('type');
        assert.deepStrictEqual(identities.map(v => `${v.type}:${v.value}:${v.user_id}`), [`email:stranger@evil.test:${stranger.user_id}`, `username:admin:${stranger.user_id}`]);
        assert.strictEqual((await db('users')).length, 1);
        assert.ok(this.written_logs.some(v => v.includes('[seed_user_left_alone] ⚠️ username=admin ')));
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

    it('takes an address another account holds unconfirmed for the user found by a confirmed one', async function () {
        const {user_id} = await this.add_user({email: 'admin@myapp.test'});
        const stranger = await this.add_user({email: 'ops@myapp.test', verified: false});
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test,ops@myapp.test');

        await bootstrap_users();

        const identities = await db('user_identities').orderBy(['type', 'value']);
        assert.deepStrictEqual(identities.map(v => `${v.type}:${v.value}:${v.user_id}:${Boolean(v.verified_at)}`), [`email:admin@myapp.test:${user_id}:true`, `email:ops@myapp.test:${user_id}:true`, `username:admin:${user_id}:true`]);
        assert.ok(await db('auth_events').where({user_id: stranger.user_id, event_type: 'identity_removed'}).first());
        assert.ok(this.written_logs.some(v => v.includes('➕ Added identities username=[admin]')));
    });

    // The account holding the username holds the address too, but nobody
    // confirmed it: a sign-up with both, by anyone.
    it('leaves alone the account found by its username that holds its address unconfirmed', async function () {
        const stranger = await this.add_user({username: 'admin', email: 'admin@myapp.test', verified: false});
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test');

        await bootstrap_users();

        const identities = await db('user_identities').orderBy('type');
        assert.deepStrictEqual(identities.map(v => `${v.type}:${v.value}:${v.user_id}:${Boolean(v.verified_at)}`), [`email:admin@myapp.test:${stranger.user_id}:false`, `username:admin:${stranger.user_id}:true`]);
        assert.ok(this.written_logs.some(v => v.includes('[seed_user_left_alone] ⚠️ username=admin ')));
    });

    it('says no changes, and no warning, when a seed with no address finds its username', async function () {
        config.seed_users = parse_authwall_seed('alice:alice-pass-1');
        await bootstrap_users();
        this.written_logs.splice(0);

        await bootstrap_users();

        assert.strictEqual((await db('users')).length, 1);
        assert.ok(this.written_logs.some(v => v.includes('⏭️ No changes username=[alice]')));
        assert.strictEqual(this.written_logs.some(v => v.includes('seed_user_left_alone')), false);
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

    // An operator's mistake (AW-117): one entry names the addresses of two
    // people. Neither gets the other's or the entry's new one, a pending one
    // stays where it is, and the log says which entry and whose they are.
    for (const source of SEED_SOURCES) {
        it(`refuses an entry whose addresses two accounts hold confirmed, and changes nothing (${source.name})`, async function () {
            const alice = await this.add_user({email: 'alice@myapp.test'});
            const bob = await this.add_user({email: 'bob@myapp.test'});
            const stranger = await this.add_user({email: 'pending@myapp.test', verified: false});
            config.seed_users = source.parse(SEED_TWO_OWNERS);

            await bootstrap_users();

            const ops = await db('user_identities').where({type: const_user_identity.username, value_normalized: 'ops'}).first();
            assert.deepStrictEqual(await identities_list(), [
                `email:alice@myapp.test:${alice.user_id}:true`,
                `email:bob@myapp.test:${bob.user_id}:true`,
                `email:ops@myapp.test:${ops.user_id}:true`,
                `email:pending@myapp.test:${stranger.user_id}:false`,
                `username:ops:${ops.user_id}:true`,
            ]);
            assert.deepStrictEqual(await db('auth_events').where({event_type: 'identity_removed'}), []);
            const alice_uid = (await db('users').where({id: alice.user_id}).first()).uid;
            const bob_uid = (await db('users').where({id: bob.user_id}).first()).uid;
            const refused = `[seed_user_owners_differ] ⚠️ seed_user=2 username=admin user_uid_by_identity={"email:alice@myapp.test":"${alice_uid}","email:bob@myapp.test":"${bob_uid}"} `;
            assert.ok(this.written_logs.some(v => v.includes(refused)), this.written_logs.join('\n'));
            assert.strictEqual(this.written_logs.some(v => v.includes('username=[admin]')), false);
        });
    }

    // A stranger signed up as admin; the company's admin holds the address.
    it('refuses an entry whose username one account holds and whose address another holds confirmed', async function () {
        const admin = await this.add_user({email: 'admin@myapp.test'});
        const stranger = await this.add_user({username: 'admin', password: 'strangers-pass-1'});
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test,ops@myapp.test');

        await bootstrap_users();

        assert.deepStrictEqual(await identities_list(), [`email:admin@myapp.test:${admin.user_id}:true`, `username:admin:${stranger.user_id}:true`]);
        assert.ok(this.written_logs.some(v => v.includes('[seed_user_owners_differ] ⚠️ seed_user=1 username=admin ')));
    });

    it('adds to the account that holds two of its addresses confirmed', async function () {
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test,ops@myapp.test');
        await bootstrap_users();
        config.seed_users = parse_authwall_seed('admin:change-me:admin@myapp.test,ops@myapp.test,new@myapp.test');
        this.written_logs.splice(0);

        await bootstrap_users();

        const users = await db('users');
        assert.strictEqual(users.length, 1);
        assert.strictEqual((await db('user_identities').where({user_id: users[0].id})).length, 4);
        assert.ok(this.written_logs.some(v => v.includes('➕ Added identities username=[admin]')));
    });

});

function seed_from_file(name, text)
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-file-'));
    try {
        const file = path.join(dir, name);
        fs.writeFileSync(file, text);
        return parse_authwall_seed_file(file);
    }
    finally {
        fs.rmSync(dir, {recursive: true, force: true});
    }
}

async function identities_list()
{
    const identities = await db('user_identities').orderBy(['type', 'value']);
    return identities.map(v => `${v.type}:${v.value}:${v.user_id}:${Boolean(v.verified_at)}`);
}
