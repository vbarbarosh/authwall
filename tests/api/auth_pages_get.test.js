const assert = require('assert');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('GET protected auth pages', function () {

    for (const path of ['/auth/profile', '/auth/sessions', '/auth/sign-out']) {
        it(`redirects anonymous user from ${path} to sign-in`, async function () {
            const r = await this.client.get_json_no_redirects(path);

            assert.strictEqual(r.status, 302);
            assert.strictEqual(r.headers.location, urlmod('/auth/sign-in', {return: path}));
        });
    }

});
