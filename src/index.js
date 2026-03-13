#!/usr/bin/env node

const SessionStore = require('./helpers/SessionStore');
const bootstrap_database = require('./helpers/bootstrap_database');
const cli = require('@vbarbarosh/node-helpers/src/cli');
const config = require('./config');
const express = require('express');
const express_log = require('@vbarbarosh/express-helpers/src/express_log');
const express_params = require('@vbarbarosh/express-helpers/src/express_params');
const express_routes = require('@vbarbarosh/express-helpers/src/express_routes');
const express_run = require('@vbarbarosh/express-helpers/src/express_run');
const express_session = require('express-session');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const http_proxy_middleware = require('http-proxy-middleware');
const promisify = require('./helpers/promisify');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

cli(main);

async function main()
{
    await bootstrap_database();

    const app = express();

    app.use(express_log({file: config.log_file_http}));
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));

    app.use(express_session({
        store: new SessionStore(),
        resave: false,
        saveUninitialized: false,
        secret: config.session_secret,
    }));

    express_routes(app, [
        // {req: 'GET /', fn: echo},
        {req: 'GET /me', fn: route_me},
        {req: 'GET /auth/login', fn: route_auth_login_get},
        {req: 'POST /auth/login', fn: route_auth_login_post},
        {req: 'POST /auth/logout', fn: route_auth_logout_post},
        // {req: 'ALL *', fn: page404},
    ]);

    app.use(clean_headers);
    app.use(login_required);
    app.use(http_proxy_middleware.createProxyMiddleware({
        target: config.target,
        changeOrigin: true,
        on: {
            proxyReq: function (proxy_req, req) {
                // // ⚠️ Beware that headers are proxied too
                // // ⚠️ Take special care not to special headers
                // // curl http://localhost:3000/foo/bar -H X-Auth-User:foo -H 'Cookie: connect.sid=s%3A7lIgELaKCxNmyCw5iDcFsAUq6-nVQ6o6.LCvDq0niOJtMT75hMUL2sqvssyXC4Ilm99ftI9Fa4BE'
                // // curl http://localhost:3000/bypass/foo/bar -H X-Auth-User:foo
                // const headers = proxy_req.getHeaderNames();
                // for (let i = 0, ii = headers.length; i < ii; ++i) {
                //     const header = headers[i];
                //     if (header.startsWith('x-auth-')) {
                //         proxy_req.removeHeader(header);
                //     }
                // }
                if (req.session.username) {
                    proxy_req.setHeader('X-Auth-User',  req.session.username);
                }
            },
        },
    }));

    await express_run(app, config.port, config.listen);
}

function login_required(req, res, next)
{
    if (req.path.startsWith('/bypass/')) {
        next();
        return;
    }

    if (!req.session.username) {
        console.log('auth_go_to_login', req.method, req.path);
        return res.redirect(urlmod('/auth/login', {return: req.originalUrl}));
    }
    console.log('auth_next', req.method, req.path);
    next();
}

function clean_headers(req, res, next)
{
    // https://github.com/chimurai/http-proxy-middleware/issues/472?utm_source=chatgpt.com
    // ⚠️ Beware that headers are proxied too
    // ⚠️ Take special care not to special headers
    // curl http://localhost:3000/foo/bar -H X-Auth-User:foo -H 'Cookie: connect.sid=s%3A7lIgELaKCxNmyCw5iDcFsAUq6-nVQ6o6.LCvDq0niOJtMT75hMUL2sqvssyXC4Ilm99ftI9Fa4BE'
    // curl http://localhost:3000/bypass/foo/bar -H X-Auth-User:foo
    const keys = Object.keys(req.headers);
    for (let i = 0, ii = keys.length; i < ii; ++i) {
        const s = keys[i];
        if (s.startsWith('x-auth-')) {
            delete req.headers[s];
        }
    }
    next();
}

// GET /auth/login
async function route_auth_login_get(req, res)
{
    console.log(req.session);
    res.sendFile(fs_path_resolve(__dirname, 'static/login.html'));
}

// POST /auth/login
async function route_auth_login_post(req, res)
{
    await promisify(v => req.session.regenerate(v));

    req.session.username = req.body.username;

    await promisify(v => req.session.save(v));

    res.redirect(req.query.return ?? '/');
}

// POST /auth/logout
async function route_auth_logout_post(req, res)
{
    await promisify(v => req.session.destroy(v));
    res.redirect('/auth/login');
}

async function echo(req, res)
{
    res.status(200).send(express_params(req));
}

async function route_me(req, res)
{
    res.send({username: req.session.username});
}

async function page404(req, res)
{
    res.status(404).send(`Page not found: ${req.path}`);
}
