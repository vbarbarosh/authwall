const assert = require('assert');
const config = require('../../../config');
const mock_microsoft = require('../../mock_microsoft');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('Microsoft email is verified only when its domain owner vouches for it | stories', function () {

    beforeEach(function () {
        config.flows.microsoft.enabled = true;
        config.flows.microsoft.client_id = 'mocha_microsoft_client_id';
        config.flows.microsoft.client_secret = 'mocha_microsoft_client_secret';
        config.flows.microsoft.redirect_url = 'mocha_microsoft_redirect_url';
    });

    async function sign_in_via_microsoft(ctx)
    {
        await ctx.client.get_json_no_redirects('/auth/microsoft');
        const {oauth_state} = await ctx.client.get_session();
        await ctx.http_get_json(urlmod('/auth/microsoft/callback', {code: 'fake_code', state: oauth_state}));
        return ctx.http_get_json('/auth/status');
    }

    it('stores the address verified when the ID token carries xms_edov', async function () {
        mock_microsoft({claims: {email: 'jonny@example.com', xms_edov: true}});
        const status = await sign_in_via_microsoft(this);
        assert.partialDeepStrictEqual(status, {error: null, authenticated: true});
        const email = status.providers.find(v => v.type === 'email');
        assert.strictEqual(email.value, 'jonny@example.com');
        assert.ok(email.verified_at);
    });

    for (const [label, claims] of [['absent', {email: 'jonny@example.com', xms_edov: undefined}], ['false', {email: 'jonny@example.com', xms_edov: false}], ['no ID token at all', null]]) {
        it(`creates the account without an email when the claim is ${label}`, async function () {
            mock_microsoft({claims});
            const status = await sign_in_via_microsoft(this);
            assert.partialDeepStrictEqual(status, {error: null, authenticated: true});
            assert.ok(status.providers.find(v => v.type === 'oauth_microsoft'));
            assert.strictEqual(status.providers.find(v => v.type === 'email'), undefined);
        });
    }

    it('admits the sign-in under an allow-list only when Microsoft vouches for the address', async function () {
        config.access.allowed_domains = ['example.com'];

        mock_microsoft({claims: {email: 'jonny@example.com', xms_edov: false}});
        assert.partialDeepStrictEqual(await sign_in_via_microsoft(this), {
            authenticated: false, error: 'A verified email is required',
        });

        mock_microsoft({claims: {email: 'jonny@example.com', xms_edov: true}});
        assert.partialDeepStrictEqual(await sign_in_via_microsoft(this), {authenticated: true, error: null});
    });

    it('does not let a vouched-for address outside the allow-list in', async function () {
        config.access.allowed_domains = ['example.com'];
        mock_microsoft({claims: {email: 'jonny@outside.test', xms_edov: true}});
        assert.partialDeepStrictEqual(await sign_in_via_microsoft(this), {
            authenticated: false, error: 'Email domain is not allowed',
        });
    });

    for (const [label, claims] of [
        ['for another client', {aud: 'someone-elses-client-id'}],
        ['by an issuer outside login.microsoftonline.com', {iss: 'https://login.example.test/v2.0'}],
        ['for a tenant other than its issuer', {tid: '00000000-0000-0000-0000-000000000000'}],
        ['for a different subject than userinfo reports', {sub: 'someone-else'}],
        ['after it expired', {exp: Math.floor(Date.now() / 1000) - 3600}],
    ]) {
        it(`fails the sign-in on an ID token issued ${label}`, async function () {
            mock_microsoft({claims});
            const status = await sign_in_via_microsoft(this);
            assert.strictEqual(status.authenticated, false);
            assert.match(status.error, /^An error occurred/);
        });
    }
});
