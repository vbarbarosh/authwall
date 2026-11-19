const assert = require('assert');
const config = require('../../config');
const const_auth_event = require('../../src/helpers/const/const_auth_event');
const db = require('../../db');
const fs = require('fs');
const os = require('os');
const path = require('path');
const records_prune = require('../../src/helpers/records_prune');

const NOW = new Date('2026-11-19T12:00:00.000Z');
const HOUR_MS = 60*60*1000;
const DAY_MS = 24*HOUR_MS;

// One case per way a record ends, in milliseconds from NOW; a key starting
// with "gone" is deleted, one starting with "kept" stays.
const ONE_TIME_CASES = {
    'gone-expired': {expires_at: -2*DAY_MS},
    'gone-used': {expires_at: DAY_MS, used_at: -2*DAY_MS},
    'kept-expired-an-hour-ago': {expires_at: -HOUR_MS},
    'kept-live': {expires_at: DAY_MS},
};
const ENDED_CASES = {
    sessions: {
        'gone-expired': {expires_at: -2*DAY_MS},
        'kept-expired-an-hour-ago': {expires_at: -HOUR_MS},
        'kept-live': {expires_at: 29*DAY_MS},
    },
    magic_links: ONE_TIME_CASES,
    confirm_codes: ONE_TIME_CASES,
    email_verify_tokens: ONE_TIME_CASES,
    password_reset_tokens: ONE_TIME_CASES,
    email_change_tokens: ONE_TIME_CASES,
    personal_access_tokens: {
        'gone-expired': {expires_at: -2*DAY_MS},
        'gone-revoked': {revoked_at: -2*DAY_MS},
        'kept-revoked-an-hour-ago': {revoked_at: -HOUR_MS},
        'kept-never-expires': {},
    },
};

// The column each case's key is written to, to find it again.
const KEY_COLUMN_BY_TABLE = {
    sessions: 'uid',
    magic_links: 'token_hash',
    confirm_codes: 'code_hash',
    email_verify_tokens: 'token_hash',
    password_reset_tokens: 'token_hash',
    email_change_tokens: 'token_hash',
    personal_access_tokens: 'uid',
};

describe('records_prune', function () {

    // M-10: what ended goes a day later; an hour after it ended, it is still
    // there.
    it('deletes the records that ended more than a day ago, and keeps the rest', async function () {
        const {user_id} = await this.add_user({email: 'alice@myapp.test'});
        for (const [table, cases] of Object.entries(ENDED_CASES)) {
            for (const [key, times] of Object.entries(cases)) {
                await db(table).insert(row_make(table, user_id, key, times));
            }
        }

        const removed = await records_prune(NOW);

        for (const [table, cases] of Object.entries(ENDED_CASES)) {
            const keys = Object.keys(cases);
            const column = KEY_COLUMN_BY_TABLE[table];
            const kept = await db(table).whereIn(column, keys).pluck(column);
            assert.deepStrictEqual(kept.sort(), keys.filter(v => v.startsWith('kept')).sort(), table);
            assert.strictEqual(removed[table], keys.filter(v => v.startsWith('gone')).length, table);
        }
    });

    it('deletes the sign-in history older than a year, and keeps the newer', async function () {
        await db('auth_events').insert([event_row_make('gone-366-days-old', -366*DAY_MS), event_row_make('kept-364-days-old', -364*DAY_MS)]);

        const removed = await records_prune(NOW);

        assert.deepStrictEqual(await db('auth_events').pluck('uid'), ['kept-364-days-old']);
        assert.strictEqual(removed.auth_events, 1);
    });

    it('deletes the day log files older than a year, and leaves every other file', async function () {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logs-'));
        await using _ = {[Symbol.asyncDispose]: () => fs.promises.rm(dir, {recursive: true, force: true})};
        config.logs_dir = dir;
        for (const name of ['app-2025-11-18.log', 'app-2025-11-19.log', 'app-2026-11-19.log', 'app-2024-01-01.log.gz', 'notes.txt']) {
            fs.writeFileSync(path.join(dir, name), 'a line\n');
        }

        const removed = await records_prune(NOW);

        assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['app-2024-01-01.log.gz', 'app-2025-11-19.log', 'app-2026-11-19.log', 'notes.txt']);
        assert.strictEqual(removed.log_files, 1);
    });

    it('keeps everything when both periods are 0', async function () {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logs-'));
        await using _ = {[Symbol.asyncDispose]: () => fs.promises.rm(dir, {recursive: true, force: true})};
        config.logs_dir = dir;
        config.retention = {ended_days: 0, history_days: 0};
        fs.writeFileSync(path.join(dir, 'app-2020-01-01.log'), 'a line\n');
        await db('sessions').insert(row_make('sessions', null, 'kept-expired-long-ago', {expires_at: -1000*DAY_MS}));
        await db('auth_events').insert(event_row_make('kept-written-long-ago', -1000*DAY_MS));

        const removed = await records_prune(NOW);

        assert.ok(Object.values(removed).every(v => v === 0), JSON.stringify(removed));
        assert.strictEqual((await db('sessions')).length, 1);
        assert.strictEqual((await db('auth_events')).length, 1);
        assert.deepStrictEqual(fs.readdirSync(dir), ['app-2020-01-01.log']);
    });

    // A backlog, say of anonymous sessions, goes in batches until none is left.
    it('deletes a backlog larger than one batch', async function () {
        const rows = [];
        for (let i = 0; i < 1001; ++i) {
            rows.push(row_make('sessions', null, `gone-${i}`, {expires_at: -2*DAY_MS}));
        }
        await db.batchInsert('sessions', rows, 250);

        const removed = await records_prune(NOW);

        assert.strictEqual(removed.sessions, 1001);
        assert.strictEqual((await db('sessions')).length, 0);
    });

});

// A row of table with key in its key column, ending as times say.
function row_make(table, user_id, key, times)
{
    const created_at = new Date(NOW.getTime() - 40*DAY_MS);
    const base = {created_at, updated_at: created_at};
    for (const [column, ms] of Object.entries(times)) {
        base[column] = new Date(NOW.getTime() + ms);
    }
    switch (table) {
    case 'sessions':
        return {...base, uid: key, user_id, ip: '127.0.0.1', ua: 'test', custom: '{}', last_seen_at: created_at};
    case 'magic_links':
        return {...base, email: 'alice@myapp.test', email_normalized: 'alice@myapp.test', token_hash: key};
    case 'confirm_codes':
        return {...base, user_id, email_normalized: 'alice@myapp.test', code_hash: key};
    case 'email_verify_tokens':
        return {...base, user_id, email_normalized: 'alice@myapp.test', token_hash: key};
    case 'password_reset_tokens':
        return {...base, user_id, token_hash: key};
    case 'email_change_tokens':
        return {...base, user_id, email_normalized: 'alice@myapp.test', token_hash: key};
    case 'personal_access_tokens':
        return {...base, uid: key, user_id, label: key, token_hash: key, token_prefix: 'awp_test'};
    default:
        throw new Error(`row_make: no row for ${table}`);
    }
}

function event_row_make(uid, ms)
{
    return {uid, event_type: const_auth_event.sign_in, event_status: 'success', created_at: new Date(NOW.getTime() + ms)};
}
