const config = require('../../config');
const db = require('../../db');

const routes = [
    {req: 'GET /auth/dev', fn: auth_dev_get},
];

async function auth_dev_get(req, res)
{
    const routes = express_routes_dump(req.app._router.stack);

    res.send({
        pages: routes.filter(v => v.startsWith('GET ')).sort().map(function (s) {
            return `${config.public_url}/${s.slice(5)}`;
        }),
        routes,
        users: await db('users'),
        sessions: await db('sessions'),
        user_identities: await db('user_identities'),
        password_reset_tokens: await db('password_reset_tokens'),
        magic_links: await db('magic_links'),
    });
}

function express_routes_dump(stack, prefix = '', out = [])
{
    for (const layer of stack) {
        console.log(layer);

        if (layer.route) {
            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
            out.push(methods.join(',') + ' ' + prefix + layer.route.path);
        }
        else if (layer.name === 'router' && layer.handle.stack) {
            const sub_prefix = extract_prefix(layer.regexp);
            express_routes_dump(layer.handle.stack, prefix + sub_prefix, out);
        }
        else {
            const path = extract_prefix(layer.regexp);
            const name = layer.name || '<anonymous-xxx>';

            out.push('USE ' + prefix + path + ' → ' + name);
        }
    }
    return out;
}

function extract_prefix(regexp)
{
    if (!regexp) {
        return '';
    }

    return regexp.source
        .replace('^\\/', '/')
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/\$$/, '');
}

module.exports = routes;
