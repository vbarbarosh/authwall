const routes = [
    {req: 'GET /auth/health', fn: auth_health_get},
];

async function auth_health_get(req, res)
{
    res.type('text').send('OK');
}

module.exports = routes;
