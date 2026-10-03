const compile_trust_proxy = require('../compile_trust_proxy');

// Parses AUTHWALL_TRUST_PROXY into a value Express's `trust proxy` accepts.
// Four forms, each saying what is trusted: `none`, `hops/N` (that many
// proxies in front), a comma list of addresses, subnets and presets, or
// `any`. Unset is `hops/1`, Authwall behind a single reverse proxy.
function parse_trust_proxy(value)
{
    const s = String(value ?? '').trim();
    if (s === '') {
        return 1;
    }
    const word = s.toLowerCase();
    if (word === 'none') {
        return false;
    }
    if (word === 'any') {
        return true;
    }
    const hops = /^hops\/(\d+)$/.exec(word);
    if (hops) {
        if (Number(hops[1]) === 0) {
            throw new Error(`AUTHWALL_TRUST_PROXY=${s} is written none`);
        }
        return Number(hops[1]);
    }
    const replacement = old_value_replacement(word);
    if (replacement) {
        throw new Error(`AUTHWALL_TRUST_PROXY=${s} is now written ${replacement}`);
    }
    for (const entry of s.split(/\s*,\s*/)) {
        if (/^(none|any|hops\/\d+)$/i.test(entry)) {
            throw new Error(`AUTHWALL_TRUST_PROXY: ${entry} stands alone, not in a list`);
        }
        try {
            compile_trust_proxy([entry]);
        }
        catch (error) {
            throw new Error(`AUTHWALL_TRUST_PROXY: ${JSON.stringify(entry)} is not an address, a subnet or a preset (loopback, linklocal, uniquelocal)`);
        }
    }
    return s;
}

// The values of the earlier boolean-and-number form, and how they are written now.
function old_value_replacement(word)
{
    if (word === 'true') {
        return 'any';
    }
    if (word === 'false' || /^0+$/.test(word)) {
        return 'none';
    }
    if (/^\d+$/.test(word)) {
        return `hops/${Number(word)}`;
    }
    return null;
}

module.exports = parse_trust_proxy;
