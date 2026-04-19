const db = require('../../db');
const random_uid_auth_event = require('./random/random_uid_auth_event');

async function insert_auth_event(req = {}, params = {})
{
    const now = new Date();
    const uid = params.uid ?? random_uid_auth_event();

    await db('auth_events').insert({
        uid,
        user_id: params.user_id ?? req.session?.user_id ?? null,
        session_uid: params.session_uid ?? req.sessionID ?? null,
        event_type: params.event_type,
        event_status: params.event_status ?? 'success',
        identity_type: params.identity_type ?? null,
        identity_value: params.identity_value ?? null,
        identity_value_normalized: params.identity_value_normalized ?? null,
        ip: params.ip ?? req.ip ?? req.session?.ip ?? null,
        ua: params.ua ?? req.headers?.['user-agent'] ?? req.session?.ua ?? null,
        custom: JSON.stringify(params.custom ?? {}),
        created_at: params.created_at ?? now,
    });

    return uid;
}

module.exports = insert_auth_event;
