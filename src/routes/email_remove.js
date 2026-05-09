const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_auth_event_status = require('../helpers/const/const_auth_event_status');
const const_user_identity = require('../helpers/const/const_user_identity');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
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

    await db('user_identities').where({id: ident.id}).delete();
    await insert_auth_event({req, ident, event_type: const_auth_event.identity_removed});
    redirect(req, res, config.pages.profile);
}

module.exports = routes;
