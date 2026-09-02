const proxyaddr = require('proxy-addr');

// Compiles a `trust proxy` setting into a trust function, mirroring Express's
// own compileTrust so the HTTP path (req.ip) and the WebSocket-upgrade path
// (which has no Express req) resolve the client address identically. Express
// accepts a function for `trust proxy`, so the one compiled here is handed to
// both app.set('trust proxy', fn) and proxyaddr(upgrade_req, fn).
function compile_trust_proxy(val)
{
    if (typeof val === 'function') {
        return val;
    }
    if (val === true) {
        return () => true;
    }
    if (typeof val === 'number') {
        return (addr, i) => i < val;
    }
    if (typeof val === 'string') {
        val = val.split(/ *, */);
    }
    return proxyaddr.compile(Array.isArray(val) ? val : []);
}

module.exports = compile_trust_proxy;
