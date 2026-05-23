function render_config_summary(config)
{
    return flat([
        '⚙️ Config summary',
        `🌐 Server: ${config.public_url} → ${config.listen}:${config.port} (${config.logger} logger)`,
        `🧭 Target: ${config.target.mode} → ${redact_url(config.target.url)}${format_headers(config)}`,
        `🗄️ Database: ${format_database(config.knexvars)}`,
        `🍪 Cookie: domain=${config.cookie.domain ?? ''} path=${config.cookie.path} same_site=${config.cookie.same_site} secure=${config.cookie.secure} max_age_days=${config.cookie.max_age_days}`,
        `🧯 Sentry: ${format_sentry(config.sentry)}`,
        '🔐 Sign-in:',
        format_flows(config.flows).map(v => `  ${v}`),
        `📭 Mailer: ${format_mailer(config.mailer)}`,
        `🪪 Access: ${format_access_summary(config.access)}`,
        format_access(config.access).map(v => `  ${v}`),
        "🚪 Public paths (" + config.public_paths.length + "):",
        format_public_paths(config.public_paths).map(v => `  ${v}`),
        '👤 Seed users:',
        format_seed_users(config.seed_users).map(v => `  ${v}`),
        `🗂️ Storage: logs=${config.logs_dir}, uploads=${config.uploads_dir}`,
    ]).map(v => `[config] ${v}`);
}

function flat(items)
{
    return items.flatMap(v => Array.isArray(v) ? v : [v]);
}

function format_sentry(sentry)
{
    if (!sentry.enabled) {
        return 'disabled';
    }

    const parts = ['enabled'];
    if (sentry.environment) {
        parts.push(`environment=${sentry.environment}`);
    }
    parts.push(`traces=${sentry.traces_sample_rate ?? 'off'}`);
    return parts.join(' ');
}

function format_headers(config)
{
    const set = config.target.set_headers.map(v => v.name);
    const unset = config.target.unset_headers;
    const parts = [];
    if (set.length) {
        parts.push(`set ${set.join(', ')}`);
    }
    if (unset.length) {
        parts.push(`unset ${unset.join(', ')}`);
    }
    return parts.length ? ` (${parts.join('; ')})` : '';
}

function format_database(knexvars)
{
    const label = knexvars.custom?.label || knexvars.custom?.name || knexvars.client;
    const connection = knexvars.connection;
    if (typeof connection === 'string') {
        return `${label} ${redact_url(connection)}`;
    }
    if (connection?.uri) {
        return `${label} ${redact_url(connection.uri)}`;
    }
    if (connection?.filename) {
        return `${label} ${connection.filename}`;
    }
    return label;
}

function format_flows(flows)
{
    const out = [];

    if (flows.password.enabled) {
        const modes = [];
        if (flows.password.allow_username) {
            modes.push('username');
        }
        if (flows.password.allow_email) {
            modes.push('email');
        }
        out.push(`- password: ${modes.join('+') || 'disabled'}, min ${flows.password.min_password_length}`);
    }
    if (flows.magic_link.enabled) {
        out.push(`- magic link: ${flows.magic_link.mode}`);
    }
    if (flows.google.enabled) {
        out.push(`- Google OAuth${flows.google.redirect_url ? `: ${flows.google.redirect_url}` : ''}`);
    }
    if (flows.github.enabled) {
        out.push(`- GitHub OAuth${flows.github.redirect_url ? `: ${flows.github.redirect_url}` : ''}`);
    }
    if (flows.microsoft.enabled) {
        out.push(`- Microsoft OAuth${flows.microsoft.redirect_url ? `: ${flows.microsoft.redirect_url}` : ''}`);
    }
    if (flows.facebook.enabled) {
        out.push(`- Facebook OAuth${flows.facebook.redirect_url ? `: ${flows.facebook.redirect_url}` : ''}`);
    }
    if (flows.twitter.enabled) {
        out.push(`- X OAuth${flows.twitter.redirect_url ? `: ${flows.twitter.redirect_url}` : ''}`);
    }
    if (flows.discord.enabled) {
        out.push(`- Discord OAuth${flows.discord.redirect_url ? `: ${flows.discord.redirect_url}` : ''}`);
    }

    return out.length ? out : ['- none'];
}

function format_mailer(mailer)
{
    if (!mailer.enabled) {
        return 'disabled';
    }
    if (mailer.provider === 'resend') {
        return `Resend from ${mailer.resend.from}`;
    }
    if (mailer.provider === 'mailjet') {
        return `Mailjet from ${mailer.mailjet.from}`;
    }
    if (mailer.provider === 'ses') {
        return `SES ${mailer.ses.region} from ${mailer.ses.from}`;
    }
    return mailer.provider;
}

function format_access_summary(access)
{
    const has_denylist = access.denied_emails.length || access.denied_domains.length;
    const allow = [];
    if (access.allowed_emails.length) {
        allow.push('listed emails');
    }
    if (access.allowed_domains.length) {
        allow.push('listed domains');
    }

    if (allow.length && has_denylist) {
        return `only ${join_words(allow)} can sign in; denylist also applies`;
    }
    if (allow.length) {
        return `only ${join_words(allow)} can sign in`;
    }
    if (has_denylist) {
        return 'any email can sign in except denied entries';
    }
    return 'open to any email';
}

function join_words(values)
{
    return values.length === 1 ? values[0] : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

function format_access(access)
{
    return [
        `- allowed emails: ${format_list(access.allowed_emails)}`,
        `- allowed domains: ${format_list(access.allowed_domains)}`,
        `- denied emails: ${format_list(access.denied_emails)}`,
        `- denied domains: ${format_list(access.denied_domains)}`,
    ];
}

function format_list(values)
{
    return values.length ? values.join(', ') : 'none';
}

function format_public_paths(paths)
{
    return paths.length ? paths.map(v => `- ${v}`) : ['- none'];
}

function format_seed_users(users)
{
    return users.length ? users.map(format_seed_user) : ['- none'];
}

function format_seed_user(user, i)
{
    return `- ${user.username || user.email || `user ${i + 1}`}`;
}

function redact_url(value)
{
    try {
        const url = new URL(value);
        if (url.password) {
            url.password = '***';
        }
        return url.toString();
    }
    catch {
        return value;
    }
}

module.exports = render_config_summary;
