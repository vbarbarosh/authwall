const assert = require('assert');
const axios = require('axios');
const http_get_json = require('./http_get_json');
const http_post_json = require('./http_post_json');
const http_post_urlencoded = require('./http_post_urlencoded');

describe('src/http timeouts', function () {

    // Capture the request config axios was handed and abort before any I/O.
    let captured;
    let interceptor;

    beforeEach(function () {
        captured = null;
        interceptor = axios.interceptors.request.use(function (request) {
            captured = request;
            throw new axios.CanceledError('captured');
        });
    });

    afterEach(function () {
        axios.interceptors.request.eject(interceptor);
    });

    for (const [name, call] of [
        ['http_get_json', options => http_get_json('https://slow.test/x', options)],
        ['http_post_json', options => http_post_json('https://slow.test/x', {}, options)],
        ['http_post_urlencoded', options => http_post_urlencoded('https://slow.test/x', {}, options)],
    ]) {
        it(`${name} sends a 15 s timeout by default`, async function () {
            await assert.rejects(call());
            assert.strictEqual(captured.timeout, 15000);
        });

        it(`${name} lets the caller override it`, async function () {
            await assert.rejects(call({timeout: 500}));
            assert.strictEqual(captured.timeout, 500);
        });
    }

});
