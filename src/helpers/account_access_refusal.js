const account_email_refusal = require('./account_email_refusal');
const config = require('../../config');
const has_email_access_rules = require('./has_email_access_rules');

const answers = new Map();
let answers_rules = null;

// Why the access rules refuse an account's sessions and tokens, or null when
// they admit it (AW-80). An account the rules came to refuse is refused at
// every door, and nothing it holds is deleted: once the rule is lifted, its
// sessions and tokens work again. The rules are read at startup and every
// address is checked against them before it joins an account, so the answer
// for an account holds while the rules do: it is asked once and kept, the
// proxied path pays for it once per account.
async function account_access_refusal(user_id)
{
    if (!has_email_access_rules()) {
        return null;
    }

    const rules = JSON.stringify(config.access);
    if (rules !== answers_rules) {
        answers.clear();
        answers_rules = rules;
    }
    if (!answers.has(user_id)) {
        answers.set(user_id, await account_email_refusal({id: user_id}));
    }
    return answers.get(user_id);
}

module.exports = account_access_refusal;
