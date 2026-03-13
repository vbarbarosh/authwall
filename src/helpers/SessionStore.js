const db = require('../../db');
const express_session = require('express-session');

class SessionStore extends express_session.Store
{
    async get(sid, callback) {
        try {
            const row = await db('sessions').where({session_id: sid}).first();
            console.log('get', sid, '-->', row);

            if (!row) {
                return callback(null, null);
            }

            if (row.expires < Date.now()) {
                await db('sessions').where({session_id: sid}).delete();
                return callback(null, null);
            }

            callback(null, row.data);
        }
        catch (error) {
            callback(error);
        }
    }

    async set(sid, data, callback) {
        try {
            const expires = data.cookie?.expires ? new Date(data.cookie.expires).getTime() : Date.now() + 86400000;

            console.log('set', sid, '-->', data);

            await db('sessions')
                .insert({session_id: sid, data: JSON.stringify(data), expires})
                .onConflict('session_id')
                .merge();

            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }

    async destroy(sid, callback) {
        try {
            console.log('destroy', sid);
            await db('sessions').where({session_id: sid}).delete();
            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }

    async touch(sid, data, callback) {
        try {
            console.log('touch', sid, '-->', data);
            const expires = data.cookie?.expires ? new Date(data.cookie.expires).getTime() : Date.now() + 86400000;
            await db('sessions').where({session_id: sid}).update({expires});
            callback(null);
        }
        catch (error) {
            callback(error);
        }
    }
}

module.exports = SessionStore;
