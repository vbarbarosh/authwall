const crypto_hash_sha256 = require('@vbarbarosh/node-helpers/src/crypto_hash_sha256');
const db = require('../../db');
const is_unique_violation = require('./is_unique_violation');

const CONFIRMED_WINDOW_MS = 10*60*1000;

// Whether this request is the one that spends the session's confirmation. It
// lived in the session only, so two requests at the same moment could both
// spend it, two tokens from one approval (AW-107); the database lets one
// insert of its hash through.
async function claim_confirmation(req, now = new Date())
{
    const confirmation_hash = crypto_hash_sha256(`${req.session.uid} ${req.session.confirmed_at}`).toString('hex');
    await db('spent_confirmations').where('created_at', '<', new Date(now.getTime() - CONFIRMED_WINDOW_MS)).delete();
    try {
        await db('spent_confirmations').insert({confirmation_hash, created_at: now});
        return true;
    }
    catch (error) {
        if (is_unique_violation(error)) {
            return false;
        }
        throw error;
    }
}

module.exports = claim_confirmation;
