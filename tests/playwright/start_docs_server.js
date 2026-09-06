// Builds the docs and serves build/docs statically for the docs e2e specs.
// Started once by playwright.config.js (webServer), so the three browser
// projects share one build instead of racing to write the same directory.
const cli = require('@vbarbarosh/node-helpers/src/cli');
const {execFileSync} = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const repo_root = path.resolve(__dirname, '..', '..');
const docs_root = path.join(repo_root, 'build', 'docs');
const port = Number(process.env.DOCS_PORT || 3100);
const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

cli(main);

async function main()
{
    execFileSync(path.join(repo_root, 'bin', 'build-docs'), {stdio: 'inherit'});

    const server = http.createServer(function (req, res) {
        const file = path.join(docs_root, decodeURIComponent(req.url.split('?')[0]));
        if (!file.startsWith(docs_root)) {
            res.writeHead(403);
            res.end();
            return;
        }
        fs.readFile(file, function (error, data) {
            if (error) {
                res.writeHead(404);
                res.end();
                return;
            }
            res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream'});
            res.end(data);
        });
    });
    server.listen(port, '127.0.0.1');

    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, function () {
            server.close();
        });
    }
}
