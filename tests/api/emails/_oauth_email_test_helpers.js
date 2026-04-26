const assert = require('assert');
const config = require('../../../config');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');
const random_uid_user_identity = require('../../../src/helpers/random/random_uid_user_identity');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

function configure_oauth_provider(provider)
{
    config.flows[provider].enabled = true;
    config.flows[provider].client_id = `mocha_${provider}_client_id`;
    config.flows[provider].client_secret = `mocha_${provider}_client_secret`;
    config.flows[provider].redirect_url = `mocha_${provider}_redirect_url`;
}

async function assert_oauth_connected_email(ctx, {provider, mock, expected})
{
    mock();

    await ctx.sign_in({email: 'mocha@authwall.test', password: 'pass123'});
    await ctx.client.get_json_no_redirects(`/auth/${provider}?connect=1`);
    const sess = await ctx.client.get_session();
    await ctx.http_get_json(urlmod(`/auth/${provider}/callback`, {
        state: sess.oauth_state,
        code: 'fake_code',
    }));
    await ctx.wait_for_emails(1);

    assert.deepStrictEqual(ctx.sent_emails.map(v => v.name), [expected]);
}

async function assert_oauth_disconnected_email(ctx, {provider, provider_user_id, expected})
{
    const {user_id} = await ctx.sign_in({email: 'mocha@authwall.test', password: 'pass123'});

    const now = new Date();
    await db('user_identities').insert({
        uid: random_uid_user_identity(),
        user_id,
        type: const_user_identity[`oauth_${provider}`],
        value: provider_user_id,
        value_normalized: provider_user_id,
        created_at: now,
        updated_at: now,
        verified_at: now,
    });

    await ctx.http_post_json(`/auth/${provider}/disconnect`);
    await ctx.wait_for_emails(1);

    assert.deepStrictEqual(ctx.sent_emails.map(v => v.name), [expected]);
}

module.exports = {
    assert_oauth_connected_email,
    assert_oauth_disconnected_email,
    configure_oauth_provider,
};
