const als = require('../als');

function express_run(app, port = 3000, host = 'localhost')
{
    const server = app.listen(port, host, function () {
        const {address, port} = this.address();
        als.logger.write(`[express_run] Listening to ${address}:${port}`);
    });

    process.on('SIGTERM', sigterm);
    process.on('SIGINT', sigint);

    server.on('close', function () {
        als.logger.write('[express_run] closed');
        process.off('SIGTERM', sigterm);
        process.off('SIGINT', sigint);
    });

    return new Promise(function (resolve) {
        server.once('close', resolve);
    });

    function sigterm() {
        als.logger.write('[express_run] SIGTERM');
        server.close();
        setTimeout(() => process.exit(1), 10000).unref();
    }

    function sigint() {
        als.logger.write('[express_run] SIGINT');
        server.close();
        setTimeout(() => process.exit(1), 10000).unref();
    }
}

module.exports = express_run;
