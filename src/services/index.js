const make_logger_na = require('./logger/make_logger_na');
const make_mailer_na = require('./mailer/make_mailer_na');

const services = {
    logger: make_logger_na(),
    mailer: make_mailer_na(),
};

module.exports = services;
