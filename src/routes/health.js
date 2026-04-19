const pkg = require('../../package.json');

const routes = [
    {req: 'GET /auth/health', fn: auth_health_get},
];

async function auth_health_get(req, res)
{
    res.setHeader('x-authwall-version', pkg.version);
    res.type('text').send('OK');
}

module.exports = routes;
