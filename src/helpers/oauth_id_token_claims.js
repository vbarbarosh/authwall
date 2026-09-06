// Claims of an ID token received straight from a provider's token endpoint.
//
// The signature is not checked. OpenID Connect Core 3.1.3.7 lets the TLS
// server validation of that direct exchange stand in for it, and that is the
// only way Authwall ever obtains an ID token: it never accepts one from a
// browser. What is checked is what TLS cannot vouch for — that the token is
// for this client, from an issuer the caller accepts, and current.
const SKEW_SECONDS = 60;

function oauth_id_token_claims(id_token, {client_id, issuer, now = new Date()})
{
    const parts = typeof id_token === 'string' ? id_token.split('.') : [];
    if (parts.length !== 3) {
        throw new Error('ID token is not a JWT');
    }

    let claims;
    try {
        claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    }
    catch (error) {
        throw new Error('ID token payload is not JSON');
    }
    if (!claims || typeof claims !== 'object') {
        throw new Error('ID token payload is not an object');
    }

    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(client_id)) {
        throw new Error('ID token was issued for another client');
    }
    if (typeof claims.iss !== 'string' || !issuer.test(claims.iss)) {
        throw new Error('ID token was issued by an unexpected issuer');
    }

    const seconds = Math.floor(now.getTime() / 1000);
    if (typeof claims.exp !== 'number' || claims.exp + SKEW_SECONDS <= seconds) {
        throw new Error('ID token has expired');
    }
    if (typeof claims.nbf === 'number' && claims.nbf - SKEW_SECONDS > seconds) {
        throw new Error('ID token is not yet valid');
    }

    return claims;
}

module.exports = oauth_id_token_claims;
