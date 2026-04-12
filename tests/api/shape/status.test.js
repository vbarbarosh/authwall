const assert = require('assert');
const assert_shape = require('../../../src/helpers/assert/assert_shape');

describe('shape • status', function () {

    it('anonymous', async function () {
        const actual = await this.client.get_json('/auth/status');
        const expected = {
            error: null,
            authenticated: false,
            csrf_token: String, // '3X2rJ8H6ZsSyDc0vxCrpYDKe',
        };
        assert_shape(actual, expected);
    });

    it('authenticated', async function () {
        await this.sign_in({username: 'mocha', password: 'pass123'});
        const actual = await this.client.get_json('/auth/status');
        const expected = {
            error: null,
            authenticated: true,
            user_uid: String, // 'awuser_yhyxthy3ykkz048q5s4j5sdb',
            user_slug: String, // 'swbwnpmv7h516n8u',
            csrf_token: String, // '3X2rJ8H6ZsSyDc0vxCrpYDKe',
            display_name: null,
            avatar_url: null,
            providers: [
                {
                    type: String, // 'username',
                    value: String, // 'mocha',
                    value_normalized: String, // 'mocha',
                    created_at: Number, // 1775985911948,
                    updated_at: Number, // 1775985911948,
                    verified_at: Number, // 1775985911948
                },
                {
                    type: String, // 'email',
                    value: String, // 'mocha@authwall.test',
                    value_normalized: String, // 'mocha@authwall.test',
                    created_at: Number, // 1775985911948,
                    updated_at: Number, // 1775985911948,
                    verified_at: Number, // 1775985911948
                }
            ],
            current_session_uid: String, // 'awsess_nb8t0n2uu8glaxrfnhcj1jed',
            sessions: [
                {
                    uid: String, // 'awsess_nb8t0n2uu8glaxrfnhcj1jed',
                    ip: String, // '127.0.0.1',
                    ua: String, // 'axios/1.14.0',
                    created_at: Number, // 1775985912170,
                    expires_at: Number, // 1778577912179,
                    last_seen_at: Number, // 1775985912179
                }
            ]
        };
        assert_shape(actual, expected);
    });

});
