const db = require('../../db');

// Spends one guess against a bounded counter in a single statement, and says
// whether there was one left to spend. A burst of concurrent guesses that
// each read the same count would otherwise each be allowed one more; here
// the database does the counting, so the cap holds however many arrive.
async function spend_attempt(table, id, max_attempts, now = new Date())
{
    const spent = await db(table)
        .where({id})
        .where('attempts', '<', max_attempts)
        .update({attempts: db.raw('attempts + 1'), updated_at: now});
    return spent === 1;
}

module.exports = spend_attempt;
