const config = require('../../config');
const const_user_identity = require('./const/const_user_identity');
const db = require('../../db');
const normalize_ip = require('./normalize/normalize_ip');
const promisify = require('./promisify');
const random_base62 = require('./random/random_base62');

async function replace_session(req, user)
{
    await promisify(v => req.session.regenerate(v));
    req.session.user_id = user.id;
    req.session.user_uid = user.uid;
    req.session.ip = normalize_ip(req.ip);
    req.session.ua = req.headers['user-agent'] ?? 'n/a';
    req.session.csrf_token = random_base62();
    if (config.email_verification.required) {
        const {email, email_verified_at} = await session_email_verification(user.id);
        req.session.email = email;
        req.session.email_verified_at = email_verified_at;
    }
    await promisify(v => req.session.save(v));
}

async function session_email_verification(user_id)
{
    const ident = await db('user_identities')
        .where({user_id, type: const_user_identity.email})
        .orderByRaw('verified_at IS NULL ASC')
        .orderBy('id')
        .first();

    return {
        email: ident?.value ?? null,
        email_verified_at: ident?.verified_at ? new Date(ident.verified_at).toJSON() : null,
    };
}

module.exports = replace_session;
