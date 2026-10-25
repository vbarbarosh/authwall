const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const auth_middleware = require('../helpers/middleware/auth_middleware');
const config = require('../../config');
const const_auth_event = require('../helpers/const/const_auth_event');
const const_auth_event_status = require('../helpers/const/const_auth_event_status');
const const_email = require('../helpers/const/const_email');
const csrf_middleware = require('../helpers/middleware/csrf_middleware');
const db = require('../../db');
const format_date_pretty_24 = require('../helpers/format/format_date_pretty_24');
const get_user_email_and_name = require('../helpers/models/get_user_email_and_name');
const insert_auth_event = require('../helpers/insert_auth_event');
const make_rate_limit_middleware = require('../helpers/middleware/rate_limit_middleware');
const random_uid_personal_access_token = require('../helpers/random/random_uid_personal_access_token');
const require_confirmation = require('../helpers/require_confirmation');
const send_email_nothrow = require('../helpers/send_email_nothrow');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const {
    create_personal_access_token_secret,
    personal_access_token_hash,
    personal_access_token_prefix,
} = require('../helpers/personal_access_tokens');

const MAX_LABEL_LENGTH = 100;
const SECOND = 1000;
const MINUTE = 60*SECOND;

const pat_create_limiter = make_rate_limit_middleware(5, 60*MINUTE);

const routes = [
    {prepend: [auth_middleware, csrf_middleware], routes: [
        {req: 'POST /auth/personal-access-tokens', prepend: [pat_create_limiter], fn: personal_access_tokens_post},
        {req: 'POST /auth/personal-access-tokens/revoke', fn: personal_access_tokens_revoke_post},
    ]},
];

// POST /auth/personal-access-tokens
async function personal_access_tokens_post(req, res)
{
    if (!config.personal_access_tokens.enabled) {
        throw new UserFriendlyError('Personal access tokens are disabled');
    }

    const label = String(req.body.label ?? '').trim();
    if (!label) {
        throw new UserFriendlyError('Missing token label');
    }
    if (label.length > MAX_LABEL_LENGTH) {
        throw new UserFriendlyError(`Token label must be at most ${MAX_LABEL_LENGTH} characters`);
    }

    const expires_at = parse_expires_at(req.body.expires_days);
    await require_confirmation(req, {reason: 'pat_create', next: config.pages.personal_access_tokens, message: 'Confirm it is you before creating a token'});
    const token = create_personal_access_token_secret();
    const now = new Date();
    const row = {
        uid: random_uid_personal_access_token(),
        user_id: req.session.user_id,
        label,
        token_hash: personal_access_token_hash(token),
        token_prefix: personal_access_token_prefix(token),
        created_at: now,
        updated_at: now,
        expires_at,
    };

    await db('personal_access_tokens').insert(row);
    await insert_auth_event({
        req,
        event_type: const_auth_event.personal_access_token_created,
        custom: {
            personal_access_token_uid: row.uid,
            label,
            expires_at: expires_at && expires_at.toJSON(),
        },
    });

    res.send({
        token,
        personal_access_token: {
            uid: row.uid,
            label: row.label,
            token_prefix: row.token_prefix,
            created_at: row.created_at.toJSON(),
            updated_at: row.updated_at.toJSON(),
            expires_at: row.expires_at && row.expires_at.toJSON(),
            last_used_at: null,
            revoked_at: null,
            last_used_ip: null,
            last_used_ua: null,
        },
    });

    // A token acts as the owner for months: the owner hears of it (AW-92).
    const user = await db('users').where({id: req.session.user_id}).first();
    const email_and_name = await get_user_email_and_name(user.id, {verified_only: true});
    if (email_and_name) {
        await send_email_nothrow({
            name: const_email.personal_access_token_created,
            to: email_and_name,
            placeholders: {
                display_name: user.display_name,
                label,
                date: format_date_pretty_24(now),
                ip: req.session.ip ?? 'n/a',
                tokens_link: config.public_url + config.pages.personal_access_tokens,
                reset_link: config.public_url + urlmod(config.pages.password_reset_request, {email: email_and_name.email}),
            },
        });
    }
}

// POST /auth/personal-access-tokens/revoke
async function personal_access_tokens_revoke_post(req, res)
{
    if (!config.personal_access_tokens.enabled) {
        throw new UserFriendlyError('Personal access tokens are disabled');
    }

    const uid = String(req.body.uid ?? '').trim();
    if (!uid) {
        throw new UserFriendlyError('Missing token uid');
    }

    const personal_access_token = await db('personal_access_tokens')
        .where({uid, user_id: req.session.user_id})
        .first();

    if (!personal_access_token) {
        // Anti-enumeration to the caller (same "not found" message either way),
        // but the audit distinguishes "doesn't exist" from "exists under a
        // different owner" so a later security review can spot cross-user
        // probing.
        const tmp = await db('personal_access_tokens').where({uid}).first();
        const custom = {
            personal_access_token_uid: uid,
            reason: tmp ? 'belongs_to_another_user' : 'not_found',
        };
        if (tmp) {
            custom.target_user_id = tmp.user_id;
        }
        await insert_auth_event({
            req,
            event_type: const_auth_event.personal_access_token_revoked,
            event_status: const_auth_event_status.failure,
            custom,
        });
        throw new UserFriendlyError('Personal access token not found');
    }

    if (personal_access_token.revoked_at) {
        await insert_auth_event({
            req,
            event_type: const_auth_event.personal_access_token_revoked,
            event_status: const_auth_event_status.noop,
            custom: {personal_access_token_uid: uid, reason: 'already_revoked'},
        });
        throw new UserFriendlyError('Personal access token already revoked');
    }

    const now = new Date();
    await db('personal_access_tokens')
        .where({id: personal_access_token.id})
        .update({revoked_at: now, updated_at: now});

    await insert_auth_event({
        req,
        event_type: const_auth_event.personal_access_token_revoked,
        event_status: const_auth_event_status.success,
        custom: {personal_access_token_uid: uid},
    });

    res.send({ok: true});
}

function parse_expires_at(value)
{
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const days = Number(value);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
        throw new UserFriendlyError('Invalid token expiration');
    }

    return new Date(Date.now() + days*86400000);
}

module.exports = routes;
