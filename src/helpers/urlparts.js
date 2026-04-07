function urlparts(url)
{
    const tmp_url = new URL(url||'', 'fake://fake/');
    return {
        protocol: tmp_url.protocol,
        host: tmp_url.host,
        port: tmp_url.port,
        path: tmp_url.pathname,
        search: tmp_url.search,
    };
}

module.exports = urlparts;
