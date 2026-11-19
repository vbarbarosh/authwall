const UserFriendlyError = require('@vbarbarosh/node-helpers/src/errors/UserFriendlyError');
const const_auth_event = require('../const/const_auth_event');
const const_auth_event_status = require('../const/const_auth_event_status');
const db = require('../../../db');

const FAILURES_MAX = 5;
const WINDOW_MS = 15*60*1000;

// One budget for every proof the owner gives while signed in: a wrong code or
// password at "confirm it is you", and a wrong current password at a password
// change (M-07), so a borrowed session cannot try passwords at another door.
// Counted from the failure events in the database, across codes and
// processes, not in memory. Spent, it refuses even the right answer.
async function assert_confirmation_budget_available(user_id, now = new Date())
{
    const [{failures}] = await db('auth_events')
        .where({user_id, event_type: const_auth_event.identity_confirmed, event_status: const_auth_event_status.failure})
        .where('created_at', '>', new Date(now.getTime() - WINDOW_MS))
        .count('* AS failures');
    if (Number(failures) >= FAILURES_MAX) {
        throw new UserFriendlyError('Too many attempts. Try again later.');
    }
}

module.exports = assert_confirmation_budget_available;
