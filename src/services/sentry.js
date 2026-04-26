const Sentry = require('@sentry/node');
const pkg = require('../../package.json');

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
        beforeSend: sanitize_sentry_event,
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

function sanitize_sentry_event(event)
{
    if (event.request) {
        event.request.url = sanitize_url(event.request.url);
        delete event.request.query_string;
        delete event.request.data;

        if (event.request.headers) {
            for (const key of Object.keys(event.request.headers)) {
                if (is_sensitive_header(key)) {
                    delete event.request.headers[key];
                }
            }
        }
    }
    return event;
}

function sanitize_url(url)
{
    if (!url) {
        return url;
    }

    try {
        const out = new URL(url);
        for (const key of out.searchParams.keys()) {
            if (is_sensitive_query_param(key)) {
                out.searchParams.set(key, '[Filtered]');
            }
        }
        return out.toString();
    }
    catch (error) {
        return url;
    }
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

function is_sensitive_query_param(key)
{
    const normalized = key.toLowerCase();
    if (normalized.includes('token') || normalized.includes('secret') || normalized.includes('password')) {
        return true;
    }
    return ['code', 'state'].includes(normalized);
}

module.exports = {
    init_sentry,
    sentry_request_context,
    setup_sentry_error_handler,
    sanitize_sentry_event,
};
