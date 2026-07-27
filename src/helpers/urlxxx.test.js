const assert = require('assert');
const urlxxx = require('./urlxxx');

describe('urlxxx', function () {

    it('leaves a URL without sensitive parameters untouched', function () {
        assert.strictEqual(urlxxx('/auth/sign-in?return=%2Fprofile'), '/auth/sign-in?return=%2Fprofile');
        assert.strictEqual(urlxxx('/auth/status'), '/auth/status');
        assert.strictEqual(urlxxx('https://example.com/a?b=c'), 'https://example.com/a?b=c');
    });

    it('redacts one-time tokens on a relative request URL', function () {
        assert.strictEqual(
            urlxxx('/auth/magic-link/confirm?token=cf0bbd31074e5df6'),
            '/auth/magic-link/confirm?token=%5BFiltered%5D'
        );
    });

    it('redacts OAuth code and state', function () {
        assert.strictEqual(
            urlxxx('/auth/google/callback?state=login_otk27&code=4%2F0Aci98E'),
            '/auth/google/callback?state=%5BFiltered%5D&code=%5BFiltered%5D'
        );
    });

    it('keeps non-sensitive parameters alongside redacted ones', function () {
        assert.strictEqual(
            urlxxx('/auth/google/callback?code=secret&scope=email&authuser=0'),
            '/auth/google/callback?code=%5BFiltered%5D&scope=email&authuser=0'
        );
    });

    it('matches sensitive names by substring, case-insensitively', function () {
        assert.strictEqual(urlxxx('/x?AccessToken=a'), '/x?AccessToken=%5BFiltered%5D');
        assert.strictEqual(urlxxx('/x?client_secret=a'), '/x?client_secret=%5BFiltered%5D');
        assert.strictEqual(urlxxx('/x?new_password=a'), '/x?new_password=%5BFiltered%5D');
    });

    it('redacts absolute URLs too', function () {
        assert.strictEqual(
            urlxxx('https://authwall.test/auth/email-verify/confirm?token=abc'),
            'https://authwall.test/auth/email-verify/confirm?token=%5BFiltered%5D'
        );
    });

    it('returns non-string and unparsable input unchanged', function () {
        assert.strictEqual(urlxxx(null), null);
        assert.strictEqual(urlxxx(undefined), undefined);
        assert.strictEqual(urlxxx(''), '');
    });

});
