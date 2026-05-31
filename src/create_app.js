const EmailNotAuthorized = require('./helpers/errors/EmailNotAuthorized');
const SessionStore = require('./helpers/SessionStore');
const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const als = require('./helpers/als');
const authenticate_personal_access_token = require('./helpers/authenticate_personal_access_token');
const config = require('../config');
const const_auth_event = require('./helpers/const/const_auth_event');
const const_auth_event_status = require('./helpers/const/const_auth_event_status');
const db = require('../db');
const email_verification_required = require('./helpers/email_verification_required');
const express = require('express');
const express_fingerprint = require('@vbarbarosh/express-helpers/src/express_fingerprint');
const express_routes = require('./helpers/express/express_routes');
const express_session = require('express-session');
const format_hrtime0 = require('./helpers/format/format_hrtime0');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const http_proxy_middleware = require('http-proxy-middleware');
const insert_auth_event = require('./helpers/insert_auth_event');
const make_failure_counter = require('./helpers/middleware/make_failure_counter');
const make_oauth_flow = require('./helpers/make/make_oauth_flow');
const oauth_provider_discord = require('./oauth_providers/oauth_provider_discord');
const oauth_provider_facebook = require('./oauth_providers/oauth_provider_facebook');
const oauth_provider_github = require('./oauth_providers/oauth_provider_github');
const oauth_provider_google = require('./oauth_providers/oauth_provider_google');
const oauth_provider_microsoft = require('./oauth_providers/oauth_provider_microsoft');
const oauth_provider_twitter = require('./oauth_providers/oauth_provider_twitter');
const random_base62 = require('./helpers/random/random_base62');
const random_uid = require('./helpers/random/random_uid');
const random_uid_session = require('./helpers/random/random_uid_session');
const save_session = require('./helpers/save_session');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const urlparts = require('@vbarbarosh/node-helpers/src/urlparts');
const {sentry_request_context, setup_sentry_error_handler} = require('./services/sentry');

