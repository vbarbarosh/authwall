function normalize_ip(ip)
{
    return ip.replace(/^::ffff:/, '');
}

module.exports = normalize_ip;
