const auth_middleware = require('../helpers/middleware/auth_middleware');
const complete_sign_out = require('../actions/complete_sign_out');
const config = require('../../config');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
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
        throw new Error('Missing session uid');
    }

    // Prevent deleting current session
    if (uid === req.sessionID) {
        throw new Error('Cannot revoke current session');
    }

    await db('sessions').where({uid, user_id: req.session.user_id}).delete();

    redirect(req, res, config.pages.sessions);
}

// POST /auth/sessions/revoke-all
async function sessions_revoke_all_post(req, res)
{
    await db('sessions')
        .where({user_id: req.session.user_id})
        .whereNot({uid: req.sessionID})
        .delete();

    redirect(req, res, config.pages.sessions);
}

// POST /auth/sign-out
async function sign_out_post(req, res)
{
    await complete_sign_out(req, res);
}

module.exports = routes;
