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
        sendDefaultPii: false,
        beforeSend: sentry_before_send,
        beforeSendTransaction: sanitize_sentry_event,
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

function sanitize_sentry_breadcrumb(breadcrumb)
{
    if (!breadcrumb || typeof breadcrumb !== 'object') {
        return breadcrumb;
    }
    if (breadcrumb.data && typeof breadcrumb.data === 'object') {
        for (const key of ['url', 'http.query', 'from', 'to']) {
            if (typeof breadcrumb.data[key] === 'string') {
                breadcrumb.data[key] = urlxxx(breadcrumb.data[key]);
            }
        }
    }
    if (typeof breadcrumb.message === 'string') {
        breadcrumb.message = urlxxx(breadcrumb.message);
    }
    return breadcrumb;
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
    sanitize_sentry_breadcrumb,
};
