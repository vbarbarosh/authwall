const db = require('../../db');

// Marks a one-time row used, but only if nobody has yet, and says whether
// this caller was the one. Validation reads the row first, and two requests
// can both read it unused; the conditional update is where exactly one of
// them wins, so the effect must follow a true return, never the read.
async function consume_one_time_token(table, id, now = new Date())
{
    const consumed = await db(table).where({id}).whereNull('used_at').update({used_at: now, updated_at: now});
    return consumed === 1;
}

module.exports = consume_one_time_token;
