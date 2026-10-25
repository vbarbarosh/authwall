const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const destroy_session = require('../helpers/destroy_session');
const fs = require('fs/promises');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');
const require_confirmation = require('../helpers/require_confirmation');

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
    // Removing the account takes two different ways to confirm it is the
    // owner when the account has two: its password, a code to its primary
    // address, a fresh sign-in with a linked provider (the author, 10-25).
    const identities = await db('user_identities').where({user_id: user.id});
    const ways = [
        user.password_hash !== null,
        config.mailer.enabled && identities.some(v => v.primary_at),
        identities.some(v => v.type.startsWith('oauth_') && v.verified_at),
    ];
    const factors = Math.max(1, Math.min(2, ways.filter(Boolean).length));
    await require_confirmation(req, {reason: 'account_remove', next: config.pages.profile, message: 'Confirm it is you before removing your account', factors});

    await db.transaction(async function () {
        const user_id = user.id;
        await db('confirm_codes').where({user_id}).del();
        await db('email_change_tokens').where({user_id}).del();
        await db('email_verify_tokens').where({user_id}).del();
        await db('password_reset_tokens').where({user_id}).del();
        await db('personal_access_tokens').where({user_id}).del();
        await db('sessions').where({user_id}).del();
        await db('user_identities').where({user_id}).del();
        await db('auth_events').where({user_id}).update({user_id: null});
        await db('users').where({id: user_id}).del();
        await insert_auth_event({
            req,
            user: null,
            event_type: const_auth_event.account_removed,
            ident: {value: user.uid, value_normalized: user.uid},
            custom: {user_uid: user.uid, user_slug: user.slug},
        });
    });

    await fs.rm(fs_path_resolve(config.uploads_dir, user.slug), {recursive: true, force: true});
    await destroy_session(req);
    redirect(req, res, config.pages.sign_in);
}

module.exports = routes;
