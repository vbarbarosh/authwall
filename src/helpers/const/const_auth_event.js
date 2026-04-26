const const_auth_event = {
    sign_in: 'sign_in',
    sign_out: 'sign_out',
    sign_up: 'sign_up',
    account_removed: 'account_removed',
    profile_updated: 'profile_updated',
    avatar_updated: 'avatar_updated',
    identity_added: 'identity_added',
    identity_removed: 'identity_removed',
    password_changed: 'password_changed',
    password_reset_requested: 'password_reset_requested',
    password_reset_completed: 'password_reset_completed',
    email_verification_requested: 'email_verification_requested',
    email_verified: 'email_verified',
    email_change_requested: 'email_change_requested',
    email_changed: 'email_changed',
    session_revoked: 'session_revoked',
    session_revoked_all: 'session_revoked_all',
};

module.exports = const_auth_event;
