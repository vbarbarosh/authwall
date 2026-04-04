const setup_servers = require('../setup_servers');

describe('POST /auth/email-verify/request', function () {

    setup_servers();

    it('sends verification email');
    it('rate-limits repeated requests');
    it('fails when no unverified email exists');
    it('requires authentication');

});
