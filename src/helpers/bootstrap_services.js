const make_mailer_resend = require('../services/mailer/make_mailer_resend');
const services = require('../services');
const config = require('../../config');

async function bootstrap_services()
{
    if (config.resend_key && config.resend_from) {
        console.log('✉️ Settings Resend as mailer');
        services.mailer = make_mailer_resend();
    }

    // services.logger = make_logger_xxx();
}

module.exports = bootstrap_services;
