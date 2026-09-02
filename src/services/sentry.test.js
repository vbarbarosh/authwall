const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const assert = require('assert');
const {sentry_before_send, sanitize_sentry_event, sanitize_sentry_breadcrumb} = require('./sentry');

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

    it('redacts the Referer header instead of dropping it', function () {
        const event = sanitize_sentry_event({
            request: {
                url: '/auth/status',
                headers: {
                    referer: 'https://authwall.test/auth/password-reset/confirm?token=cf0bbd31074e5df6',
                    Referrer: 'https://authwall.test/auth/magic-link/confirm?token=cf0bbd31074e5df6',
                },
            },
        });

        assert.deepStrictEqual(event.request.headers, {
            referer: 'https://authwall.test/auth/password-reset/confirm?token=%5BFiltered%5D',
            Referrer: 'https://authwall.test/auth/magic-link/confirm?token=%5BFiltered%5D',
        });
    });

    // The SDK records every incoming and outgoing HTTP call as a breadcrumb,
    // query string included — a provider token exchange made with GET has
    // the client secret and the authorization code in there.
    it('redacts breadcrumb urls, queries and messages', function () {
        const breadcrumb = sanitize_sentry_breadcrumb({
            category: 'http',
            message: 'GET https://graph.facebook.com/oauth/access_token?client_secret=s3cret&code=abc',
            data: {
                url: 'https://graph.facebook.com/oauth/access_token?client_secret=s3cret&code=abc',
                'http.query': '?client_secret=s3cret&code=abc',
                method: 'GET',
                status_code: 400,
            },
        });

        assert.strictEqual(breadcrumb.data.url, 'https://graph.facebook.com/oauth/access_token?client_secret=%5BFiltered%5D&code=%5BFiltered%5D');
        assert.strictEqual(breadcrumb.data['http.query'], '?client_secret=%5BFiltered%5D&code=%5BFiltered%5D');
        assert.strictEqual(breadcrumb.message, 'GET https://graph.facebook.com/oauth/access_token?client_secret=%5BFiltered%5D&code=%5BFiltered%5D');
        assert.strictEqual(breadcrumb.data.status_code, 400);
    });

    it('redacts breadcrumbs attached to an event', function () {
        const event = sanitize_sentry_event({
            breadcrumbs: [
                {category: 'http', data: {url: '/auth/magic-link/confirm?token=cf0bbd31074e5df6'}},
                {category: 'console', message: 'plain'},
            ],
        });

        assert.strictEqual(event.breadcrumbs[0].data.url, '/auth/magic-link/confirm?token=%5BFiltered%5D');
        assert.strictEqual(event.breadcrumbs[1].message, 'plain');
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
