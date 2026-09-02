const axios = require('axios');

function http_get_json(url, options)
{
    // axios has no timeout by default; a peer that never answers must not hold the request open forever
    return axios.get(url, {responseType: 'json', timeout: 15*1000, ...options}).then(v => v.data);
}

module.exports = http_get_json;
