const db = require('../../db');

const WRONG_CODES_MAX = 10;
const WINDOW_MS = 60*60*1000;

// Guesses at an address's codes are counted across codes, so a new code
// every minute does not bring five new guesses (AW-02). Every guess at a
// code still unused was wrong; the database counts them, across processes.
async function is_code_budget_spent(table, email_normalized, now = new Date())
{
    const [{wrong}] = await db(table)
        .where({email_normalized})
        .whereNull('used_at')
        .where('created_at', '>', new Date(now.getTime() - WINDOW_MS))
        .sum('attempts as wrong');
    return Number(wrong ?? 0) >= WRONG_CODES_MAX;
}

module.exports = is_code_budget_spent;
