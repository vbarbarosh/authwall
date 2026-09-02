const cli = require('@vbarbarosh/node-helpers/src/cli');
const config = require('../../config');
const {create_echo_server} = require('../setup_servers');
const {once} = require('events');

cli(main);

async function main()
{
    const upstream = await create_echo_server();

    const listening = once(upstream, 'listening');
    upstream.listen(0, '127.0.0.1');
    await listening;

    config.upstream.url = `http://127.0.0.1:${upstream.address().port}`;

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, function () {
            upstream.wss.close();
            upstream.close();
        });
    }

    require('../../src/index');
}
