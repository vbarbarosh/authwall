const setup_servers = require('../setup_servers');

describe('GET /auth/magic-link/confirm', function () {

    setup_servers();

    it('signs in existing user via magic link token');
    it('signs up new user via magic link token');
    it('fails with missing token');
    it('fails with invalid token');
    it('fails with expired token');

});
