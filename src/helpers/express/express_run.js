const als = require('../als');

function express_run(app, port = 3000, host = 'localhost', ready = _ready)
{
    return new Promise(function (resolve, reject) {
        // Express 5 also calls its listen callback on error. Only the listening
        // event means address() is available and the app can announce readiness.
        const server = app.listen(port, host);
        server.once('error', fail);
        server.once('listening', on_listening);
        server.once('close', function () {
            als.logger.write('[express_run] closed');
            cleanup();
            resolve();
        });

        process.on('SIGTERM', sigterm);
        process.on('SIGINT', sigint);

        try {
            if (typeof app.setup_server === 'function') {
                app.setup_server(server);
            }
        }
        catch (error) {
            fail(error);
        }

        function on_listening() {
            try {
                ready(server);
            }
            catch (error) {
                fail(error);
            }
        }

        function fail(error) {
            cleanup();
            server.close();
            reject(error);
        }

        function cleanup() {
            server.off('listening', on_listening);
            process.off('SIGTERM', sigterm);
            process.off('SIGINT', sigint);
        }

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
    });
}

function _ready(inst)
{
    const {address, port} = inst.address();
    als.logger.write(`[express_run] Listening to ${address}:${port}`);
}

module.exports = express_run;
