const const_auth_event_status = require('./const/const_auth_event_status');
const db = require('../../db');
const random_uid_auth_event = require('./random/random_uid_auth_event');

async function insert_auth_event(params)
{
    if (!params.event_type) {
        throw new Error('Empty event_type');
    }

    const uid = params.uid ?? random_uid_auth_event();
    const req = params.req;

    await db('auth_events').insert({
        uid,
        user_id: (params.user === null) ? null : params.user?.id ?? req.auth?.user_id ?? req.session?.user_id ?? null,
        session_uid: req.sessionID ?? null,
        event_type: params.event_type,
        event_status: params.event_status ?? const_auth_event_status.success,
        identity_type: params.ident?.type ?? null,
        identity_value: auth_event_text(params.ident?.value, 255),
        identity_value_normalized: auth_event_text(params.ident?.value_normalized, 255),
        ip: auth_event_text(req.ip ?? req.session?.ip, 64),
        ua: auth_event_text(req.headers?.['user-agent'] ?? req.session?.ua, 512),
        custom: JSON.stringify(params.custom ?? null),
        created_at: new Date(),
    });

    return uid;
}

function auth_event_text(value, length)
{
    return (typeof value === 'string') ? Array.from(value).slice(0, length).join('') : null;
}

module.exports = insert_auth_event;
