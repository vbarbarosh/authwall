const assert = require('assert');
const const_user_identity = require('../../../src/helpers/const/const_user_identity');
const db = require('../../../db');

// A failing query (a locked database, a lost connection, a broken constraint)
// rejects with an error whose message knex builds from the query. That error
// reaches the log, where error_handler writes its stack, and Sentry, where its
// message is the exception's value. The values bound to the query are a
// session id, its CSRF token, the client's IP, an e-mail or a password hash:
// the message names the query and the database's reason, never the values.
describe('a failing query | security', function () {

    it('keeps a session row\'s values out of the error of a failing insert', async function () {
        const now = new Date();
        const row = {
            uid: 'awsess_query_error_session_uid',
            ip: '10.89.0.4',
            ua: 'curl/8.18.0',
            custom: JSON.stringify({csrf_token: 'query-error-csrf-token'}),
            created_at: now,
            updated_at: now,
            expires_at: now,
            last_seen_at: null,
        };
        const error = await query_error_catch(() => db('sessions').insert(row));
        assert.match(error.message, /^insert into .sessions. .* - .*last_seen_at/);
        assert_no_values(error, ['awsess_query_error_session_uid', '10.89.0.4', 'curl/8.18.0', 'query-error-csrf-token']);
    });

    // A column that does not exist stands in for any failure of the lookup.
    it('keeps an e-mail out of the error of a failing lookup', async function () {
        const error = await query_error_catch(() => db('user_identities').where({type: const_user_identity.email, value_normalized: 'query-error@authwall.test'}).whereNotNull('no_such_column').first());
        assert.match(error.message, /^select .* - .*no_such_column/);
        assert_no_values(error, ['query-error@authwall.test']);
    });

});

// In a savepoint: on PostgreSQL a failed statement aborts the whole transaction.
async function query_error_catch(fn)
{
    try {
        await db.transaction(fn);
    }
    catch (error) {
        return error;
    }
    assert.fail('the query did not fail');
}

// error_handler logs the stack; Sentry sends the message as the exception's value.
function assert_no_values(error, values)
{
    for (const value of values) {
        assert.strictEqual(error.message.includes(value), false, `the message carries ${value}: ${error.message}`);
        assert.strictEqual(error.stack.includes(value), false, `the stack carries ${value}`);
    }
}
