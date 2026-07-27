const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const assert = require('assert');
const {sentry_before_send, sanitize_sentry_event} = require('./sentry');

class InvalidPassword extends UserFriendlyError
{
    constructor() {
        super('Invalid password');
    }
}

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

    // Express reports req.url as a relative path, which `new URL(url)` cannot
    // parse — the old sanitizer caught the throw and returned it unredacted,
    // so live tokens reached Sentry on the most common path.
    it('redacts a relative request url', function () {
        const event = sanitize_sentry_event({
            request: {
                url: '/auth/magic-link/confirm?token=cf0bbd31074e5df6',
            },
        });

        assert.strictEqual(event.request.url, '/auth/magic-link/confirm?token=%5BFiltered%5D');
    });

    it('drops UserFriendlyError events', function () {
        const error = new UserFriendlyError('Missing token');

        assert.strictEqual(sentry_before_send({}, {originalException: error}), null);
    });

    it('drops UserFriendlyError subclasses', function () {
        const error = new InvalidPassword();

        assert.strictEqual(sentry_before_send({}, {originalException: error}), null);
    });

});
