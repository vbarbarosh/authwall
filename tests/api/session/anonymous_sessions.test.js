const assert = require('assert');
const axios = require('axios');
const config = require('../../../config');
const db = require('../../../db');

const DAY = 24*60*60*1000;

// Every request that modifies req.session persists a row. Probes and asset
// fetches arrive without cookies, so each one would be a fresh 30-day row.
describe('anonymous sessions', function () {

    async function count_sessions() {
        return (await db('sessions').count('* as n').first()).n;
    }

    it('health checks and static assets do not create session rows', async function () {
        const before = await count_sessions();
        for (let i = 0; i < 3; ++i) {
            await axios.get('/auth/health', {baseURL: config.public_url});
            await axios.get('/auth/spa.html', {baseURL: config.public_url});
        }
        assert.strictEqual(await count_sessions(), before);
    });

    it('an anonymous status call creates one row that expires within a day', async function () {
        const before = await count_sessions();
        const r = await axios.get('/auth/status', {baseURL: config.public_url});
        assert.ok(r.data.csrf_token);
        assert.strictEqual(await count_sessions(), before + 1);

        const row = await db('sessions').orderBy('id', 'desc').first();
        assert.strictEqual(row.user_id, null);
        assert.ok(new Date(row.expires_at).getTime() <= Date.now() + DAY + 1000);
    });

    it('a signed-in session keeps the full cookie lifetime', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const sess = await this.client.get_session();
        const row = await db('sessions').where({uid: sess.uid}).first();
        assert.ok(new Date(row.expires_at).getTime() > Date.now() + (config.cookie.max_age_days - 1)*DAY);
    });

    it('does not advertise the framework', async function () {
        const r = await axios.get('/auth/health', {baseURL: config.public_url});
        assert.strictEqual(r.headers['x-powered-by'], undefined);
    });

});
