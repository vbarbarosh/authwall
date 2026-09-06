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

    // The only verified address cannot be removed when the account would be
    // stranded without it. With verification required, the next sign-in is
    // held at the verify step, and nothing there lets it add one back. Under
    // email access rules a username signs in on the strength of the account's
    // verified addresses (see username_sign_in_refusal), so it would be turned
    // away as though the password were wrong; an OAuth sign-in is authorized
    // against the provider's addresses instead, so an account with no username
    // is safe. An unverified address authorizes nothing under either rule and
    // stays removable: removing and re-adding is how a typo is fixed.
    const has_username = identities.some(v => v.type === const_user_identity.username);
    const strands_the_account = ident.verified_at && (config.confirm_email.required || (has_email_access_rules() && has_username));
    if (strands_the_account) {
        await insert_auth_event({
            req,
            ident,
            event_type: const_auth_event.identity_removed,
            event_status: const_auth_event_status.failure,
            custom: {reason: 'last_verified_email'},
        });
        throw new UserFriendlyError('Cannot remove email: a verified email is required to sign in');
    }

    await db.transaction(async function () {
        await db('user_identities').where({id: ident.id}).delete();
        // A reset link still out was delivered to this address; it leaves
        // with the address.
        await db('password_reset_tokens').where({user_id}).whereNull('used_at').del();
    });
    await insert_auth_event({req, ident, event_type: const_auth_event.identity_removed});
    redirect(req, res, config.pages.profile);
}

module.exports = routes;
