const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const destroy_session = require('../helpers/destroy_session');
const fs = require('fs/promises');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const random_uid_auth_event = require('../helpers/random/random_uid_auth_event');
const redirect = require('../helpers/redirect');

const routes = [
    {req: 'POST /auth/account/remove', fn: [auth_middleware, csrf_middleware, account_remove_post]},
];

// POST /auth/account/remove
async function account_remove_post(req, res)
{
    if (req.body.confirmation !== 'DELETE') {
        throw new UserFriendlyError('Type DELETE to remove account');
    }

    const user = await db('users').where({id: req.session.user_id}).first();
    if (!user) {
        throw new UserFriendlyError('User not found');
    }

    await db.transaction(async function () {
        const user_id = user.id;
        await db('email_change_tokens').where({user_id}).del();
        await db('email_verify_tokens').where({user_id}).del();
        await db('password_reset_tokens').where({user_id}).del();
        await db('sessions').where({user_id}).del();
        await db('user_identities').where({user_id}).del();
        await db('auth_events').where({user_id}).update({user_id: null});
        await db('users').where({id: user_id}).del();
        await db('auth_events').insert({
            uid: random_uid_auth_event(),
            user_id: null,
            session_uid: req.sessionID ?? null,
            event_type: const_auth_event.account_removed,
            event_status: 'success',
            identity_type: null,
            identity_value: user.uid,
            identity_value_normalized: user.uid,
            ip: req.ip ?? req.session?.ip ?? null,
            ua: req.headers?.['user-agent'] ?? req.session?.ua ?? null,
            custom: JSON.stringify({user_uid: user.uid, user_slug: user.slug}),
            created_at: new Date(),
        });
    });

    await fs.rm(fs_path_resolve(config.uploads_dir, user.slug), {recursive: true, force: true});
    await destroy_session(req);
    redirect(req, res, config.pages.sign_in);
}

module.exports = routes;
