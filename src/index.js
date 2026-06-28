#!/usr/bin/env node

// util._extend used in http-proxy (transitive dep of http-proxy-middleware) — cannot be fixed upstream
//
// node_modules/http-proxy$ g _extend
// lib/http-proxy/index.js
// 2:    extend    = require('util')._extend,
//
// lib/http-proxy/common.js
// 3:    extend   = require('util')._extend,
process.removeAllListeners('warning');
process.on('warning', function (event) {
    if (event.code === 'DEP0060') {
        return;
    }
    process.stderr.write(event.stack + '\n');
});

// ⚠️ Sentry must initialize before `require('express')`
const config = require('../config');
require('./services/sentry').init_sentry(config);

const als = require('./helpers/als');
const bootstrap_database = require('./helpers/bootstrap_database');
const bootstrap_users = require('./helpers/bootstrap_users');
const cli = require('@vbarbarosh/node-helpers/src/cli');
const create_app = require('./create_app');
const express_run = require('./helpers/express/express_run');
const knex = require('knex');
const make_logger_daily = require('./services/logger/make_logger_daily');
const make_logger_stdout = require('./services/logger/make_logger_stdout');
const make_mailer_fake = require('./services/mailer/make_mailer_fake');
const make_mailer_mailjet = require('./services/mailer/make_mailer_mailjet');
const make_mailer_resend = require('./services/mailer/make_mailer_resend');
const make_mailer_ses = require('./services/mailer/make_mailer_ses');
const pkg = require('../package.json');
const render_config_summary = require('./helpers/render/render_config_summary');

cli(main);

async function main()
{
    const db = knex(config.knexvars);
    await using _ = {[Symbol.asyncDispose]: () => db.destroy()};

    await using logger = make_logger();

    logger.write(`[authwall_started] v${pkg.version}`);
    for (const line of render_config_summary(config)) {
        logger.write(line);
    }

    await using mailer = make_mailer(logger);

    await als.run({db, logger, mailer}, async function () {
        await bootstrap_database();
        await bootstrap_users();
        const app = await create_app();
        await express_run(app, config.port, config.listen, function (inst) {
            const {address, port} = inst.address();
            als.logger.write(`[authwall_ready] Listening to ${address}:${port}`);
        });
    });
}

function make_logger()
{
    if (config.logger === 'stdout') {
        return make_logger_stdout();
    }
    return make_logger_daily();
}

function make_mailer(logger)
{
    if (!config.mailer.enabled) {
        logger.write('🚫 Mailer is disabled: email verification, email change, password reset, and magic-link sign-in are unavailable');
        return make_mailer_fake();
    }

    switch (config.mailer.provider) {
    case 'resend':
        logger.write('📭 Settings Resend as mailer');
        return make_mailer_resend();
    case 'mailjet':
        logger.write('📭 Settings Mailjet as mailer');
        return make_mailer_mailjet();
    case 'ses':
        logger.write('📭 Settings SES as mailer');
        return make_mailer_ses();
    default:
        logger.write('⚠️ Using fake mailer');
        return make_mailer_fake();
    }
}
