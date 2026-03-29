#!/usr/bin/env node

const bootstrap_database = require('./helpers/bootstrap_database');
const bootstrap_users = require('./helpers/bootstrap_users');
const cli = require('@vbarbarosh/node-helpers/src/cli');
const config = require('../config');
const create_app = require('./create_app');
const express_run = require('@vbarbarosh/express-helpers/src/express_run');

cli(main);

async function main()
{
    await bootstrap_database();
    await bootstrap_users();

    const app = await create_app();

    await express_run(app, config.port, config.listen);
}
