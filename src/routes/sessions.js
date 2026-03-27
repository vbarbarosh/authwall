const auth_middleware = require('../helpers/middleware/auth_middleware');
const config = require('../../config');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const destroy_session = require('../helpers/destroy_session');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const redirect = require('../helpers/redirect');

const routes = [
    {prepend: [auth_middleware], routes: [
        // {req: 'GET /auth/sessions', fn: sessions_get},
        // {req: 'GET /auth/sign-out', fn: sign_out_get},
        {prepend: [csrf_middleware], routes: [
            {req: 'POST /auth/sessions/revoke', fn: sessions_revoke_post},
            {req: 'POST /auth/sessions/revoke-all', fn: sessions_revoke_all_post},
            {req: 'POST /auth/sign-out', fn: sign_out_post},
        ]},
    ]},
];

// // GET /auth/sessions
// async function sessions_get(req, res)
// {
//     res.sendFile(fs_path_resolve(__dirname, '../static/sessions.html'));
// }
//
// // GET /auth/sign-out
// async function sign_out_get(req, res)
// {
//     res.sendFile(fs_path_resolve(__dirname, '../static/sign-out.html'));
// }

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
    await destroy_session(req);
    redirect(req, res, config.pages.sign_in);
}

module.exports = routes;
