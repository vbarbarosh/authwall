const promisify = require('./promisify');

async function destroy_session(req)
{
    await promisify(v => req.session.destroy(v));
}

module.exports = destroy_session;
