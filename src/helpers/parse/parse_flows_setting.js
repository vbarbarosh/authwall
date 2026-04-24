const ALLOWED = new Set([
    'username',
    'email',
    'magic_link',
    'magic_code',
    'magic_link_and_code',
    'google',
    'github',
]);

function parse_flows_setting(value, {
    password_enabled = true,
    username_enabled = true,
    email_enabled = true,
    magic_link_enabled = true,
    magic_link_mode = 'link_and_code',
    mailer_enabled = false,
    google_enabled = false,
    github_enabled = false,
} = {})
{
    const normalized = String(value ?? 'auto').trim().toLowerCase();
    if (!normalized || normalized === 'auto') {
        return auto({password_enabled, username_enabled, email_enabled, magic_link_enabled, magic_link_mode, mailer_enabled, google_enabled, github_enabled});
    }

    const requested = normalized.split(',').map(v => v.trim()).filter(Boolean);
    const invalid = requested.filter(v => !ALLOWED.has(v));
    if (!requested.length) {
        throw new Error(`AUTHWALL_FLOWS contains no supported values: ${JSON.stringify(value)}`);
    }
    if (invalid.length) {
        throw new Error(`AUTHWALL_FLOWS contains unsupported value(s): ${invalid.join(', ')}`);
    }

    const needs_mailer = requested.some(v => v === 'email' || v.startsWith('magic_'));
    if (needs_mailer && !mailer_enabled) {
        throw new Error('AUTHWALL_FLOWS requires a configured mailer when email or magic-link flows are enabled');
    }
    if ((requested.includes('username') || requested.includes('email')) && !password_enabled) {
        throw new Error('AUTHWALL_FLOWS requested password flow, but flows.password.enabled=false');
    }
    if (requested.includes('username') && !username_enabled) {
        throw new Error('AUTHWALL_FLOWS=username requires flows.password.allow_username=true');
    }
    if (requested.includes('email') && !email_enabled) {
        throw new Error('AUTHWALL_FLOWS=email requires flows.password.allow_email=true');
    }
    if (requested.some(v => v.startsWith('magic_')) && !magic_link_enabled) {
        throw new Error('AUTHWALL_FLOWS requested magic-link flow, but flows.magic_link.enabled=false');
    }
    if (requested.includes('google') && !google_enabled) {
        throw new Error('AUTHWALL_FLOWS=google requires configured Google OAuth');
    }
    if (requested.includes('github') && !github_enabled) {
        throw new Error('AUTHWALL_FLOWS=github requires configured GitHub OAuth');
    }

    const magic_link = requested.includes('magic_link') || requested.includes('magic_link_and_code');
    const magic_code = requested.includes('magic_code') || requested.includes('magic_link_and_code');
    const magic_enabled = magic_link || magic_code;
    const configured_magic_link = magic_link_mode === 'link' || magic_link_mode === 'link_and_code';
    const configured_magic_code = magic_link_mode === 'code' || magic_link_mode === 'link_and_code';
    if (magic_link && !configured_magic_link) {
        throw new Error(`AUTHWALL_FLOWS requested magic link, but configured magic-link mode is ${magic_link_mode}`);
    }
    if (magic_code && !configured_magic_code) {
        throw new Error(`AUTHWALL_FLOWS requested magic code, but configured magic-link mode is ${magic_link_mode}`);
    }

    return {
        password: {
            enabled: requested.includes('username') || requested.includes('email'),
            allow_username: requested.includes('username'),
            allow_email: requested.includes('email'),
        },
        magic_link: {
            enabled: magic_enabled,
            mode: !magic_enabled ? 'link_and_code' : magic_link && magic_code ? 'link_and_code' : magic_link ? 'link' : 'code',
        },
        google: {
            enabled: requested.includes('google'),
        },
        github: {
            enabled: requested.includes('github'),
        },
    };
}

function auto({password_enabled, username_enabled, email_enabled, magic_link_enabled, magic_link_mode, mailer_enabled, google_enabled, github_enabled})
{
    const oauth_enabled = google_enabled || github_enabled;

    return {
        password: {
            enabled: !oauth_enabled && !!password_enabled && (!!username_enabled || (!!email_enabled && !!mailer_enabled)),
            allow_username: !oauth_enabled && !!password_enabled && !!username_enabled,
            allow_email: !oauth_enabled && !!password_enabled && !!email_enabled && !!mailer_enabled,
        },
        magic_link: {
            enabled: !oauth_enabled && !!magic_link_enabled && !!mailer_enabled,
            mode: magic_link_mode,
        },
        google: {
            enabled: !!google_enabled,
        },
        github: {
            enabled: !!github_enabled,
        },
    };
}

module.exports = parse_flows_setting;
