const random_slug = require('./random/random_slug');

function oauth_state_from_intent(intent)
{
    return intent + '_' + random_slug();
}

module.exports = oauth_state_from_intent;
