const make_logger = require('./make_logger');

function make_logger_fake(written_logs)
{
    return make_logger({append: s => written_logs.push(s)});
}

module.exports = make_logger_fake;
