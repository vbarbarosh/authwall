const nock = require('nock');

const TENANT = '72f988bf-86f1-41af-91ab-2d7cd011db47';

// `claims` are merged into the ID token's payload; pass `claims: null` for a
// token response with no id_token at all. Defaults describe a work account
// whose tenant has verified the email's domain (`xms_edov: true`), which is
// what a correctly configured app registration produces.
function mock_microsoft({claims = {}} = {})
{
    const tokens = {
        access_token: 'fake-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'openid email profile',
    };
    if (claims !== null) {
        tokens.id_token = fake_id_token({
            aud: 'mocha_microsoft_client_id',
            iss: `https://login.microsoftonline.com/${TENANT}/v2.0`,
            tid: TENANT,
            sub: 'microsoft-user-123',
            email: 'test@example.com',
            xms_edov: true,
            ver: '2.0',
            iat: Math.floor(Date.now() / 1000),
            nbf: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600,
            ...claims,
        });
    }

    const openid_configuration = {
        userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
    };

    // Shape of a real https://graph.microsoft.com/oidc/userinfo response:
    // standard OIDC claims, underscored.
    const user_info = {
        sub: 'microsoft-user-123',
        '@odata.context': 'https://substrate.office.com/profileB2/v2.0/me/$metadata#userinfo',
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        email: 'test@example.com',
        picture: 'https://graph.microsoft.com/v1.0/me/photo/$value'
    };

    nock.cleanAll();
    nock('https://login.microsoftonline.com').post('/common/oauth2/v2.0/token').reply(200, tokens);
    nock('https://login.microsoftonline.com').get('/common/v2.0/.well-known/openid-configuration').reply(200, openid_configuration);
    nock('https://graph.microsoft.com').get('/oidc/userinfo').reply(200, user_info);
}

// Only the payload matters: the adapter takes the token straight from the
// token endpoint and does not check the signature (see oauth_id_token_claims).
function fake_id_token(payload)
{
    const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
    return `${encode({alg: 'RS256', typ: 'JWT', kid: 'mocha'})}.${encode(payload)}.mocha-signature`;
}

module.exports = mock_microsoft;
