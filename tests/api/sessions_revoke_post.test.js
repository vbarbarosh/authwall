const setup_servers = require('../setup_servers');

describe('POST /auth/sessions/revoke', function () {

    setup_servers();

    it('revokes another session');
    it('fails when revoking current session');
    it('fails with missing uid');
    it('requires authentication');

});
