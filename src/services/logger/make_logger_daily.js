const config = require('../../../config');
const fs = require('fs');
const make_logger = require('./make_logger');
const promisify = require('../../helpers/promisify');

function make_logger_daily(params = {})
{
    let file = null;
    let stream = null;

    const out = make_logger({...params, append});
    const saved_asyncDispose = out[Symbol.asyncDispose];
    out[Symbol.asyncDispose] = async function () {
        if (stream) {
            await promisify(cb => stream.end(cb));
        }
        await saved_asyncDispose();
    };
    return out;

    function append(s) {
        const tmp = `${config.logs_dir}/app-${new Date().toISOString().slice(0, 10)}.log`;
        if (file !== tmp) {
            file = tmp;
            stream?.end();
            stream = fs.createWriteStream(file, {flags: 'a'});
        }
        stream.write(`[${new Date().toJSON()}]${s}\n`);
    }
}

module.exports = make_logger_daily;
