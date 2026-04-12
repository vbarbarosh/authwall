const axios = require('axios');

function http_post_json(url, body, options)
{
    const headers = {
        Accept: 'application/json',
        ...options?.headers,
    };

    return axios.post(url, body, {...options, headers}).then(v => v.data);
}

module.exports = http_post_json;
