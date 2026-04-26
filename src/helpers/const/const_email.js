const const_email = {
    welcome: 'welcome',
    welcome_and_confirm_email: 'welcome_and_confirm_email',

    magic_link: 'magic_link',
    magic_link_without_code: 'magic_link_without_code',
    magic_link_without_link: 'magic_link_without_link',
    password_reset: 'password_reset',

    confirm_email: 'confirm_email',
    email_change_requested: 'email_change_requested',
    email_changed: 'email_changed', // sent to old email: "your email is being changed"

    // notifications
    new_sign_in: 'new_sign_in',
    google_connected: 'google_connected',
    google_disconnected: 'google_disconnected',
    github_connected: 'github_connected',
    github_disconnected: 'github_disconnected',
    microsoft_connected: 'microsoft_connected',
    microsoft_disconnected: 'microsoft_disconnected',
    facebook_connected: 'facebook_connected',
    facebook_disconnected: 'facebook_disconnected',
    twitter_connected: 'twitter_connected',
    twitter_disconnected: 'twitter_disconnected',
    password_changed_from_profile: 'password_changed_from_profile',
    password_changed_via_reset_link: 'password_changed_via_reset_link',
};

module.exports = const_email;
