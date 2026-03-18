#!/usr/bin/env node

const SessionStore = require('./helpers/SessionStore');
const bootstrap_database = require('./helpers/bootstrap_database');
const cli = require('@vbarbarosh/node-helpers/src/cli');
const config = require('./config');
const csrf_token = require('./helpers/csrf/csrf_token');
const express = require('express');
const express_log = require('@vbarbarosh/express-helpers/src/express_log');
const express_routes = require('./helpers/express/express_routes');
const express_run = require('@vbarbarosh/express-helpers/src/express_run');
const express_session = require('express-session');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const http_proxy_middleware = require('http-proxy-middleware');
const random_uid_session = require('./helpers/random/random_uid_session');
const routes = require('./routes');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

cli(main);

async function main()
{
    await bootstrap_database();

    const app = express();

    app.set('trust proxy', true);

    app.use(express_log({file: config.log_file_http}));

    app.use('/auth/static', express.static(fs_path_resolve(__dirname, 'static')));
    app.use('/auth/uploads', express.static(fs_path_resolve(__dirname, '../data/uploads')));

    app.use('/auth', express.json());
    app.use('/auth', express.urlencoded({extended: false}));

    app.use(express_session({
        genid: random_uid_session,
        store: new SessionStore(),
        resave: false,
        saveUninitialized: false,
        secret: config.secrets.express_session,
        cookie: {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: config.public_url.startsWith('https://'),
            maxAge: 30 * 24 * 60 * 60 * 1000,
        },
    }));
    app.use('/auth', function (req, res, next) {
        if (req.session && !req.session.ip) {
            req.session.ip = req.ip;
            req.session.user_agent = req.headers['user-agent'];
        }
        if (req.sessionID) {
            res.cookie('csrf_token', csrf_token(req.sessionID), {
                path: '/auth',
                httpOnly: false,
                sameSite: 'lax',
                secure: config.public_url.startsWith('https://'),
                maxAge: 30 * 24 * 60 * 60 * 1000,
            });
        }
        next();
    });

    express_routes(app, routes);

    app.use(clean_headers);
    app.use(sign_in_required);
    app.use(http_proxy_middleware.createProxyMiddleware({
        target: config.target_url,
        changeOrigin: true,
        pathFilter: function (pathname) {
            return !(pathname === '/auth' || pathname.startsWith('/auth/'));
        },
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
                if (req.session.user_uid) {
                    proxy_req.setHeader('X-Auth-User',  req.session.user_uid);
                }
            },
        },
    }));

    app.use(error_handler);

    function error_handler(error, req, res, next)
    {
        console.log('⚠️ error_handler', req.url, req.originalUrl);
        console.error(error);

        if (req.session) {
            req.session.error = error.message;
        }

        // Prevent infinite redirects
        if (req.url === req.originalUrl) {
            res.redirect('/auth/sign-in');
        }
        // if (req.originalUrl.startsWith('/auth/google')) {
        //     res.redirect('/auth/sign-in');
        // }
        else {
            res.redirect(req.originalUrl);
        }
    }

    await express_run(app, config.port, config.listen);
}

function sign_in_required(req, res, next)
{
    if (req.path.startsWith('/bypass/')) {
        next();
        return;
    }

    if (!req.session.user_id) {
        console.log('auth_go_to_login', req.method, req.path);
        return res.redirect(urlmod('/auth/sign-in', {return: req.originalUrl}));
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
