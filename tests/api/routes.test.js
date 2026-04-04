const setup_server = require('../setup_servers');

describe('POST /auth/sign-up', function () {

    setup_server();

    it('signs up with email and password');
    it('signs up with username and password');
    it('signs up with both email and username');
    it('fails with missing fields');
    it('fails when passwords do not match');
    it('fails with invalid email');
    it('fails with invalid username');
    it('fails when email already exists');
    it('fails when username already exists');

});

describe('POST /auth/sign-out', function () {

    setup_server();

    it('signs out authenticated user');
    it('requires authentication');

});

describe('POST /auth/sessions/revoke', function () {

    setup_server();

    it('revokes another session');
    it('fails when revoking current session');
    it('fails with missing uid');
    it('requires authentication');

});

describe('POST /auth/sessions/revoke-all', function () {

    setup_server();

    it('revokes all other sessions');
    it('keeps current session');
    it('requires authentication');

});

describe('POST /auth/password-reset/request', function () {

    setup_server();

    it('sends reset email for known email');
    it('redirects silently for unknown email');
    it('fails with missing email');
    it('fails with invalid email');

});

describe('POST /auth/password-reset/confirm', function () {

    setup_server();

    it('resets password with valid token');
    it('fails with missing fields');
    it('fails when passwords do not match');
    it('fails with invalid token');
    it('fails with already used token');
    it('fails with expired token');

});

describe('POST /auth/change-password', function () {

    setup_server();

    it('changes password for authenticated user');
    it('fails with missing fields');
    it('fails when passwords do not match');
    it('fails with wrong current password');
    it('requires authentication');

});

describe('POST /auth/email-verify/request', function () {

    setup_server();

    it('sends verification email');
    it('rate-limits repeated requests');
    it('fails when no unverified email exists');
    it('requires authentication');

});

describe('GET /auth/email-verify/confirm', function () {

    setup_server();

    it('verifies email with valid token');
    it('fails with missing token');
    it('fails with invalid token');
    it('fails with expired token');
    it('fails with already used token');

});

describe('POST /auth/magic-link/request', function () {

    setup_server();

    it('sends magic link email');
    it('rate-limits repeated requests');
    it('fails with missing email');
    it('fails with invalid email');

});

describe('GET /auth/magic-link/confirm', function () {

    setup_server();

    it('signs in existing user via magic link token');
    it('signs up new user via magic link token');
    it('fails with missing token');
    it('fails with invalid token');
    it('fails with expired token');

});

describe('POST /auth/magic-link/confirm', function () {

    setup_server();

    it('signs in existing user with code');
    it('signs up new user with code');
    it('fails with missing fields');
    it('fails with invalid email');
    it('fails with wrong code');
    it('fails with expired code');

});

describe('GET /auth/google', function () {

    setup_server();

    it('redirects to google oauth with login intent');
    it('redirects to google oauth with connect intent');

});

describe('GET /auth/google/callback', function () {

    setup_server();

    it('signs in existing google user');
    it('signs up new google user');
    it('connects google account to existing session');
    it('fails with missing oauth code');
    it('fails with invalid oauth state');

});

describe('GET /auth/status', function () {

    setup_server();

    it('returns unauthenticated status for anonymous user');
    it('returns authenticated status with user info');
    it('clears error from session after returning it');

});
