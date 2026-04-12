const db = require('../../db');
const frontend_sessions = require('../helpers/models/frontend_sessions');
const frontend_user_identities = require('../helpers/models/frontend_user_identities');

const routes = [
    {req: 'GET /auth/status', fn: status_get},
    {req: 'GET /auth/sidecar', fn: sidecar_get},
];

// GET /auth/status
async function status_get(req, res)
{
    let user = null;
    if (req.session.user_id) {
        user = await db('users').where({id: req.session.user_id}).first();
    }

    const error = req.session.error ?? null;
    delete req.session.error;

    if (!user) {
        res.send({
            error,
            authenticated: false,
            csrf_token: req.session.csrf_token,
        });
        return;
    }

    res.send({
        error,
        authenticated: true,
        user_uid: user.uid,
        user_slug: user.slug,
        csrf_token: req.session.csrf_token,
        display_name: user.display_name,
        avatar_url: user.avatar_url, // ?? 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYOiCQT7RdsZ50X6uSIX3IVaqwvfGiDD2EBQ&s',
        providers: frontend_user_identities(await db('user_identities').where('user_id', req.session.user_id)),
        current_session_uid: req.sessionID,
        sessions: frontend_sessions(await db('sessions').where('user_id', req.session.user_id)),
    });
}

// GET /auth/sidecar
async function sidecar_get(req, res)
{
    if (!req.session.user_id) {
        res.status(401).send();
        return;
    }

    const user = await db('users').where({id: req.session.user_id}).first();
    if (!user) {
        res.status(401).send();
        return;
    }

    res.setHeader('X-Auth-User',  user.uid);
    res.status(200).send();
}

module.exports = routes;
