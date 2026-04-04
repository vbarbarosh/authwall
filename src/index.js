#!/usr/bin/env node

const bootstrap_database = require('./helpers/bootstrap_database');
const bootstrap_services = require('./helpers/bootstrap_services');
const bootstrap_users = require('./helpers/bootstrap_users');
const cli = require('@vbarbarosh/node-helpers/src/cli');
const config = require('../config');
const create_app = require('./create_app');
const db = require('../db');
const express_run = require('@vbarbarosh/express-helpers/src/express_run');

cli(() => db.root_als(main));

async function main()
{
    await bootstrap_services();
    await bootstrap_database();
    await bootstrap_users();

    const app = await create_app();

    await express_run(app, config.port, config.listen);
}
