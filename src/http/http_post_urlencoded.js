const axios = require('axios');
const qs = require('querystring');

function http_post_urlencoded(url, body, options)
{
    // axios has no timeout by default; a peer that never answers must not hold the request open forever
    return axios.post(url, qs.stringify(body), {timeout: 15*1000, ...options}).then(v => v.data);
}

module.exports = http_post_urlencoded;
