const setup_servers = require('../setup_servers');

describe('GET /auth/google/callback', function () {

    setup_servers();

    it('signs in existing google user');
    it('signs up new google user');
    it('connects google account to existing session');
    it('fails with missing oauth code');
    it('fails with invalid oauth state');

});
