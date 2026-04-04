const setup_servers = require('../setup_servers');

describe('POST /auth/magic-link/confirm', function () {

    setup_servers();

    it('signs in existing user with code');
    it('signs up new user with code');
    it('fails with missing fields');
    it('fails with invalid email');
    it('fails with wrong code');
    it('fails with expired code');

});
