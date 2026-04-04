const setup_servers = require('../setup_servers');

describe('GET /auth/email-verify/confirm', function () {

    setup_servers();

    it('verifies email with valid token');
    it('fails with missing token');
    it('fails with invalid token');
    it('fails with expired token');
    it('fails with already used token');

});
