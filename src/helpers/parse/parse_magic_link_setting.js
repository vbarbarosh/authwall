const DEFAULT_MODE = 'link_and_code';
const DISABLED_VALUES = new Set(['off', 'disabled']);
const MODES = new Set(['link', 'code', 'link_and_code']);

function parse_magic_link_setting(value, {mailer_enabled, warn = console.warn} = {})
{
    const normalized = String(value ?? 'auto').trim().toLowerCase();

    if (normalized === 'auto') {
        return {
            enabled: !!mailer_enabled,
            mode: DEFAULT_MODE,
        };
    }

    if (DISABLED_VALUES.has(normalized)) {
        return {
            enabled: false,
            mode: DEFAULT_MODE,
        };
    }

    if (MODES.has(normalized)) {
        if (!mailer_enabled) {
            throw new Error(`AUTHWALL_MAGIC_LINK=${normalized} requires a configured mailer`);
        }
        return {
            enabled: true,
            mode: normalized,
        };
    }

    warn(`⚠️ Magic link disabled: AUTHWALL_MAGIC_LINK must be one of auto, off, disabled, link, code, link_and_code; got ${JSON.stringify(value)}`);
    return {
        enabled: false,
        mode: DEFAULT_MODE,
    };
}

module.exports = parse_magic_link_setting;
