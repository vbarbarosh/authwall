function frontend_sessions(sessions)
{
    return sessions.map(function (session) {
        return {
            uid: session.uid,
            ip: session.ip,
            ua: session.ua,
            created_at: session.created_at && new Date(session.created_at).toJSON(),
            expires_at: session.expires_at && new Date(session.expires_at).toJSON(),
            last_seen_at: session.last_seen_at && new Date(session.last_seen_at).toJSON(),
        };
    });
}

module.exports = frontend_sessions;
