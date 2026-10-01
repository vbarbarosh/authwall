const Sentry = require('@sentry/node');
const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const pkg = require('../../package.json');
const urlxxx = require('../helpers/urlxxx');

let initialized = false;

function init_sentry(config)
{
    if (!config.sentry.enabled) {
        return false;
    }

    if (initialized || Sentry.isInitialized()) {
        return true;
    }

    const options = {
        dsn: config.sentry.dsn,
        release: `${pkg.name}@${pkg.version}`,
        // v11 collects cookies, bodies, headers and the client IP unless told
        // otherwise; this is the v10 `sendDefaultPii: false` baseline.
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: {
                request: {deny: ['forwarded', '-ip', 'remote-', 'via', '-user']},
                response: {deny: ['forwarded', '-ip', 'remote-', 'via', '-user']},
            },
            httpBodies: [],
            urlQueryParams: {deny: ['forwarded', '-ip', 'remote-', 'via', '-user']},
            genAI: {inputs: false, outputs: false},
            databaseQueryData: false,
            queues: false,
            graphQL: {document: false, variables: false},
        },
        beforeSend: sentry_before_send,
        beforeSendSpan: sanitize_sentry_span,
        beforeBreadcrumb: sanitize_sentry_breadcrumb,
    };

    if (config.sentry.environment) {
        options.environment = config.sentry.environment;
    }
    if (config.sentry.traces_sample_rate != null) {
        options.tracesSampleRate = config.sentry.traces_sample_rate;
    }

    Sentry.init(options);
    initialized = true;
    return true;
}

function sentry_request_context(req, res, next)
{
    if (Sentry.isInitialized()) {
        Sentry.setTag('authwall.req_uid', req.uid);
        Sentry.setUser(req.session?.user_uid ? {id: req.session.user_uid} : null);
    }
    next();
}

function setup_sentry_error_handler(app)
{
    if (Sentry.isInitialized()) {
        Sentry.setupExpressErrorHandler(app);
    }
}

function sentry_before_send(event, hint)
{
    if (hint?.originalException instanceof UserFriendlyError) {
        return null;
    }

    return sanitize_sentry_event(event);
}

// Every place a URL can appear in an event is a sink for the one-time
// credentials Authwall passes as query parameters: the request url, the
// Referer header (the reset and magic-link pages carry their token in the
// address bar), and the breadcrumbs the SDK records for incoming and outgoing
// HTTP calls (an OAuth token exchange has the provider secret in its query).
function sanitize_sentry_event(event)
{
    if (event.request) {
        event.request.url = urlxxx(event.request.url);
        delete event.request.query_string;
        delete event.request.data;
        delete event.request.cookies;

        if (event.request.headers) {
            for (const key of Object.keys(event.request.headers)) {
                if (is_sensitive_header(key)) {
                    delete event.request.headers[key];
                }
                else if (is_referer_header(key)) {
                    event.request.headers[key] = urlxxx(event.request.headers[key]);
                }
            }
        }
    }
    if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.map(sanitize_sentry_breadcrumb).filter(Boolean);
    }
    return event;
}

// Spans are streamed one by one in v11 (no transaction event to scrub), and
// carry the incoming and outgoing URLs and the request headers as attributes.
function sanitize_sentry_span(span)
{
    const attributes = span?.attributes;
    if (!attributes || typeof attributes !== 'object') {
        return span;
    }
    for (const key of ['url.full', 'http.url']) {
        if (typeof attributes[key] === 'string') {
            attributes[key] = urlxxx(attributes[key]);
        }
    }
    for (const key of ['url.query', 'http.query']) {
        if (typeof attributes[key] === 'string') {
            attributes[key] = queryxxx(attributes[key]);
        }
    }
    for (const key of Object.keys(attributes)) {
        if (key.startsWith('http.request.header.') && is_referer_header(key.slice('http.request.header.'.length))) {
            attributes[key] = Array.isArray(attributes[key]) ? attributes[key].map(urlxxx) : urlxxx(attributes[key]);
        }
    }
    return span;
}

function sanitize_sentry_breadcrumb(breadcrumb)
{
    if (!breadcrumb || typeof breadcrumb !== 'object') {
        return breadcrumb;
    }
    if (breadcrumb.data && typeof breadcrumb.data === 'object') {
        for (const key of ['url', 'from', 'to']) {
            if (typeof breadcrumb.data[key] === 'string') {
                breadcrumb.data[key] = urlxxx(breadcrumb.data[key]);
            }
        }
        for (const key of ['url.query', 'http.query']) {
            if (typeof breadcrumb.data[key] === 'string') {
                breadcrumb.data[key] = queryxxx(breadcrumb.data[key]);
            }
        }
    }
    if (typeof breadcrumb.message === 'string') {
        breadcrumb.message = urlxxx(breadcrumb.message);
    }
    return breadcrumb;
}

// A query string without its URL: `code=abc` (v11) or `?code=abc` (v10)
function queryxxx(query)
{
    if (!query) {
        return query;
    }
    if (query.startsWith('?')) {
        return urlxxx(query);
    }
    return urlxxx(`?${query}`).slice(1);
}

function is_referer_header(key)
{
    return ['referer', 'referrer'].includes(key.toLowerCase());
}

function is_sensitive_header(key)
{
    return [
        'authorization',
        'cookie',
        'set-cookie',
        'x-csrf-token',
    ].includes(key.toLowerCase());
}

module.exports = {
    init_sentry,
    sentry_before_send,
    sentry_request_context,
    setup_sentry_error_handler,
    sanitize_sentry_event,
    sanitize_sentry_span,
    sanitize_sentry_breadcrumb,
};
