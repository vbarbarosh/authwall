const promisify = require('./promisify');

async function save_session(req)
{
    await promisify(v => req.session.save(v));
}

module.exports = save_session;
