const config = require('../../../config');
const fs = require('fs');
const make_logger = require('./make_logger');
const promisify = require('../../helpers/promisify');

function make_logger_daily(params = {})
{
    let file = null;
    let stream = null;

    const out = make_logger({...params, append});
    const saved_dispose = out[Symbol.dispose];
    const saved_asyncDispose = out[Symbol.asyncDispose];
    out[Symbol.asyncDispose] = async function () {
        if (stream) {
            await promisify(cb => stream.end(cb));
        }
        if (saved_asyncDispose) {
            await saved_asyncDispose.call(this);
        }
        else {
            saved_dispose?.call(this);
        }
    };
    return out;

    function append(s) {
        const tmp = `${config.logs_dir}/app-${new Date().toISOString().slice(0, 10)}.log`;
        if (file !== tmp) {
            file = tmp;
            stream?.end();
            stream = open_stream(file);
        }
        const line = `[${new Date().toJSON()}]${s}\n`;
        if (stream) {
            stream.write(line);
        }
        else {
            process.stdout.write(line);
        }
    }

    // An unhandled 'error' event on the stream is thrown as an uncaught
    // exception, so a full disk or a lost mount would take down the proxy —
    // and every app behind it — over a failed log write. Degrade to stdout
    // instead; the next day-file rotation retries with a fresh stream.
    function open_stream(path) {
        // Owner-only: these files carry client IPs, e-mail addresses and,
        // should redaction ever miss one, one-time credentials.
        const out = fs.createWriteStream(path, {flags: 'a', mode: 0o600});
        out.on('error', function (error) {
            // Guard against a stale stream's late error clearing a newer one.
            if (stream === out) {
                stream = null;
            }
            process.stderr.write(`[logger_daily_error] ⚠️ ${path}: ${error.message}\n`);
        });
        return out;
    }
}

module.exports = make_logger_daily;
