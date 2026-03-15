const db = require('../../db');
const express_session = require('express-session');

class SessionStore extends express_session.Store
{
    async get(uid, callback) {
        try {
            const row = await db('sessions').where({uid}).first();
            console.log('get', uid, '-->', row);

            if (!row) {
                return callback(null, null);
            }

            if (row.expires < Date.now()) {
                await db('sessions').where({uid}).delete();
                return callback(null, null);
            }

            const out = JSON.parse(row.custom);
            out.user_id = row.user_id;
            callback(null, out);
        }
        catch (error) {
            callback(error);
        }
    }

    async set(uid, data, callback) {
        try {
            const expires = data.cookie?.expires
                ? new Date(data.cookie.expires).getTime()
                : Date.now() + (data.cookie?.maxAge || 86400000);

            console.log('set', uid, '-->', data);

            const {user_id, ...custom} = data;
            await db('sessions')
                .insert({uid, user_id, custom: JSON.stringify(custom), expires})
                .onConflict('uid')
                .merge();

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
            const expires = data.cookie?.expires ? new Date(data.cookie.expires).getTime() : Date.now() + 86400000;
            await db('sessions').where({uid}).update({expires});
            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }
}

module.exports = SessionStore;
