const assert = require('assert');
const config = require('../../../config');
const db = require('../../../db');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

// See magic_link_mode_is_enforced.md.
describe('The magic-link mode decides what signs in | stories', function () {

    it('link mode stores no code and refuses one', async function () {
        config.flows.magic_link.mode = 'link';
        await this.add_user({email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});

        assert.deepStrictEqual(await db('magic_links').pluck('code_hash'), [null]);
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '123456'});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Sign-in by code is disabled',
            authenticated: false,
        });
    });

    it('code mode refuses the link, and the code still signs in', async function () {
        config.flows.magic_link.mode = 'code';
        await this.add_user({email: 'mocha@authwall.test'});
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        const {token, code} = this.sent_emails[0].placeholders;

        await this.http_get_json(urlmod(config.pages.magic_link_confirm, {token}));
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Sign-in by link is disabled',
            authenticated: false,
        });

        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code});
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

});
