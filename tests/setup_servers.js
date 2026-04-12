const als = require('../src/helpers/als');
const axios = require('axios');
const config = require('../config');
const const_user_identity = require('../src/helpers/const/const_user_identity');
const cookie_signature = require('cookie-signature');
const create_app = require('../src/create_app');
const db = require('../db');
const fs = require('fs/promises');
const http = require('http');
const normalize_email = require('../src/helpers/normalize/normalize_email');
const normalize_username = require('../src/helpers/normalize/normalize_username');
const promisify = require('../src/helpers/promisify');
const random_uid_user_identity = require('../src/helpers/random/random_uid_user_identity');
const users_create = require('../src/helpers/models/users_create');

async function spin(ctx, _this, fn)
{
    await als.run(ctx, async function () {

        const echo_server = await create_echo_server();
        await promisify(cb => echo_server.listen(0, '127.0.0.1', cb));
        config.target_url = `http://127.0.0.1:${echo_server.address().port}`;

        config.cookie.domain = _this._runnable.title.includes('[config.cookie.domain=.authwall.test]') ? '.authwall.test' : null;
        config.cookie.secure = _this._runnable.title.includes('[config.cookie.secure=true]');

        const app = await create_app();
        const server = http.createServer(app);
        await promisify(cb => server.listen(0, '127.0.0.1', cb));
        config.public_url = `http://127.0.0.1:${server.address().port}`;

        _this.client = create_client(config.public_url);
        _this.add_user = add_user;
        _this.sign_in = sign_in;

        try {
            await fn();
        }
        finally {
            await promisify(cb => server.close(cb));
            await promisify(cb => echo_server.close(cb));
        }
    });
}

async function create_echo_server()
{
    return http.createServer(function (req, res) {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const body = Buffer.concat(chunks).toString();
            res.writeHead(200, {'content-type': 'application/json'});
            res.end(JSON.stringify({echo_server: 'grep_aich7deHie7eej2woic3', method: req.method, url: req.url, body}));
        });
    });
}

function create_client(base_url)
{
    return {
        cookies: new Map(),
        get_json(url) {
            return request(this.cookies, 'get', url);
        },
        get_json_no_redirects(url) {
            return request(this.cookies, 'get', url, null, true);
        },
        get_json_no_redirects_no_https(url) {
            return request(this.cookies, 'get', url, null, true, false);
        },
        post_json(url, data) {
            return request(this.cookies, 'post', url, data);
        },
        post_json_no_redirects(url, data) {
            return request(this.cookies, 'post', url, data, true);
        },
        async post_multipart(url, data) {
            const form = new FormData();
            for (const [key, value] of Object.entries(data || {})) {
                await append_form_value(form, key, value);
            }
            return request(this.cookies, 'post', url, form);
        },
        get_session() {
            return load_session(this.cookies);
        },
    };

    async function load_session(cookies) {
        const pair = cookies.get('connect.sid');
        if (!pair) {
            return null;
        }

        const signed = decodeURIComponent(pair.slice('connect.sid='.length));
        if (!signed.startsWith('s:')) {
            throw new Error('Invalid session cookie');
        }

        const uid = cookie_signature.unsign(signed.slice(2), config.secrets.express_session);
        if (!uid) {
            throw new Error('Invalid session signature');
        }

        const row = await db('sessions').where({uid}).first();
        if (!row) {
            return null;
        }

        return {
            uid: row.uid,
            user_id: row.user_id,
            user_uid: row.user_uid,
            ip: row.ip,
            ua: row.ua,
            ...JSON.parse(row.custom),
        };
    }

    async function request(cookies, method, url, data, no_redirects = false, simulate_https = true) {
        let current_method = method;
        let current_url = url;
        let current_data = data;

        while (true) {
            const headers = {};

            if (cookies.size) {
                headers.Cookie = Array.from(cookies.values()).join('; ');
            }

            if (current_data && !(current_data instanceof FormData)) {
                headers['content-type'] = 'application/json';
            }

            if (config.cookie.secure && simulate_https) {
                // make Express think the request is HTTPS
                headers['X-Forwarded-Proto'] = 'https';
            }

            const res = await axios({
                method: current_method,
                url: current_url,
                baseURL: base_url,
                data: current_data,
                headers,
                maxRedirects: 0,
                validateStatus: v => v < 400,
            });
            const set_cookie = res.headers['set-cookie'];

            if (set_cookie) {
                for (const c of set_cookie) {
                    const [pair] = c.split(';');
                    const [name] = pair.split('=');
                    cookies.set(name, pair);
                }
            }

            if (no_redirects) {
                return res;
            }

            if (res.status >= 300 && res.status < 400 && res.headers.location) {
                current_method = 'get';
                current_url = res.headers.location;
                current_data = undefined;
                continue;
            }

            return res.data;
        }
    }
}

async function append_form_value(form, key, value)
{
    if (value === undefined) {
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            await append_form_value(form, key, item);
        }
        return;
    }

    if (value instanceof Blob || value instanceof File) {
        form.append(key, value);
        return;
    }

    if (Buffer.isBuffer(value)) {
        form.append(key, new Blob([value]), 'upload.bin');
        return;
    }

    if (value && typeof value === 'object') {
        const filename = value.filename ?? value.name ?? 'upload.bin';
        const contentType = value.contentType ?? value.type ?? 'application/octet-stream';

        if ('path' in value) {
            const buffer = await fs.readFile(value.path);
            form.append(key, new Blob([buffer], {type: contentType}), filename);
            return;
        }

        const content = value.buffer ?? value.contents ?? value.content ?? value.value;
        if (content !== undefined && (Buffer.isBuffer(content) || typeof content === 'string')) {
            form.append(key, new Blob([content], {type: contentType}), filename);
            return;
        }
    }

    form.append(key, String(value));
}

async function add_user(params = {})
{
    const verified = Boolean(params.verified ?? true);
    const password = params.password ?? null;

    const username = params.username ?? null;
    const username_normalized = normalize_username(username);

    const email = params.email ?? null;
    const email_normalized = normalize_email(email);

    const user = await users_create({password});
    const now = new Date();
    const base = {user_id: user.id, created_at: now, updated_at: now, verified_at: now};
    const rows = [];
    if (username_normalized) {
        rows.push({...base, uid: random_uid_user_identity(), type: const_user_identity.username, value: username, value_normalized: username_normalized});
    }
    if (email_normalized) {
        rows.push({...base, uid: random_uid_user_identity(), type: const_user_identity.email, value: email, value_normalized: email_normalized, verified_at: (verified ? now : null)});
    }
    await db('user_identities').insert(rows);

    return {email, username, password};
}

async function sign_in(params)
{
    const {username, email, password} = await add_user(params);

    const status = await this.client.get_json('/auth/status');
    await this.client.post_json('/auth/sign-in', {username: username ?? email, password, _csrf: status.csrf_token});
}

module.exports = {
    spin,
};
