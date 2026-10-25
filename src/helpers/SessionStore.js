const config = require('../../config');
const db = require('../../db');
const express_session = require('express-session');

// Sessions are stored server-side (in the DB) rather than in stateless
// signed cookies. This is a deliberate choice for an auth proxy: it buys
// instant revocation. Revoking a session from the profile, "sign out
// everywhere" on a password reset, and account removal all kill live sessions
// immediately by deleting their rows. Stateless signed-cookie sessions can't
// revoke before expiry without reintroducing a server-side denylist, which
// puts the state right back and gives you the worst of both. For a tool whose
// whole job is gatekeeping, immediate revocation is load-bearing — so don't
// "simplify" this to stateless cookies. Keeping sessions stateful also makes
// the random per-session CSRF token (req.session.csrf_token) the correct
// synchronizer-token design — no app-wide CSRF key needed.
// An anonymous session exists only to carry the sign-in form's CSRF token.
// It gets a short row lifetime regardless of the cookie's 30-day maxAge, so
// a crawler or a probe that discards cookies does not leave a month of rows
// behind. The row is still extended on every request, so a visitor who is
// actually on the page keeps their token.
const ANONYMOUS_MAX_AGE_MS = 24*60*60*1000;
const DAY_MS = 24*60*60*1000;

class SessionStore extends express_session.Store
{
    // A session ends at its deadline, its start plus the cookie's maximum age,
    // however often it is used (AW-29): use extended it for ever, so a copied
    // cookie kept working while the browser's own had expired. The cookie comes
    // back whole, its policy from the configuration and its time left to the
    // deadline, so express-session neither drops the expiry nor re-issues it
    // without HttpOnly, SameSite, Domain or Secure (L-01).
    async get(uid, callback) {
        try {
            const now = new Date();

            const row = await db('sessions')
                .where({uid})
                .where('expires_at', '>', now)
                .where('created_at', '>', new Date(now.getTime() - max_age_ms()))
                .first();
            if (!row) {
                callback(null, null);
                return;
            }

            const deadline = session_deadline(row.created_at);
            const out = JSON.parse(row.custom);
            out.uid = row.uid;
            out.user_id = row.user_id;
            out.user_uid = row.user_uid;
            out.ip = row.ip;
            out.ua = row.ua;
            out.created_at = new Date(row.created_at).toJSON();
            out.cookie = {
                path: config.cookie.path,
                httpOnly: true,
                domain: config.cookie.domain,
                sameSite: config.cookie.same_site,
                secure: config.cookie.secure,
                expires: deadline,
                originalMaxAge: deadline.getTime() - now.getTime(),
            };
            callback(null, out);
        }
        catch (error) {
            callback(error);
        }
    }

    // A session read from a row (get() put its uid in it) only updates that
    // row: when a revocation deleted it while the request ran, the late save
    // changes nothing and the session stays revoked (M-01). A session made in
    // this request writes its row, as many times as the request saves it.
    async set(uid, data, callback) {
        try {
            const now = new Date();
            const expires_at = row_expires_at(data, now);

            const {user_id, user_uid, ip, ua, cookie, created_at, ...custom} = data;
            if (data.uid === uid) {
                await db('sessions').where({uid}).update({user_id, user_uid, ip, ua, custom: JSON.stringify(custom), updated_at: now, last_seen_at: now, expires_at});
            }
            else {
                await db('sessions')
                    .insert({uid, user_id, user_uid, ip, ua, custom: JSON.stringify(custom), created_at: now, updated_at: now, last_seen_at: now, expires_at})
                    .onConflict('uid')
                    .merge(['user_id', 'user_uid', 'ip', 'ua', 'custom', 'updated_at', 'expires_at', 'last_seen_at']);
            }

            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }

    async destroy(uid, callback) {
        try {
            await db('sessions').where({uid}).delete();
            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }

    async touch(uid, data, callback) {
        try {
            const now = new Date();
            const expires_at = row_expires_at(data, now);
            await db('sessions').where({uid}).update({expires_at, last_seen_at: now});
            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }
}

// Never past the session's deadline; an anonymous one also lapses a day
// after its last use.
function row_expires_at(data, now)
{
    const cookie_expires_at = data.cookie?.expires
        ? new Date(data.cookie.expires)
        : new Date(now.getTime() + (data.cookie?.maxAge || max_age_ms()));
    const deadline = session_deadline(data.created_at ?? now);
    if (data.user_id) {
        return new Date(Math.min(cookie_expires_at.getTime(), deadline.getTime()));
    }
    return new Date(Math.min(cookie_expires_at.getTime(), deadline.getTime(), now.getTime() + ANONYMOUS_MAX_AGE_MS));
}

function session_deadline(created_at)
{
    return new Date(new Date(created_at).getTime() + max_age_ms());
}

function max_age_ms()
{
    return config.cookie.max_age_days*DAY_MS;
}

module.exports = SessionStore;
