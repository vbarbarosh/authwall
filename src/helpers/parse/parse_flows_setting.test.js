const assert = require('assert');
const parse_flows_setting = require('./parse_flows_setting');

describe('parse_flows_setting', function () {

    it('auto uses username/password when no other configured flow exists', function () {
        const env = {
            mailer_enabled: false,
            google_enabled: false,
            github_enabled: false,
            microsoft_enabled: false,
            facebook_enabled: false,
            twitter_enabled: false,
            discord_enabled: false,
        };
        assert.deepStrictEqual(parse_flows_setting(undefined, env), {
            password: {enabled: true, allow_username: true, allow_email: false},
            magic_link: {enabled: false, mode: 'link_and_code'},
            google: {enabled: false},
            github: {enabled: false},
            microsoft: {enabled: false},
            facebook: {enabled: false},
            twitter: {enabled: false},
            discord: {enabled: false},
        });
    });

    it('auto uses username/email password and magic link when only mailer is configured', function () {
        const env = {
            mailer_enabled: true,
            google_enabled: false,
            github_enabled: false,
            microsoft_enabled: false,
            facebook_enabled: false,
            twitter_enabled: false,
            discord_enabled: false,
        };
        assert.deepStrictEqual(parse_flows_setting('auto', env), {
            password: {enabled: true, allow_username: true, allow_email: true},
            magic_link: {enabled: true, mode: 'link_and_code'},
            google: {enabled: false},
            github: {enabled: false},
            microsoft: {enabled: false},
            facebook: {enabled: false},
            twitter: {enabled: false},
            discord: {enabled: false},
        });
    });

    it('auto uses only configured OAuth flows when OAuth is configured', function () {
        const env = {
            mailer_enabled: true,
            google_enabled: true,
            github_enabled: false,
            microsoft_enabled: true,
            facebook_enabled: false,
            twitter_enabled: true,
            discord_enabled: true,
        };
        assert.deepStrictEqual(parse_flows_setting('auto', env), {
            password: {enabled: false, allow_username: false, allow_email: false},
            magic_link: {enabled: false, mode: 'link_and_code'},
            google: {enabled: true},
            github: {enabled: false},
            microsoft: {enabled: true},
            facebook: {enabled: false},
            twitter: {enabled: true},
            discord: {enabled: true},
        });
    });

    it('supports explicit comma-separated flow lists', function () {
        const env = {
            mailer_enabled: true,
            google_enabled: true,
            github_enabled: true,
            microsoft_enabled: true,
            facebook_enabled: true,
            twitter_enabled: true,
            discord_enabled: true,
        };
        assert.deepStrictEqual(parse_flows_setting('username,email,magic_link,magic_code,google,github,microsoft,facebook,twitter,discord', env), {
            password: {enabled: true, allow_username: true, allow_email: true},
            magic_link: {enabled: true, mode: 'link_and_code'},
            google: {enabled: true},
            github: {enabled: true},
            microsoft: {enabled: true},
            facebook: {enabled: true},
            twitter: {enabled: true},
            discord: {enabled: true},
        });
    });

    it('supports each magic-link mode explicitly', function () {
        const env = {
            mailer_enabled: true,
            google_enabled: false,
            github_enabled: false,
        };
        assert.deepStrictEqual(parse_flows_setting('magic_link', env).magic_link, {enabled: true, mode: 'link'});
        assert.deepStrictEqual(parse_flows_setting('magic_code', env).magic_link, {enabled: true, mode: 'code'});
        assert.deepStrictEqual(parse_flows_setting('magic_link_and_code', env).magic_link, {enabled: true, mode: 'link_and_code'});
    });

    it('auto preserves the configured magic-link mode', function () {
        const env = {
            mailer_enabled: true,
            google_enabled: false,
            github_enabled: false,
            magic_link_mode: 'code',
        };
        assert.deepStrictEqual(parse_flows_setting('auto', env).magic_link, {enabled: true, mode: 'code'});
    });

    it('rejects magic-link modes not enabled by magic-link settings', function () {
        assert.throws(
            () => parse_flows_setting('magic_link', {mailer_enabled: true, magic_link_mode: 'code'}),
            /configured magic-link mode is code/
        );
        assert.throws(
            () => parse_flows_setting('magic_code', {mailer_enabled: true, magic_link_mode: 'link'}),
            /configured magic-link mode is link/
        );
        assert.throws(
            () => parse_flows_setting('magic_link_and_code', {mailer_enabled: true, magic_link_mode: 'link'}),
            /configured magic-link mode is link/
        );
    });

    it('rejects explicit email or magic-link flows without a mailer', function () {
        for (const value of ['email', 'magic_link', 'magic_code', 'magic_link_and_code']) {
            assert.throws(
                () => parse_flows_setting(value, {mailer_enabled: false, google_enabled: false, github_enabled: false}),
                /requires a configured mailer/
            );
        }
    });

    it('rejects explicit OAuth flows without matching OAuth credentials', function () {
        assert.throws(
            () => parse_flows_setting('google', {mailer_enabled: true, google_enabled: false, github_enabled: true}),
            /requires configured Google OAuth/
        );
        assert.throws(
            () => parse_flows_setting('github', {mailer_enabled: true, google_enabled: true, github_enabled: false}),
            /requires configured GitHub OAuth/
        );
        assert.throws(
            () => parse_flows_setting('microsoft', {mailer_enabled: true, google_enabled: true, github_enabled: true, microsoft_enabled: false}),
            /requires configured Microsoft OAuth/
        );
        assert.throws(
            () => parse_flows_setting('facebook', {mailer_enabled: true, google_enabled: true, github_enabled: true, microsoft_enabled: true, facebook_enabled: false}),
            /requires configured Facebook OAuth/
        );
        assert.throws(
            () => parse_flows_setting('twitter', {mailer_enabled: true, google_enabled: true, github_enabled: true, microsoft_enabled: true, facebook_enabled: true, twitter_enabled: false}),
            /requires configured X OAuth/
        );
        assert.throws(
            () => parse_flows_setting('discord', {mailer_enabled: true, google_enabled: true, github_enabled: true, microsoft_enabled: true, facebook_enabled: true, twitter_enabled: true, discord_enabled: false}),
            /requires configured Discord OAuth/
        );
    });

    it('rejects explicit flows disabled by settings', function () {
        assert.throws(
            () => parse_flows_setting('username', {password_enabled: false}),
            /flows\.password\.enabled=false/
        );
        assert.throws(
            () => parse_flows_setting('username', {username_enabled: false}),
            /allow_username=true/
        );
        assert.throws(
            () => parse_flows_setting('email', {mailer_enabled: true, email_enabled: false}),
            /allow_email=true/
        );
        assert.throws(
            () => parse_flows_setting('magic_link', {mailer_enabled: true, magic_link_enabled: false}),
            /flows\.magic_link\.enabled=false/
        );
    });

    it('rejects unsupported values', function () {
        const env = {
            mailer_enabled: false,
            google_enabled: false,
            github_enabled: false,
            microsoft_enabled: false,
            facebook_enabled: false,
            twitter_enabled: false,
            discord_enabled: false,
        };
        assert.throws(
            () => parse_flows_setting('username,nonsense', env),
            /AUTHWALL_FLOWS contains unsupported value\(s\): nonsense/
        );
        assert.throws(() => parse_flows_setting(', ,'), /AUTHWALL_FLOWS contains no supported values/);
    });

});
