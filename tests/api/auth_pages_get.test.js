const assert = require('assert');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

describe('GET protected auth pages', function () {

    for (const path of ['/auth/profile', '/auth/sessions', '/auth/sign-out']) {
        it(`redirects anonymous user from ${path} to sign-in`, async function () {
            assert.partialDeepStrictEqual(await this.client.get_json_no_redirects(path), {
                status: 302,
                headers: {
                    location: urlmod('/auth/sign-in', {return: path}),
                },
            });
        });
    }

    for (const path of ['/auth/sign-in', '/auth/sign-up']) {
        it(`redirects signed-in user from ${path} to profile`, async function () {
            await this.sign_in({username: 'mocha', password: 'pass123'});

            assert.partialDeepStrictEqual(await this.client.get_json_no_redirects(path), {
                status: 302,
                headers: {
                    location: '/auth/profile',
                },
            });
        });
    }

});
