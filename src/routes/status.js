const db = require('../../db');

const routes = [
    {req: 'GET /auth/status', fn: status_get},
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
        csrf_token: req.session.csrf_token,
        display_name: user.display_name,
        avatar_url: user.avatar_url, // ?? 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYOiCQT7RdsZ50X6uSIX3IVaqwvfGiDD2EBQ&s',
        providers: await db('user_identities').where('user_id', req.session.user_id),
        current_session_uid: req.sessionID,
        sessions: await db('sessions').where('user_id', req.session.user_id),
    });
}

module.exports = routes;
