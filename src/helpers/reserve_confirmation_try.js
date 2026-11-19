const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const const_auth_event = require('./const/const_auth_event');
const const_auth_event_status = require('./const/const_auth_event_status');
const db = require('../../db');
const insert_auth_event = require('./insert_auth_event');
const release_confirmation_try = require('./release_confirmation_try');

const FAILURES_MAX = 5;
const WINDOW_MS = 15*60*1000;

// One budget for every proof the owner gives while signed in: a wrong code or
// password at "confirm it is you", and a wrong current password at a password
// change (M-07), so a borrowed session cannot try passwords at another door.
// Counted from the failure events in the database, across codes and
// processes, not in memory. Spent, it refuses even the right answer.
//
// The try is written as a failure before the answer is compared, and counted
// with it, so a burst of tries is counted whole: no more than five are ever
// compared (AW-87). Returns the try; release_confirmation_try gives it back
// when the answer was right.
async function reserve_confirmation_try(req, user_id, method, now = new Date())
{
    const uid = await insert_auth_event({req, user: {id: user_id}, event_type: const_auth_event.identity_confirmed, event_status: const_auth_event_status.failure, custom: {method}});
    const [{failures}] = await db('auth_events')
        .where({user_id, event_type: const_auth_event.identity_confirmed, event_status: const_auth_event_status.failure})
        .where('created_at', '>', new Date(now.getTime() - WINDOW_MS))
        .count('* AS failures');
    if (Number(failures) > FAILURES_MAX) {
        // Refused uncompared: not a wrong answer.
        await release_confirmation_try(uid);
        throw new UserFriendlyError('Too many attempts. Try again later.');
    }
    return uid;
}

module.exports = reserve_confirmation_try;
