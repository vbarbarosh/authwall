const SessionStore = require('./helpers/SessionStore');
const als = require('./helpers/als');
const config = require('../config');
const express = require('express');
const express_fingerprint = require('@vbarbarosh/express-helpers/src/express_fingerprint');
const express_routes = require('./helpers/express/express_routes');
const express_session = require('express-session');
const format_hrtime0 = require('./helpers/format/format_hrtime0');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const http_proxy_middleware = require('http-proxy-middleware');
const random_base62 = require('./helpers/random/random_base62');
const random_uid = require('./helpers/random/random_uid');
const random_uid_session = require('./helpers/random/random_uid_session');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const urlparts = require('./helpers/urlparts');

async function create_app()
{
    const app = express();

    app.set('trust proxy', true);

    let pending = 0;
    app.use(function (req, res, next) {

        pending++;
        const hrtime0 = process.hrtime();
        const logger = als.logger.spawn({decorate: s => `[+${format_hrtime0(hrtime0, 4)}] ${s}`});

        req.uid = random_uid('req_');
        logger.write(`[req_uid] ${req.uid}`);
        logger.write(`[req_begin] ${req.method} ${JSON.stringify(req.url)} ${JSON.stringify(express_fingerprint(req))} ${JSON.stringify(req.headers)}`);

        res.on('close', function () {
            pending--;
            logger.write(`[res_close] ${res.statusCode} ${JSON.stringify(res.statusMessage)} pending=${pending}`);
        });
        req.on('error', function (error) {
            logger.write(`[req_error] ${JSON.stringify({...error, message: error.message, stack: error.stack && error.stack.split(/\n\s*/)}, null, 4)}`);
        });

        als.run({logger}, () => next());
    });

    app.use('/auth/uploads', express.static(config.uploads_dir));
    app.use('/auth', express.json());
    app.use('/auth', express.urlencoded({extended: false}));

    app.use(express_session({
        genid: random_uid_session,
        store: new SessionStore(),
        resave: false,
        saveUninitialized: false,
        secret: config.secrets.express_session,
        cookie: {
            httpOnly: true,
            domain: config.cookie.domain,
            path: config.cookie.path,
            sameSite: config.cookie.same_site,
            secure: config.cookie.secure,
            maxAge: config.cookie.max_age_days*86400000,
        },
    }));
    app.use('/auth', function (req, res, next) {
        if (req.session && !req.session.ip) {
            req.session.ip = req.ip;
            req.session.ua = req.headers['user-agent'] ?? 'n/a';
        }
        if (req.session && !req.session.csrf_token) {
            req.session.csrf_token = random_base62();
        }
        next();
    });

    app.get('/auth', function (req, res) {
        if (req.session?.user_id) {
            res.redirect(config.pages.profile);
        }
        else {
            res.redirect(config.pages.sign_in);
        }
    });

    // 🐛️ Devs only
    // express_routes(app, require('./routes/dev'));

    if (config.flows.magic_link.enabled) {
        express_routes(app, require('./routes/magic_link'));
    }
    if (config.flows.github.enabled) {
        express_routes(app, require('./routes/oauth_github'));
    }
    if (config.flows.google.enabled) {
        express_routes(app, require('./routes/oauth_google'));
    }
    if (config.flows.password.enabled) {
        express_routes(app, require('./routes/password'));
    }
    express_routes(app, require('./routes/email_change'));
    express_routes(app, require('./routes/email_verify'));
    express_routes(app, require('./routes/profile'));
    express_routes(app, require('./routes/sessions'));
    express_routes(app, require('./routes/status'));

    // Support for mountable design
    app.use('/auth/', express.static(fs_path_resolve(__dirname, '../design/public_html'), {extensions: ['html']}));

    const protected_spa_pages = new Set([
        config.pages.profile,
        config.pages.sessions,
        config.pages.sign_out,
    ]);

    for (const key in config.pages) {
        const path = config.pages[key];
        app.get(path, async function (req, res) {
            if (protected_spa_pages.has(path) && !req.session?.user_id) {
                als.logger.write(`[auth_go_to_login] GET ${path}`);
                return res.redirect(urlmod(config.pages.sign_in, {return: req.originalUrl}));
            }

            const spa = fs_path_resolve(__dirname, '../design/public_html/spa.html');
            if (await fs_exists(spa)) {
                res.sendFile(spa);
            }
            else {
                res.type('text').send(`Empty page\n\n${key}: GET ${path}`);
            }
        });
    }

    app.use(clean_headers);
    app.use(sign_in_required);
    app.use(http_proxy_middleware.createProxyMiddleware({
        target: config.target_url,
        xfwd: (config.target_mode === 'proxy'),
        changeOrigin: (config.target_mode === 'direct'),
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
            error: function (error, req, res) {
                console.error('PROXY ERROR:', error);
                res.status(502).send(error.message);
            },
        },
    }));

    app.use(error_handler);

    return app;
}

function error_handler(error, req, res, next)
{
    als.logger.write(`[error_handler] ⚠️ ${error.message} url=${req.url} originalUrl=${req.originalUrl}`);

    if (req.session) {
        req.session.error = `An error occurred [${req.uid}]`;
    }

    if (urlparts(req.originalUrl).path !== config.pages.sign_in) {
        res.redirect(config.pages.sign_in);
    }
    else {
        next(error);
    }
}

function sign_in_required(req, res, next)
{
    if (config.public_paths.includes(req.path)) {
        next();
        return;
    }

    if (!req.session.user_id) {
        als.logger.write(`[auth_go_to_login] ${req.method} ${req.path}`);
        return res.redirect(urlmod('/auth/sign-in', {return: req.originalUrl}));
    }

    als.logger.write(`[auth_next] ${req.method} ${req.path}`);
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

module.exports = create_app;
