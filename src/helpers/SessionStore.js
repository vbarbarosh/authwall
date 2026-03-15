const _try = require('@vbarbarosh/node-helpers/src/_try');
const db = require('../../db');
const express_session = require('express-session');

class SessionStore extends express_session.Store
{
    async get(uid, callback) {
        try {
            const row = await db('sessions').where({uid}).where('expires_at', '>', db.fn.now()).first();
            console.log('get', uid, '-->', row);

            if (!row) {
                return callback(null, null);
            }

            const out = _try(() => JSON.parse(row.custom)) || {};
            out.user_id = row.user_id;
            callback(null, out);
        }
        catch (error) {
            callback(error);
        }
    }

    async set(uid, data, callback) {
        try {
            const expires_at = data.cookie?.expires
                ? new Date(data.cookie.expires)
                : new Date(Date.now() + (data.cookie?.maxAge || 86400000));

            console.log('set', uid, '-->', data);

            const {user_id, ...custom} = data;
            await db('sessions')
                .insert({uid, user_id, custom: JSON.stringify(custom), created_at: db.fn.now(), updated_at: db.fn.now(), expires_at})
                .onConflict('uid')
                .merge(['user_id', 'custom', 'updated_at', 'expires_at']);

            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }

    async destroy(uid, callback) {
        try {
            console.log('destroy', uid);
            await db('sessions').where({uid}).delete();
            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }

    async touch(uid, data, callback) {
        try {
            console.log('touch', uid, '-->', data);
            const expires_at = data.cookie?.expires
                ? new Date(data.cookie.expires)
                : new Date(Date.now() + (data.cookie?.maxAge || 86400000));
            await db('sessions').where({uid}).update({expires_at, updated_at: db.fn.now()});
            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }
}

module.exports = SessionStore;
