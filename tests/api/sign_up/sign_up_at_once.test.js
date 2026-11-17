const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');

// Two people pick the same new name at the same moment: both pass the
// "already exists" check before either is saved, and the database's unique
// index stops the second. [concurrent] gives each request its own pooled
// connection, as in production (mocha.api.js).
describe('sign up twice at once | scenarios', function () {

    beforeEach(function () {
        config.flows.password.min_password_length = 4;
    });

    it('makes one account for a username, and tells the other it exists [concurrent]', async function () {
        const statuses = await sign_up_at_once(this, {username: 'mocha', password: 'pass123', password_confirm: 'pass123'});

        assert.strictEqual((await db('users')).length, 1);
        assert.strictEqual((await db('user_identities')).length, 1);
        assert_one_signed_in_one_refused(statuses);
    });

    it('makes one account for an email, and tells the other it exists [concurrent]', async function () {
        const statuses = await sign_up_at_once(this, {email: 'mocha@authwall.test', password: 'pass123', password_confirm: 'pass123'});

        assert.strictEqual((await db('users')).length, 1);
        assert.strictEqual((await db('user_identities')).length, 1);
        assert_one_signed_in_one_refused(statuses);
    });

});

// Posts the same sign-up from two browsers at the same instant, each with a
// session and a CSRF token of its own, and returns what /auth/status then
// says to each. The database is busy a moment, as when another copy writes:
// both requests wait for a connection, then run side by side, so each reads
// "no such identity" before either has saved its own.
async function sign_up_at_once(ctx, body)
{
    const browsers = [];
    for (let i = 0; i < 2; i++) {
        ctx.client.cookies = new Map();
        const {csrf_token} = await ctx.client.get_json('/auth/status');
        browsers.push({cookies: ctx.client.cookies, csrf_token});
    }

    const connections = [];
    for (let i = 0; i < db.client.pool.max; i++) {
        connections.push(await db.client.acquireConnection());
    }
    const requests = [];
    try {
        for (const browser of browsers) {
            ctx.client.cookies = browser.cookies;
            requests.push(ctx.client.post_json_no_redirects('/auth/sign-up', {...body, _csrf: browser.csrf_token}));
        }
        await pending_acquires_wait(browsers.length);
    }
    finally {
        for (const connection of connections) {
            db.client.releaseConnection(connection);
        }
    }
    await Promise.all(requests);

    const out = [];
    for (const browser of browsers) {
        ctx.client.cookies = browser.cookies;
        out.push(await ctx.client.get_json('/auth/status'));
    }
    return out;
}

// Only a UserFriendlyError reaches the person in its own words; any other
// error is "An error occurred [req_…]" and goes to Sentry (error_handler,
// sentry_before_send).
function assert_one_signed_in_one_refused(statuses)
{
    const signed_in = statuses.filter(v => v.authenticated);
    const refused = statuses.filter(v => !v.authenticated);
    assert.strictEqual(signed_in.length, 1);
    assert.strictEqual(signed_in[0].error, null);
    assert.strictEqual(refused.length, 1);
    assert.strictEqual(refused[0].error, 'Identity already exists');
}

async function pending_acquires_wait(count)
{
    const deadline = Date.now() + 2000;
    while (db.client.pool.numPendingAcquires() < count) {
        if (Date.now() >= deadline) {
            throw new Error(`Timed out waiting for ${count} requests to wait for a connection`);
        }
        await new Promise(v => setTimeout(v, 1));
    }
}
