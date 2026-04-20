const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const complete_sign_out = require('../actions/complete_sign_out');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');

const routes = [
    {prepend: [auth_middleware], routes: [
        {prepend: [csrf_middleware], routes: [
            {req: 'POST /auth/sessions/revoke', fn: sessions_revoke_post},
            {req: 'POST /auth/sessions/revoke-all', fn: sessions_revoke_all_post},
            {req: 'POST /auth/sign-out', fn: sign_out_post},
        ]},
    ]},
];

// POST /auth/sessions/revoke
async function sessions_revoke_post(req, res)
{
    const {uid} = req.body;
    if (!uid) {
        throw new UserFriendlyError('Missing session uid');
    }

    // Prevent deleting current session
    if (uid === req.sessionID) {
        await insert_auth_event({
            req,
            event_type: const_auth_event.session_revoked,
            event_status: 'failure',
            custom: {reason: 'cannot_revoke_current_session'},
        });
        throw new UserFriendlyError('Cannot revoke current session');
    }

    const deleted = await db('sessions').where({uid, user_id: req.session.user_id}).delete();
    await insert_auth_event({
        req,
        event_type: const_auth_event.session_revoked,
        event_status: deleted ? 'success' : 'noop',
        custom: {target_session_uid: uid, deleted},
    });

    redirect(req, res, config.pages.sessions);
}

// POST /auth/sessions/revoke-all
async function sessions_revoke_all_post(req, res)
{
    const deleted = await db('sessions')
        .where({user_id: req.session.user_id})
        .whereNot({uid: req.sessionID})
        .delete();

    await insert_auth_event({
        req,
        event_type: const_auth_event.session_revoked_all,
        event_status: deleted ? 'success' : 'noop',
        custom: {deleted},
    });
    redirect(req, res, config.pages.sessions);
}

// POST /auth/sign-out
async function sign_out_post(req, res)
{
    await complete_sign_out(req, res);
}

module.exports = routes;
