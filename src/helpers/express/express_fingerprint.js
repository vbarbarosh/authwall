function express_fingerprint(req)
{
    const ip = req.socket.remoteAddress;
    const forwarded = req.headers['x-forwarded-for'] ?? 'n/a';
    const country = req.headers['cf-ipcountry'] ?? 'n/a';
    const ua = req.headers['user-agent'] ?? 'n/a';
    return `[ip=${ip}][forwarded=${forwarded}][country=${country}][ua=${ua}]`;
}

module.exports = express_fingerprint;
