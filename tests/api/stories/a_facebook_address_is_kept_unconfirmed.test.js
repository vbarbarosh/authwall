const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const fs = require('fs/promises');
const knex = require('knex');
const knexfile = require('../../../knexfile');
const nock = require('nock').default;
const os = require('os');
const path = require('path');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const MIGRATION = '20261120230000_user_identities__provider_unconfirmed_emails.js';

// See a_facebook_address_is_kept_unconfirmed.md.
describe('A Facebook address is kept unconfirmed | stories', function () {

    beforeEach(function () {
        for (const name of ['facebook', 'google']) {
            config.flows[name].enabled = true;
            config.flows[name].client_id = `mocha_${name}_client_id`;
            config.flows[name].client_secret = `mocha_${name}_client_secret`;
            config.flows[name].redirect_url = `mocha_${name}_redirect_url`;
        }
    });

    async function sign_in_via(ctx, name, user_info, route = `/auth/${name}`) {
        if (name === 'facebook') {
            nock('https://graph.facebook.com').post('/v22.0/oauth/access_token').reply(200, {access_token: 'fake-token'});
            nock('https://graph.facebook.com').get(/^\/v22\.0\/me/).reply(200, user_info);
        }
        else {
            nock('https://oauth2.googleapis.com').post('/token').reply(200, {access_token: 'fake-token'});
            nock('https://www.googleapis.com').get('/oauth2/v3/userinfo').reply(200, user_info);
        }
        await ctx.client.get_json_no_redirects(route);
        const {oauth_state} = await ctx.client.get_session();
        await ctx.client.get_json_no_redirects(urlmod(`/auth/${name}/callback`, {state: oauth_state, code: 'fake_code'})).catch(e => e.response);
        return ctx.http_get_json('/auth/status');
    }

    function lists_of(type, value) {
        return db('user_identities').where({type, value_normalized: value}).first('provider_emails', 'provider_unconfirmed_emails');
    }

    async function sidecar_status(ctx) {
        try {
            return (await ctx.client.get_json_no_redirects('/auth/sidecar')).status;
        }
        catch (error) {
            return error.response.status;
        }
    }

    it('keeps what Facebook gave apart from what Google confirmed (AW-170)', async function () {
        await sign_in_via(this, 'facebook', {id: 'ann-facebook', name: 'Ann', email: 'ann@corp.test'});
        const ann = {provider_emails: '[]', provider_unconfirmed_emails: '["ann@corp.test"]'};
        assert.deepStrictEqual(await lists_of(const_user_identity.oauth_facebook, 'ann-facebook'), ann);

        this.client.cookies.clear();
        await sign_in_via(this, 'facebook', {id: 'ann-facebook', name: 'Ann', email: 'ann@corp.test'});
        assert.deepStrictEqual(await lists_of(const_user_identity.oauth_facebook, 'ann-facebook'), ann);

        this.client.cookies.clear();
        await sign_in_via(this, 'google', {sub: 'bea-google', name: 'Bea', picture: null, email: 'bea@corp.test', email_verified: true});
        assert.deepStrictEqual(await lists_of(const_user_identity.oauth_google, 'bea-google'), {provider_emails: '["bea@corp.test"]', provider_unconfirmed_emails: '[]'});

        this.client.cookies.clear();
        await this.sign_in({email: 'cy@corp.test', password: 'cys-pass'});
        const {confirmation} = await sign_in_via(this, 'facebook', {id: 'cy-facebook', email: 'cy.fb@corp.test'}, '/auth/facebook?connect=1');
        await this.mark_confirmed(confirmation);
        await sign_in_via(this, 'facebook', {id: 'cy-facebook', email: 'cy.fb@corp.test'}, '/auth/facebook?connect=1');
        assert.deepStrictEqual(await lists_of(const_user_identity.oauth_facebook, 'cy-facebook'), {provider_emails: '[]', provider_unconfirmed_emails: '["cy.fb@corp.test"]'});
    });

    it('lets Ann in as before under a deny list with confirmation off (AW-170)', async function () {
        config.access.denied_domains = ['evil.test'];
        config.confirm_email.required = false;
        await sign_in_via(this, 'facebook', {id: 'ann-facebook', name: 'Ann', email: 'ann@corp.test'});
        assert.strictEqual(await sidecar_status(this), 200);
    });

    it('moves a Facebook row from before into its own list, and back (AW-170)', async function () {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'authwall-aw170-'));
        await using _ = {[Symbol.asyncDispose]: () => fs.rm(dir, {recursive: true, force: true})};
        const old = knex({...knexfile.sqlite, connection: {filename: path.join(dir, 'db.sqlite3')}});
        await using __ = {[Symbol.asyncDispose]: () => old.destroy()};
        await old.migrate.latest();
        await old.migrate.down({name: MIGRATION});
        const now = new Date();
        const [ann_id] = await old('users').insert({uid: 'ann', slug: 'ann', created_at: now, updated_at: now});
        const [bea_id] = await old('users').insert({uid: 'bea', slug: 'bea', created_at: now, updated_at: now});
        const row = {created_at: now, updated_at: now, verified_at: now};
        await old('user_identities').insert([
            {...row, uid: 'i1', user_id: ann_id, type: 'oauth_facebook', value: 'ann-facebook', value_normalized: 'ann-facebook', provider_emails: '["ann@corp.test"]'},
            {...row, uid: 'i2', user_id: bea_id, type: 'oauth_google', value: 'bea-google', value_normalized: 'bea-google', provider_emails: '["bea@corp.test"]'},
            {...row, uid: 'i3', user_id: bea_id, type: 'oauth_facebook', value: 'bea-facebook', value_normalized: 'bea-facebook', provider_emails: null},
        ]);

        await old.migrate.up({name: MIGRATION});
        assert.deepStrictEqual(await old('user_identities').orderBy('uid').select('uid', 'provider_emails', 'provider_unconfirmed_emails'), [
            {uid: 'i1', provider_emails: '[]', provider_unconfirmed_emails: '["ann@corp.test"]'},
            {uid: 'i2', provider_emails: '["bea@corp.test"]', provider_unconfirmed_emails: null},
            {uid: 'i3', provider_emails: null, provider_unconfirmed_emails: null},
        ]);

        await old.migrate.down({name: MIGRATION});
        assert.deepStrictEqual(await old('user_identities').orderBy('uid').select('uid', 'provider_emails'), [
            {uid: 'i1', provider_emails: '["ann@corp.test"]'},
            {uid: 'i2', provider_emails: '["bea@corp.test"]'},
            {uid: 'i3', provider_emails: null},
        ]);
    });

});
