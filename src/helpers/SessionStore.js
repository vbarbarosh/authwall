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

            callback(null, decode_json_column(row.data));
        }
        catch (error) {
            callback(error);
        }
    }

    async set(uid, data, callback) {
        try {
            const expires = data.cookie?.expires ? new Date(data.cookie.expires).getTime() : Date.now() + 86400000;

            console.log('set', uid, '-->', data);

            await db('sessions')
                .insert({uid, data: JSON.stringify(data), expires})
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

function decode_json_column(value)
{
    // MySQL return objects
    // SQLite return strings
    if (typeof value === 'string') {
        return JSON.parse(value);
    }
    return value;
}

module.exports = SessionStore;
