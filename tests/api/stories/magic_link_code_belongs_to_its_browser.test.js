const assert = require('assert');
const db = require('../../../db');

// See magic_link_code_belongs_to_its_browser.md.
describe('A magic-link code belongs to the browser that asked for it | stories', function () {

    it('a stranger\'s wrong codes do not spend the code Mocha asked for', async function () {
        const mocha = new Map();
        const stranger = new Map();

        this.client.cookies = mocha;
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        const {code} = this.sent_emails[0].placeholders;

        this.client.cookies = stranger;
        for (let i = 0; i < 5; i++) {
            await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code: '000000'});
        }
        assert.strictEqual((await this.http_get_json('/auth/status')).error, 'Invalid or expired code');
        assert.deepStrictEqual(await db('magic_links').pluck('attempts'), [0]);

        this.client.cookies = mocha;
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code});
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
    });

    it('the right code typed in another browser is refused', async function () {
        this.client.cookies = new Map();
        await this.http_post_json('/auth/magic-link/request', {email: 'mocha@authwall.test'});
        const {code} = this.sent_emails[0].placeholders;

        this.client.cookies = new Map();
        await this.http_post_json('/auth/magic-link/confirm', {email: 'mocha@authwall.test', code});
        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: 'Invalid or expired code',
            authenticated: false,
        });
    });

});
