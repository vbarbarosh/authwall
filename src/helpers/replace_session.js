const promisify = require('./promisify');
const normalize_ip = require('./normalize/normalize_ip');
const random_base62 = require('./random/random_base62');

async function replace_session(req, user)
{
    await promisify(v => req.session.regenerate(v));
    req.session.user_id = user.id;
    req.session.user_uid = user.uid;
    req.session.ip = normalize_ip(req.ip);
    req.session.ua = req.headers['user-agent'] ?? 'n/a';
    req.session.csrf_token = random_base62();
    await promisify(v => req.session.save(v));
}

module.exports = replace_session;
