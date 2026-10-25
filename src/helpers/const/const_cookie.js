// Authwall's session cookie, and its name before 1.17 (AW-19): the old name
// is no session of Authwall's any more, only something not to forward.
const const_cookie = {
    session: 'authwall.sid',
    legacy_session: 'connect.sid',
};

module.exports = const_cookie;
