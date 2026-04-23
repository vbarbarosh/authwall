const assert = require('assert');
const parse_magic_link_setting = require('./parse_magic_link_setting');

describe('parse_magic_link_setting', function () {

    it('uses link_and_code automatically when mailer is configured', function () {
        assert.deepStrictEqual(parse_magic_link_setting('auto', {mailer_enabled: true}), {
            enabled: true,
            mode: 'link_and_code',
        });
    });

    it('disables magic links automatically when mailer is not configured', function () {
        assert.deepStrictEqual(parse_magic_link_setting('auto', {mailer_enabled: false}), {
            enabled: false,
            mode: 'link_and_code',
        });
    });

    it('supports explicit modes when mailer is configured', function () {
        for (const mode of ['link', 'code', 'link_and_code']) {
            assert.deepStrictEqual(parse_magic_link_setting(mode, {mailer_enabled: true}), {
                enabled: true,
                mode,
            });
        }
    });

    it('rejects explicit modes when mailer is not configured', function () {
        for (const mode of ['link', 'code', 'link_and_code']) {
            assert.throws(
                () => parse_magic_link_setting(mode, {mailer_enabled: false}),
                new RegExp(`AUTHWALL_MAGIC_LINK=${mode} requires a configured mailer`)
            );
        }
    });

    it('supports explicit disabled values', function () {
        for (const value of ['off', 'disabled']) {
            const warnings = [];
            assert.deepStrictEqual(parse_magic_link_setting(value, {
                mailer_enabled: true,
                warn: message => warnings.push(message),
            }), {
                enabled: false,
                mode: 'link_and_code',
            });
            assert.deepStrictEqual(warnings, []);
        }
    });

    it('disables magic links and warns for unknown values', function () {
        const warnings = [];
        assert.deepStrictEqual(parse_magic_link_setting('no', {
            mailer_enabled: true,
            warn: message => warnings.push(message),
        }), {
            enabled: false,
            mode: 'link_and_code',
        });
        assert.strictEqual(warnings.length, 1);
        assert.match(warnings[0], /AUTHWALL_MAGIC_LINK/);
        assert.match(warnings[0], /no/);
    });

});
