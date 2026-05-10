const config = require('../../config');
const const_user_identity = require('../helpers/const/const_user_identity');
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
    res.set('Cache-Control', 'no-store');

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
    if (config.mailer.enabled && config.confirm_email.enabled) {
        flows.confirm_email = {
            mode: config.confirm_email.mode,
            code_length: config.confirm_email.code_length,
        };
    }
    if (config.flows.google.enabled) {
        flows.google = {};
    }
    if (config.flows.github.enabled) {
        flows.github = {};
    }
    if (config.flows.microsoft.enabled) {
        flows.microsoft = {};
    }
    if (config.flows.facebook.enabled) {
        flows.facebook = {};
    }
    if (config.flows.twitter.enabled) {
        flows.twitter = {};
    }
    if (config.flows.discord.enabled) {
        flows.discord = {};
    }

    if (!user) {
        res.send({
            error,
            authenticated: false,
            csrf_token: req.session.csrf_token,
            flows,
            actions: {
                can_change_email: config.mailer.enabled,
            },
            version: pkg.version,
        });
        return;
    }

    const identities = await db('user_identities').where('user_id', req.session.user_id);
    const confirm_email = await get_confirm_email_status(user.id, identities);

    res.send({
        error,
        authenticated: true,
        flows,
        ...(confirm_email ? {confirm_email} : {}),
        actions: {
            can_change_email: config.mailer.enabled,
        },
        user_uid: user.uid,
        user_slug: user.slug,
        csrf_token: req.session.csrf_token,
        display_name: user.display_name,
        avatar_url: user.avatar_url, // ?? 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYOiCQT7RdsZ50X6uSIX3IVaqwvfGiDD2EBQ&s',
        providers: frontend_user_identities(identities),
        current_session_uid: req.sessionID,
        sessions: frontend_sessions(await db('sessions').where('user_id', req.session.user_id)),
        version: pkg.version,
    });
}

async function get_confirm_email_status(user_id, identities)
{
    if (!config.mailer.enabled || !config.confirm_email.enabled) {
        return null;
    }

    const ident = identities.find(v => v.type === const_user_identity.email && !v.verified_at);
    if (!ident) {
        return null;
    }

    const record = await db('email_verify_tokens')
        .where({
            user_id,
            email_normalized: ident.value_normalized,
        })
        .whereNull('used_at')
        .orderBy('id', 'desc')
        .first();

    if (!record) {
        return null;
    }

    const resend_available_at = new Date(new Date(record.created_at).getTime() + config.confirm_email.resend_cooldown_seconds * 1000);
    return {
        expires_at: new Date(record.expires_at).toJSON(),
        resend_available_at: resend_available_at.toJSON(),
    };
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
