const assert = require('assert');
const {sanitize_sentry_event} = require('./sentry');

describe('sentry', function () {

    it('removes sensitive request data before sending events', function () {
        const event = sanitize_sentry_event({
            request: {
                url: 'https://authwall.test/auth/github/callback?code=abc&state=def&return=/profile',
                query_string: 'code=abc&state=def&return=/profile',
                data: {
                    password: 'secret',
                },
                headers: {
                    cookie: 'connect.sid=secret',
                    authorization: 'Bearer secret',
                    'x-csrf-token': 'secret',
                    'user-agent': 'mocha',
                },
            },
        });

        assert.strictEqual(event.request.url, 'https://authwall.test/auth/github/callback?code=%5BFiltered%5D&state=%5BFiltered%5D&return=%2Fprofile');
        assert.strictEqual(event.request.query_string, undefined);
        assert.strictEqual(event.request.data, undefined);
        assert.deepStrictEqual(event.request.headers, {
            'user-agent': 'mocha',
        });
    });

});
