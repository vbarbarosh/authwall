const account_email_refusal = require('./account_email_refusal');

// Why the access rules refuse an account's sessions and tokens, or null when
// they admit it (AW-80). An account the rules came to refuse is refused at
// every door, and nothing it holds is deleted: once the rule is lifted, its
// sessions and tokens work again. The answer is the one a sign-in gets
// (AW-106), asked each time: it turns on the account's addresses and
// providers as well as on the rules, and those change on any replica.
async function account_access_refusal(user_id)
{
    return account_email_refusal({id: user_id});
}

module.exports = account_access_refusal;
