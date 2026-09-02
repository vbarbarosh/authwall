// Parses AUTHWALL_TRUST_PROXY into a value Express's `trust proxy` accepts.
// The default is 1: the documented topology is Authwall behind a single
// reverse proxy or load balancer that overwrites X-Forwarded-For, so exactly
// one hop is trusted. Set the number of proxies in front, `false` for a
// directly exposed instance, or a comma list of trusted IPs/subnets/presets.
function parse_trust_proxy(value)
{
    if (value === undefined || value === null || value === '') {
        return 1;
    }
    const s = String(value).trim();
    if (s.toLowerCase() === 'true') {
        return true;
    }
    if (s.toLowerCase() === 'false') {
        return false;
    }
    if (/^\d+$/.test(s)) {
        return Number(s);
    }
    return s;
}

module.exports = parse_trust_proxy;
