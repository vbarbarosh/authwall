const assert = require('assert');
const config = require('../../../config');

// Anyone can register anyone's address unverified. Security notifications
// (new sign-in, password changed, provider connected) must only go to an
// address whose owner has proven control of it.
describe('Security notifications go to verified addresses only | stories', function () {

    it('does not send sign-in notifications to an unverified address', async function () {
        config.flows.password.min_password_length = 4;
        await this.http_post_json('/auth/sign-up', {username: 'squatter', email: 'victim@authwall.test', password: 'pw12', password_confirm: 'pw12'});
        await this.http_post_json('/auth/sign-out');
        this.client.cookies.clear();
        await new Promise(resolve => setTimeout(resolve, 20));
        this.sent_emails.splice(0);

        await this.http_post_json('/auth/sign-in', {username: 'squatter', password: 'pw12'});
        assert.strictEqual((await this.http_get_json('/auth/status')).authenticated, true);
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.deepStrictEqual(this.sent_emails.map(v => v.name), []);
    });

});
