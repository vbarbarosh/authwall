function oauth_intent_from_state(state)
{
    if (typeof state !== 'string') {
        throw new Error('Invalid OAuth state');
    }

    const i = state.indexOf('_');
    if (i === -1) {
        throw new Error('Invalid OAuth state');
    }

    return state.slice(0, i);
}

module.exports = oauth_intent_from_state;
