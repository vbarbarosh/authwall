const setup_servers = require('../setup_servers');

describe('POST /auth/sessions/revoke-all', function () {

    setup_servers();

    it('revokes all other sessions');
    it('keeps current session');
    it('requires authentication');

});
