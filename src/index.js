#!/usr/bin/env node

const als = require('./helpers/als');
const bootstrap_database = require('./helpers/bootstrap_database');
const bootstrap_users = require('./helpers/bootstrap_users');
const cli = require('@vbarbarosh/node-helpers/src/cli');
const config = require('../config');
const create_app = require('./create_app');
const express_run = require('@vbarbarosh/express-helpers/src/express_run');
const knex = require('knex');
const make_logger_daily = require('./services/logger/make_logger_daily');
const make_mailer_fake = require('./services/mailer/make_mailer_fake');
const make_mailer_resend = require('./services/mailer/make_mailer_resend');

cli(main);

async function main()
{
    const db = knex(config.knexvars);
    await using _ = {[Symbol.asyncDispose]: () => db.destroy()};

    await using logger = make_logger_daily();
    await using mailer = make_mailer();

    await als.run({db, logger, mailer}, async function () {
        await bootstrap_database();
        await bootstrap_users();
        const app = await create_app();
        await express_run(app, config.port, config.listen);
    });
}

function make_mailer()
{
    if (config.resend_key && config.resend_from) {
        return make_mailer_resend();
    }

    return make_mailer_fake();
}
