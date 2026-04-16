const assert = require('assert');
const config = require('../../../config');

describe('sign up via username | scenarios', function () {

    it('happy path', async function () {
        config.flows.password.min_password_length = 4;

        await this.http_post_json('/auth/sign-up', {
            _csrf: await this.csrf_token(),
            username: 'mocha',
            password: 'pass123',
            password_confirm: 'pass123',
        });

        assert.partialDeepStrictEqual(await this.http_get_json('/auth/status'), {
            error: null,
            authenticated: true,
        });
    });

});
