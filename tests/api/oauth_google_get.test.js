const setup_servers = require('../setup_servers');

describe('GET /auth/google', function () {

    setup_servers();

    it('redirects to google oauth with login intent');
    it('redirects to google oauth with connect intent');

});
