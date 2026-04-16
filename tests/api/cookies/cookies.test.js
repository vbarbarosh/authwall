const assert = require('assert');
const config = require('../../../config');
const date_diff_days_float = require('../../../src/helpers/date/date_diff_days_float');

describe('cookies', function () {

    it('config.cookie.secure=false', async function () {
        const r = await this.client.get_json_no_redirects('/auth/status');
        const cookie = r.headers['set-cookie'].find(v => v.startsWith('connect.sid='));

        // connect.sid=s%3Aawsess_dpjmkkpdg3dg1lgeyqyuolyy.pjiK5F8GchQZJDQaf%2FloeUkvWHGTPHw9ZuvQJ0fuKdU; Path=/; Expires=Tue, 12 May 2026 17:50:30 GMT; HttpOnly; SameSite=Lax
        const attributes = cookie.match(/;\s*(.*)$/)[1];
        const expires = cookie.match(/\bExpires=([^;]+)/)[1];

        assert.strictEqual(config.cookie.secure, false);
        assert.strictEqual(attributes, `Path=/; Expires=${expires}; HttpOnly; SameSite=Lax`);
        assert.strictEqual(Math.ceil(date_diff_days_float(expires)), config.cookie.max_age_days);
    });

    it('over http [config.cookie.secure=true]', async function () {
        const r = await this.client.get_json_no_redirects_no_https('/auth/status');
        assert.strictEqual(r.headers['set-cookie'], undefined);
    });

    it('[config.cookie.secure=true]', async function () {
        const r = await this.client.get_json_no_redirects('/auth/status');
        const cookie = r.headers['set-cookie'].find(v => v.startsWith('connect.sid='));

        // connect.sid=s%3Aawsess_w4wgeyicbcmnr1ausgm0gx1l.OtyvdQNJq4Mkq2rdC2BDiwewWbTAVVycNFkn%2B5a%2FCwA; Path=/; Expires=Tue, 12 May 2026 18:17:32 GMT; HttpOnly; Secure; SameSite=Lax
        const attributes = cookie.match(/;\s*(.*)$/)[1];
        const expires = cookie.match(/\bExpires=([^;]+)/)[1];

        assert.strictEqual(config.cookie.secure, true);
        assert.strictEqual(attributes, `Path=/; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`);
        assert.strictEqual(Math.ceil(date_diff_days_float(expires)), config.cookie.max_age_days);
    });

    it('[config.cookie.domain=.authwall.test]', async function () {
        const r = await this.client.get_json_no_redirects('/auth/status');
        const cookie = r.headers['set-cookie'].find(v => v.startsWith('connect.sid='));

        // connect.sid=s%3Aawsess_w4wgeyicbcmnr1ausgm0gx1l.OtyvdQNJq4Mkq2rdC2BDiwewWbTAVVycNFkn%2B5a%2FCwA; Path=/; Expires=Tue, 12 May 2026 18:17:32 GMT; HttpOnly; Secure; SameSite=Lax
        const attributes = cookie.match(/;\s*(.*)$/)[1];
        const expires = cookie.match(/\bExpires=([^;]+)/)[1];

        assert.strictEqual(config.cookie.secure, false);
        assert.strictEqual(attributes, `Domain=.authwall.test; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax`);
        assert.strictEqual(Math.ceil(date_diff_days_float(expires)), config.cookie.max_age_days);
    });

    it('[config.cookie.domain=.authwall.test][config.cookie.secure=true]', async function () {
        const r = await this.client.get_json_no_redirects('/auth/status');
        const cookie = r.headers['set-cookie'].find(v => v.startsWith('connect.sid='));

        // connect.sid=s%3Aawsess_w4wgeyicbcmnr1ausgm0gx1l.OtyvdQNJq4Mkq2rdC2BDiwewWbTAVVycNFkn%2B5a%2FCwA; Path=/; Expires=Tue, 12 May 2026 18:17:32 GMT; HttpOnly; Secure; SameSite=Lax
        const attributes = cookie.match(/;\s*(.*)$/)[1];
        const expires = cookie.match(/\bExpires=([^;]+)/)[1];

        assert.strictEqual(config.cookie.secure, true);
        assert.strictEqual(attributes, `Domain=.authwall.test; Path=/; Expires=${expires}; HttpOnly; Secure; SameSite=Lax`);
        assert.strictEqual(Math.ceil(date_diff_days_float(expires)), config.cookie.max_age_days);
    });

});
