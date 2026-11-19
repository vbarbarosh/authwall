#!/usr/bin/env node

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
const log_value_from_string = require('./helpers/log_value_from_string');
const make_logger_daily = require('./services/logger/make_logger_daily');
const make_logger_stdout = require('./services/logger/make_logger_stdout');
const make_mailer_fake = require('./services/mailer/make_mailer_fake');
const make_mailer_mailjet = require('./services/mailer/make_mailer_mailjet');
const make_mailer_resend = require('./services/mailer/make_mailer_resend');
const make_mailer_ses = require('./services/mailer/make_mailer_ses');
const pkg = require('../package.json');
const records_prune = require('./helpers/records_prune');
const render_config_summary = require('./helpers/render/render_config_summary');

const PRUNE_EVERY_MS = 60*60*1000;

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
        // Beside startup, not before it: a long backlog must not hold up
        // listening.
        records_prune_logged();
        setInterval(records_prune_logged, PRUNE_EVERY_MS).unref();
        const app = await create_app();
        await express_run(app, config.port, config.listen, function (inst) {
            const {address, port} = inst.address();
            als.logger.write(`[authwall_ready] Listening to ${address}:${port}`);
        });
    });
}

// What has outlived config.retention goes at start and every hour after
// (M-10). It never throws: a failed pass is logged, and the next one tries
// again.
async function records_prune_logged()
{
    try {
        const removed = await records_prune(new Date());
        if (Object.values(removed).some(v => v > 0)) {
            als.logger.write(`[records_pruned] removed=${JSON.stringify(removed)}`);
        }
    }
    catch (error) {
        als.logger.write(`[records_prune_failed] ${log_value_from_string(error.message)}`);
    }
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
