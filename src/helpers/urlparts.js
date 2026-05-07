function urlparts(url)
{
    const tmp = url instanceof URL
        ? url
        : new URL((typeof url === 'string' ? url : ''), 'fake://fake/');
    return {
        href: tmp.href,
        protocol: tmp.protocol,
        hostname: tmp.hostname,
        username: tmp.username,
        password: tmp.password,
        host: tmp.host,
        port: tmp.port,
        path: tmp.pathname,
        search: tmp.search,
        hash: tmp.hash,
    };
}

module.exports = urlparts;
