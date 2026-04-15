const Promise = require('bluebird');
const als = require('../als');

function express_run(app, port = 3000, host = 'localhost')
{
    const server = app.listen(port, host, function () {
        const {address, port} = this.address();
        als.logger.write(`[express_run] Listening to ${address}:${port}`);
    });

    // https://joseoncode.com/2014/07/21/graceful-shutdown-in-node-dot-js/
    // process.on('SIGTERM', sigterm);
    // process.on('SIGINT', sigint);
    //
    // server.on('close', function () {
    //     console.log(`[express_run] end`);
    //     process.off('SIGTERM', sigterm);
    //     process.off('SIGINT', sigint);
    // });

    // return pending(cb => server.once('close', cb));
    return new Promise(function (resolve) {
        server.once('close', resolve);
    });

    function sigterm() {
        als.logger.write('[express_run] SIGTERM');
        server.close();
    }

    function sigint() {
        als.logger.write('[express_run] SIGINT');
        server.close();
    }
}

module.exports = express_run;
