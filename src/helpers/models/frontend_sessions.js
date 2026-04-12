function frontend_sessions(sessions)
{
    return sessions.map(function (session) {
        return {
            uid: session.uid,
            ip: session.ip,
            ua: session.ua,
            created_at: session.created_at,
            expires_at: session.expires_at,
            last_seen_at: session.last_seen_at,
        };
    });
}

module.exports = frontend_sessions;
