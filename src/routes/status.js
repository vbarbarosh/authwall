const config = require('../../config');
const db = require('../../db');
const frontend_sessions = require('../helpers/models/frontend_sessions');
const frontend_user_identities = require('../helpers/models/frontend_user_identities');
const pkg = require('../../package.json');

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

    // {
    //   "authenticated": true,
    //   "user": {...},
    //   "flows": {
    //     "password": {"allow_username": true, "allow_email": true},
    //     "magic_link": {"mode": "link_and_code"},
    //     "google": {}
    //   },
    //   "actions": {
    //     "can_sign_in": false,
    //     "can_sign_up": false,
    //     "can_sign_out": true,
    //     "can_change_password": true,
    //     "can_connect_google": true
    //   }
    // }

    const flows = {};
    if (config.flows.password.enabled) {
        const {allow_username, allow_email, min_password_length} = config.flows.password;
        flows.password = {
            allow_username,
            allow_email,
            min_password_length,
        };
    }
    if (config.flows.magic_link.enabled) {
        flows.magic_link = {
            mode: config.flows.magic_link.mode,
        };
    }
    if (config.flows.google.enabled) {
        flows.google = {};
    }
    if (config.flows.github.enabled) {
        flows.github = {};
    }

    if (!user) {
        res.send({
            error,
            authenticated: false,
            csrf_token: req.session.csrf_token,
            flows,
            version: pkg.version,
        });
        return;
    }

    res.send({
        error,
        authenticated: true,
        flows,
        user_uid: user.uid,
        user_slug: user.slug,
        csrf_token: req.session.csrf_token,
        display_name: user.display_name,
        avatar_url: user.avatar_url, // ?? 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYOiCQT7RdsZ50X6uSIX3IVaqwvfGiDD2EBQ&s',
        providers: frontend_user_identities(await db('user_identities').where('user_id', req.session.user_id)),
        current_session_uid: req.sessionID,
        sessions: frontend_sessions(await db('sessions').where('user_id', req.session.user_id)),
        version: pkg.version,
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
