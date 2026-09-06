const assert = require('assert');
const oauth_id_token_claims = require('./oauth_id_token_claims');

const ISSUER = /^https:\/\/login\.microsoftonline\.com\/([0-9a-f-]{36})\/v2\.0$/;
const TENANT = '11111111-2222-3333-4444-555555555555';
const NOW = new Date('2026-09-06T12:00:00Z');
const seconds = Math.floor(NOW.getTime() / 1000);

function jwt(claims)
{
    const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
    return `${encode({alg: 'RS256', typ: 'JWT'})}.${encode(claims)}.signature`;
}

function valid(overrides = {})
{
    return {
        aud: 'client-id',
        iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
        tid: TENANT,
        sub: 'subject',
        exp: seconds + 3600,
        nbf: seconds - 10,
        iat: seconds - 10,
        ...overrides,
    };
}

describe('oauth_id_token_claims', function () {

    const options = {client_id: 'client-id', issuer: ISSUER, now: NOW};

    it('returns the claims of a current token for this client from an accepted issuer', function () {
        const claims = oauth_id_token_claims(jwt(valid({email: 'a@b.test', xms_edov: true})), options);
        assert.strictEqual(claims.email, 'a@b.test');
        assert.strictEqual(claims.xms_edov, true);
    });

    it('accepts an audience list that includes this client', function () {
        const claims = oauth_id_token_claims(jwt(valid({aud: ['other', 'client-id']})), options);
        assert.strictEqual(claims.sub, 'subject');
    });

    it('rejects a token issued for another client', function () {
        assert.throws(() => oauth_id_token_claims(jwt(valid({aud: 'other-client'})), options), /issued for another client/);
    });

    it('rejects an issuer outside the accepted pattern', function () {
        assert.throws(() => oauth_id_token_claims(jwt(valid({iss: 'https://evil.example/v2.0'})), options), /unexpected issuer/);
        assert.throws(() => oauth_id_token_claims(jwt(valid({iss: `https://login.microsoftonline.com/${TENANT}/`})), options), /unexpected issuer/);
    });

    it('rejects an expired token beyond the clock skew', function () {
        assert.throws(() => oauth_id_token_claims(jwt(valid({exp: seconds - 61})), options), /has expired/);
        assert.doesNotThrow(() => oauth_id_token_claims(jwt(valid({exp: seconds - 30})), options));
    });

    it('rejects a token that is not yet valid beyond the clock skew', function () {
        assert.throws(() => oauth_id_token_claims(jwt(valid({nbf: seconds + 61})), options), /not yet valid/);
    });

    it('rejects anything that is not a three-part JWT with a JSON payload', function () {
        assert.throws(() => oauth_id_token_claims(undefined, options), /not a JWT/);
        assert.throws(() => oauth_id_token_claims('a.b', options), /not a JWT/);
        assert.throws(() => oauth_id_token_claims('a.!!!.c', options), /not JSON/);
    });
});
