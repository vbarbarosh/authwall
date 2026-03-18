const db = require('../../db');
const express_session = require('express-session');

class SessionStore extends express_session.Store
{
    async get(uid, callback) {
        console.log(`[session_get] [uid=${uid}]`);
        try {
            const now = new Date();

            const row = await db('sessions').where({uid}).where('expires_at', '>', now).first();
            if (!row) {
                callback(null, null);
                return;
            }

            const out = JSON.parse(row.custom);
            out.user_id = row.user_id;
            out.user_uid = row.user_uid;
            out.ip = row.ip;
            out.user_agent = row.user_agent;
            callback(null, out);
        }
        catch (error) {
            callback(error);
        }
    }

    async set(uid, data, callback) {
        console.log(`[session_set] [uid=${uid}]`, data);
        try {
            const now = new Date();
            const expires_at = data.cookie?.expires
                ? new Date(data.cookie.expires)
                : new Date(now.getTime() + (data.cookie?.maxAge || 86400000));

            const {user_id, user_uid, ip, user_agent, ...custom} = data;
            await db('sessions')
                .insert({uid, user_id, user_uid, ip, user_agent, custom: JSON.stringify(custom), created_at: now, updated_at: now, last_seen_at: now, expires_at})
                .onConflict('uid')
                .merge(['user_id', 'user_uid', 'ip', 'user_agent', 'custom', 'updated_at', 'expires_at', 'last_seen_at']);

            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }

    async destroy(uid, callback) {
console.log(`[session_destroy] [uid=${uid}]`);
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
console.log(`[session_touch] [uid=${uid}]`, data);
            const now = new Date();
            const expires_at = data.cookie?.expires
                ? new Date(data.cookie.expires)
                : new Date(now.getTime() + (data.cookie?.maxAge || 86400000));
            await db('sessions').where({uid}).update({expires_at, last_seen_at: now});
            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }
}

module.exports = SessionStore;
