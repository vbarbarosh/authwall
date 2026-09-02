const assert = require('assert');
const bootstrap_users = require('../../src/helpers/bootstrap_users');
const config = require('../../config');

describe('bootstrap_users', function () {

    it('does not write the password of a rejected seed to the log', async function () {
        config.seed_users = [{username: '<bad>', password: 'hunter2-plain', password_hash: '$2b$12$hash', email: []}];

        await bootstrap_users();

        const logs = this.written_logs.join('\n');
        assert.ok(logs.includes('Skipping invalid user seed'));
        assert.strictEqual(logs.includes('hunter2-plain'), false);
        assert.strictEqual(logs.includes('$2b$12$hash'), false);
        assert.ok(logs.includes('[Filtered]'));
    });

});
