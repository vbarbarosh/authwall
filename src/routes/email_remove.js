const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_auth_event_status = require('../helpers/const/const_auth_event_status');
const const_user_identity = require('../helpers/const/const_user_identity');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const has_email_access_rules = require('../helpers/has_email_access_rules');
const insert_auth_event = require('../helpers/insert_auth_event');
const redirect = require('../helpers/redirect');

const routes = [
    {req: 'POST /auth/email/remove', fn: [auth_middleware, csrf_middleware, email_remove_post]},
];

// POST /auth/email/remove
async function email_remove_post(req, res)
{
    const user_id = req.session.user_id;
    const identities = await db('user_identities').where({user_id});
    const ident = identities.find(v => v.type === const_user_identity.email);

    if (!ident) {
        await insert_auth_event({
            req,
            ident: {type: const_user_identity.email},
            event_type: const_auth_event.identity_removed,
            event_status: const_auth_event_status.noop,
            custom: {reason: 'not_connected'},
        });
        return redirect(req, res, config.pages.profile);
    }

    if (identities.length <= 1) {
        await insert_auth_event({
            req,
            ident,
            event_type: const_auth_event.identity_removed,
            event_status: const_auth_event_status.failure,
            custom: {reason: 'last_identity'},
        });
        throw new UserFriendlyError('Cannot remove email: it is your only sign-in method');
    }

    // With verification required, an account without a verified address is
    // held at the verify step on its next sign-in, and nothing there lets it
    // add one back — so the only verified address cannot be removed. Email
    // access rules strand a username the same way: they authorize a username
    // sign-in by the verified addresses on the account, so a username left
    // without one is refused, and refused as though the password were wrong.
    // That question is only ever put to a username — an OAuth sign-in is
    // authorized against the addresses its provider reports — so an account
    // with no username keeps nothing by keeping this one. An unverified
    // address authorizes nothing under either rule and stays removable:
    // removing and re-adding is how a typo is fixed.
    const has_username = identities.some(v => v.type === const_user_identity.username);
    if ((config.confirm_email.required || (has_email_access_rules() && has_username)) && ident.verified_at) {
        await insert_auth_event({
            req,
            ident,
            event_type: const_auth_event.identity_removed,
            event_status: const_auth_event_status.failure,
            custom: {reason: 'last_verified_email'},
        });
        throw new UserFriendlyError('Cannot remove email: a verified email is required to sign in');
    }

    await db('user_identities').where({id: ident.id}).delete();
    await insert_auth_event({req, ident, event_type: const_auth_event.identity_removed});
    redirect(req, res, config.pages.profile);
}

module.exports = routes;
