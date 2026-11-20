const cli = require('@vbarbarosh/node-helpers/src/cli');
const config = require('../../config');
const db_from_knexvars = require('../../src/helpers/db_from_knexvars');
const spin_test_database = require('../spin_test_database');
const {create_echo_server} = require('../setup_servers');
const {once} = require('events');

cli(main);

async function main()
{
    // Before the app migrates and seeds it (AW-105).
    const db = db_from_knexvars(config.knexvars);
    try {
        await spin_test_database(db);
    }
    finally {
        await db.destroy();
    }

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