const LOGGED_HEADERS = new Set([
    'user-agent',
    'content-type',
    'content-length',
    'referer',
    'origin',
    'host',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-real-ip',
]);

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

        const headers = Object.fromEntries(Object.keys(req.headers).filter(v => LOGGED_HEADERS.has(v)).map(k => [k, req.headers[k]]));
        logger.write(`[req_begin] ${req.method} ${JSON.stringify(req.url)} ${JSON.stringify(express_fingerprint(req))} ${JSON.stringify(headers)}`);

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

    // always send secure cookies when told so
    if (config.cookie.secure) {
        app.use(function (req, res, next) {
            req.headers['x-forwarded-proto'] = 'https';
            next();
        });
    }

    app.use(express_session({
        genid: random_uid_session,
        store: new SessionStore(),
        resave: false,
        saveUninitialized: false,
        secret: config.secrets.express_session,
        // true: The "X-Forwarded-Proto" header will be used | https://github.com/expressjs/session#proxy
        proxy: config.cookie.secure || undefined,
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
    app.use(sentry_request_context);

    const bearer_miss_limiter = config.personal_access_tokens.enabled
        ? make_failure_counter(20, 15*60*1000)
        : null;
    if (bearer_miss_limiter) {
        app.use(make_personal_access_token_auth(bearer_miss_limiter));
    }

    app.get('/auth', function (req, res) {
        if (req.session?.user_id) {
            res.redirect(config.pages.profile);
        }
        else {
            res.redirect(config.pages.sign_in);
        }
    });

    express_routes(app, require('./routes/status'));
    express_routes(app, require('./routes/health'));

    // 🐛️ Devs only
    // express_routes(app, require('./routes/dev'));

    if (config.flows.magic_link.enabled) {
        express_routes(app, require('./routes/magic_link'));
    }
    if (config.flows.github.enabled) {
        express_routes(app, make_oauth_flow(oauth_provider_github));
    }
    if (config.flows.google.enabled) {
        express_routes(app, make_oauth_flow(oauth_provider_google));
    }
    if (config.flows.microsoft.enabled) {
        express_routes(app, make_oauth_flow(oauth_provider_microsoft));
    }
    if (config.flows.facebook.enabled) {
        express_routes(app, make_oauth_flow(oauth_provider_facebook));
    }
    if (config.flows.twitter.enabled) {
        express_routes(app, make_oauth_flow(oauth_provider_twitter));
    }
    if (config.flows.discord.enabled) {
        express_routes(app, make_oauth_flow(oauth_provider_discord));
    }
    if (config.flows.password.enabled) {
        express_routes(app, require('./routes/password'));
    }
    express_routes(app, require('./routes/account'));
    express_routes(app, require('./routes/profile'));
    express_routes(app, require('./routes/sessions'));
    express_routes(app, require('./routes/email_remove'));
    if (config.personal_access_tokens.enabled) {
        express_routes(app, require('./routes/personal_access_tokens'));
    }
    if (config.mailer.enabled) {
        express_routes(app, require('./routes/email_add'));
        express_routes(app, require('./routes/email_change'));
        express_routes(app, require('./routes/email_verify'));
    }

    // Support for mountable design
    app.use('/auth/', express.static(fs_path_resolve(__dirname, '../design/public_html'), {extensions: ['html']}));

    const protected_spa_pages = new Set([
        config.pages.profile,
        config.pages.sessions,
        config.pages.personal_access_tokens,
        config.pages.sign_out,
    ]);
    const signed_in_redirect_spa_pages = new Set([
        config.pages.sign_in,
        config.pages.sign_up,
    ]);

    for (const key in config.pages) {
        const path = config.pages[key];
        app.get(path, async function (req, res) {
            if (protected_spa_pages.has(path) && !req.session?.user_id) {
                als.logger.write(`[auth_go_to_login] GET ${path}`);
                return res.redirect(urlmod(config.pages.sign_in, {return: req.originalUrl}));
            }
            if (signed_in_redirect_spa_pages.has(path) && req.session?.user_id) {
                als.logger.write(`[auth_go_to_profile] GET ${path}`);
                return res.redirect(config.pages.profile);
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
    const proxy = http_proxy_middleware.createProxyMiddleware({
        target: config.upstream.url,
        ws: config.websockets.enabled,
        xfwd: (config.upstream.mode === 'proxy'),
        changeOrigin: (config.upstream.mode === 'direct'),
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
                const user_uid = authenticated_user_uid(req);
                if (user_uid && !is_public_path(req.path)) {
                    proxy_req.setHeader('X-Auth-User', user_uid);
                }
                for (let i = 0, ii = config.upstream.set_headers.length; i < ii; ++i) {
                    const header = config.upstream.set_headers[i];
                    proxy_req.setHeader(header.name, header.value);
                }
                for (let i = 0, ii = config.upstream.unset_headers.length; i < ii; ++i) {
                    proxy_req.removeHeader(config.upstream.unset_headers[i]);
                }
            },
            proxyReqWs: function (proxy_req, req) {
                if (req.ws_user_uid) {
                    proxy_req.setHeader('X-Auth-User', req.ws_user_uid);
                }
                for (let i = 0, ii = config.upstream.set_headers.length; i < ii; ++i) {
                    const header = config.upstream.set_headers[i];
                    proxy_req.setHeader(header.name, header.value);
                }
                for (let i = 0, ii = config.upstream.unset_headers.length; i < ii; ++i) {
                    proxy_req.removeHeader(config.upstream.unset_headers[i]);
                }
            },
            error: function (error, req, res) {
                als.logger.write(`[proxy_error] ⚠️ ${error.message} url=${req.url} originalUrl=${req.originalUrl}`);
                // res is a `Socket` for WS upgrade errors and a `ServerResponse` for HTTP errors.
                if (typeof res.status === 'function') {
                    res.status(502).send('Upstream service unavailable');
                }
                else {
                    res.destroy();
                }
            },
        },
    });
    app.use(proxy);

    if (config.websockets.enabled) {
        const handle_ws_upgrade = make_ws_upgrade_handler(proxy, bearer_miss_limiter);
        app.setup_server = function (server) {
            server.on('upgrade', handle_ws_upgrade);
        };
    }

    setup_sentry_error_handler(app);
    app.use(error_handler);

    return app;
}

async function error_handler(error, req, res, next)
{
    try {
        const details = {
            status: error.response?.status,
            body: error.response?.data,
            headers: error.response?.headers,
            stack: error.stack,
            url: req.url,
            originalUrl: req.originalUrl,
        };
        als.logger.write(`[error_handler] ⚠️ ${JSON.stringify(details)}`);
    }
    catch (error2) {
        als.logger.write(`[error_handler] ⚠️ ${JSON.stringify(error.stack).slice(1, -1)} url=${req.url} originalUrl=${req.originalUrl}`);
    }

    if (error instanceof EmailNotAuthorized) {
        await insert_email_not_authorized_event(req, error);
    }

    if (req.session) {
        if (error instanceof UserFriendlyError) {
            req.session.error = error.message;
        }
        else {
            req.session.error = `An error occurred [${req.uid}]`;
        }
        // MySQL 8.0 accessed over http://172.17.0.1:30600 required this
        await save_session(req);
    }

    const path = urlparts(req.url).path;

    if (req.url === req.originalUrl && path !== config.pages.sign_in) {
        // Keep authenticated users inside the signed-in flow after route errors,
        // e.g. a failed OAuth connect attempt that started from /auth/profile.
        res.redirect(req.session?.user_id ? config.pages.profile : config.pages.sign_in);
    }
    else if (req.method === 'GET' && req.url === req.originalUrl) {
        // GET /auth/sign-in threw an error — redirecting would loop
        next(error);
    }
    else {
        res.redirect(req.url);
    }
}

async function insert_email_not_authorized_event(req, error)
{
    await insert_auth_event({
        req,
        event_type: const_auth_event.change_me_email_not_authorized,
        event_status: const_auth_event_status.failure,
        custom: {
            reason: 'email_not_authorized',
            error: error.message,
        },
    });
}

function sign_in_required(req, res, next)
{
    const user_id = authenticated_user_id(req);

    if (is_public_path(req.path) || (!user_id && is_optional_auth_path(req.path))) {
        next();
        return;
    }

    if (!user_id) {
        als.logger.write(`[auth_go_to_login] ${req.method} ${req.path}`);
        return res.redirect(urlmod('/auth/sign-in', {return: req.originalUrl}));
    }

    // Bearer-authenticated requests have email verification enforced earlier,
    // in personal_access_token_auth (with a 403). Redirecting an API client to
    // a browser verify-email page wouldn't make sense.
    if (!req.auth?.personal_access_token_uid && email_verification_required(req)) {
        als.logger.write(`[auth_go_to_email_verify] ${req.method} ${req.path}`);
        req.session.error = 'Email verification required';
        save_session(req).then(() => res.redirect(urlmod(config.pages.email_verify_request, {return: req.originalUrl})), next);
        return;
    }

    als.logger.write(`[auth_next] ${req.method} ${req.path}`);
    next();
}

function make_personal_access_token_auth(bearer_miss_limiter)
{
    return async function personal_access_token_auth(req, res, next) {
        try {
            const authorization = req.headers.authorization;
            if (!authorization) {
                next();
                return;
            }

            const match = /^Bearer\s+(.+)$/i.exec(authorization);
            if (!match) {
                next();
                return;
            }

            if (bearer_miss_limiter.is_blocked(req.ip)) {
                res.set('Retry-After', String(bearer_miss_limiter.retry_after_seconds(req.ip)));
                res.status(429).type('text').send('Too many failed authentication attempts, please try again later');
                return;
            }

            const result = await authenticate_personal_access_token({
                token: match[1].trim(),
                ip: req.ip,
                ua: req.headers['user-agent'],
            });

            if (result.kind === 'invalid') {
                bearer_miss_limiter.record_failure(req.ip);
                res.status(401).type('text').send('Invalid personal access token');
                return;
            }

            if (result.kind === 'unverified_email') {
                // 403 (not 401) because the credential is valid — the user is just not authorized to use it yet.
                // Not counted as a miss either: the credential matched, the owner is just unverified.
                res.status(403).type('text').send('Email verification required');
                return;
            }

            req.auth = {
                user_id: result.user_id,
                user_uid: result.user_uid,
                personal_access_token_uid: result.personal_access_token_uid,
            };
            delete req.headers.authorization;
            next();
        }
        catch (error) {
            next(error);
        }
    };
}

function authenticated_user_id(req)
{
    return req.auth?.user_id ?? req.session?.user_id ?? null;
}

function authenticated_user_uid(req)
{
    return req.auth?.user_uid ?? req.session?.user_uid ?? null;
}

function is_public_path(path)
{
    return path_matches(config.public_paths, path);
}

function is_optional_auth_path(path)
{
    return path_matches(config.optional_auth_paths, path);
}

function path_matches(paths, path)
{
    return paths.some(function (configured_path) {
        if (configured_path.endsWith('/*')) {
            return path.startsWith(configured_path.slice(0, -1));
        }
        return path === configured_path;
    });
}

function make_ws_upgrade_handler(proxy, bearer_miss_limiter)
{
    return async function handle_ws_upgrade(req, socket, head) {
        const ip = req.socket.remoteAddress;

        function reject(code, text) {
            socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);
            socket.destroy();
        }

        try {
            const {pathname} = new URL(req.url, 'http://localhost');

            if (pathname === '/auth' || pathname.startsWith('/auth/')) {
                reject(404, 'Not Found');
                return;
            }

            const user_uid = await authenticate_ws_upgrade(req, ip, bearer_miss_limiter);
            if (!user_uid) {
                als.logger.write(`[ws_upgrade_reject] url=${JSON.stringify(req.url)} ip=${ip}`);
                reject(401, 'Unauthorized');
                return;
            }

            for (const name of Object.keys(req.headers)) {
                if (name.startsWith('x-auth-')) {
                    delete req.headers[name];
                }
            }
            delete req.headers.authorization;

            req.ws_user_uid = user_uid;
            als.logger.write(`[ws_upgrade] user_uid=${user_uid} url=${JSON.stringify(req.url)}`);
            proxy.upgrade(req, socket, head);
        }
        catch (error) {
            als.logger.write(`[ws_upgrade_error] ⚠️ ${error.message} ip=${ip}`);
            reject(500, 'Internal Server Error');
        }
    };
}

// WebSocket upgrades authenticate with an Authorization: Bearer personal access
// token. The browser WebSocket API can't set headers, so this path is for
// non-browser clients (e.g. the desktop app).
async function authenticate_ws_upgrade(req, ip, bearer_miss_limiter)
{
    if (!config.personal_access_tokens.enabled) {
        return null;
    }

    const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
    if (!match) {
        return null;
    }

    if (bearer_miss_limiter.is_blocked(ip)) {
        return null;
    }

    const result = await authenticate_personal_access_token({
        token: match[1].trim(),
        ip,
        ua: req.headers['user-agent'],
    });

    if (result.kind === 'invalid') {
        bearer_miss_limiter.record_failure(ip);
        return null;
    }
    if (result.kind === 'unverified_email') {
        return null;
    }

    return result.user_uid;
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
