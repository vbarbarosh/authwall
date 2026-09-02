const axios = require('axios');

function http_post_json(url, body, options)
{
    const headers = {
        Accept: 'application/json',
        ...options?.headers,
    };

    // axios has no timeout by default; a peer that never answers must not hold the request open forever
    return axios.post(url, body, {timeout: 15*1000, ...options, headers}).then(v => v.data);
}

module.exports = http_post_json;
