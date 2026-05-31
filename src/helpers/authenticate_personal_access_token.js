const config = require('../../config');
const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');
const {personal_access_token_hash} = require('./personal_access_tokens');

const TOUCH_MIN_INTERVAL_MS = 5*60*1000;

// Validates a bearer token presented over HTTP or WS-upgrade and, on success,
// touches the row's last_used_* columns. Returns one of:
//   {kind: 'invalid'}
//   {kind: 'unverified_email'}     // credential matched, owner not yet verified
//   {kind: 'ok', user_id, user_uid, personal_access_token_uid}
async function authenticate_personal_access_token({token, ip = null, ua = null, now = new Date()})
{
    const token_hash = personal_access_token_hash(token);
    const personal_access_token = await db('personal_access_tokens')
        .where({token_hash})
        .whereNull('revoked_at')
        .where(function () {
            this.whereNull('expires_at').orWhere('expires_at', '>', now);
        })
        .first();

    if (!personal_access_token) {
        return {kind: 'invalid'};
    }

    const user = await db('users').where({id: personal_access_token.user_id}).first();
    if (!user) {
        return {kind: 'invalid'};
    }

    if (config.confirm_email.required) {
        const verified_email = await db('user_identities')
            .where({user_id: user.id, type: const_user_identity.email})
            .whereNotNull('verified_at')
            .first();
        if (!verified_email) {
            return {kind: 'unverified_email'};
        }
    }

    await touch(personal_access_token, {ip, ua, now});

    return {
        kind: 'ok',
        user_id: user.id,
        user_uid: user.uid,
        personal_access_token_uid: personal_access_token.uid,
    };
}

async function touch(personal_access_token, {ip, ua, now})
{
    const last_used_at = personal_access_token.last_used_at && new Date(personal_access_token.last_used_at);
    if (last_used_at && now.getTime() - last_used_at.getTime() < TOUCH_MIN_INTERVAL_MS) {
        return;
    }

    await db('personal_access_tokens').where({id: personal_access_token.id}).update({
        last_used_at: now,
        last_used_ip: ip,
        last_used_ua: ua,
        updated_at: now,
    });
}

module.exports = authenticate_personal_access_token;
