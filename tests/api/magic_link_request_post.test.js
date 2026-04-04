const setup_servers = require('../setup_servers');

describe('POST /auth/magic-link/request', function () {

    setup_servers();

    it('sends magic link email');
    it('rate-limits repeated requests');
    it('fails with missing email');
    it('fails with invalid email');

});
