const cli = require('@vbarbarosh/node-helpers/src/cli');
const {create_echo_server} = require('../setup_servers');

cli(main);

async function main()
{
    const upstream = await create_echo_server();
    const upstream_url = new URL(process.env.AUTHWALL_UPSTREAM_URL);

    upstream.listen(Number(upstream_url.port), upstream_url.hostname, function () {
        require('../../src/index');
    });

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, function () {
            upstream.wss.close();
            upstream.close();
        });
    }
}
