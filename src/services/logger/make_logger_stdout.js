const make_logger = require('./make_logger');

function make_logger_stdout(params = {})
{
    return make_logger({...params, append: s => process.stdout.write(s + '\n')});
}

module.exports = make_logger_stdout;
