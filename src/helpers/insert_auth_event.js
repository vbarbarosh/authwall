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
        user_id: params.user?.id ?? req.session?.user_id ?? null,
        session_uid: req.sessionID ?? null,
        event_type: params.event_type,
        event_status: params.event_status ?? 'success',
        identity_type: params.ident?.type ?? null,
        identity_value: params.ident?.value ?? null,
        identity_value_normalized: params.ident?.value_normalized ?? null,
        ip: req.ip ?? req.session?.ip ?? null,
        ua: req.headers?.['user-agent'] ?? req.session?.ua ?? null,
        custom: JSON.stringify(params.custom ?? null),
        created_at: new Date(),
    });

    return uid;
}

module.exports = insert_auth_event;
