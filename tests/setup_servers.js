const axios = require('axios');
const config = require('../config');
const cookie_signature = require('cookie-signature');
const create_app = require('../src/create_app');
const db = require('../db');
const http = require('http');
const make_mailer_fake = require('../src/services/mailer/make_mailer_fake');
const promisify = require('../src/helpers/promisify');
const services = require('../src/services');

function setup_servers()
{
    let trx;
    let server;
    let echo_server;

    beforeEach(async function () {

        this.sent_emails = [];
        services.mailer = make_mailer_fake(this.sent_emails);

        const db_internals = await db.__mocha__;
        trx = await db_internals.inst.transaction();
        db_internals.als.enterWith(trx);

        echo_server = await create_echo_server();
        await new Promise(resolve => echo_server.listen(0, '127.0.0.1', resolve));
        this.echo_url = `http://127.0.0.1:${echo_server.address().port}`;
        config.target_url = this.echo_url;

        const app = await create_app();
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        this.client = create_client(`http://127.0.0.1:${server.address().port}`, trx);
    });

    afterEach(async function () {
        await trx.rollback();
        await promisify(cb => server.close(cb));
        await promisify(cb => echo_server.close(cb));
    });

    after(async function () {
        // moved to tests/api/_mocha.setup.js
        // await db.destroy();
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
            res.end(JSON.stringify({method: req.method, url: req.url, body}));
        });
    });
}

function create_client(base_url, trx)
{
    const map = new Map();

    return {
        get_json(url) {
            return request('get', url);
        },
        post_json(url, data) {
            return request('post', url, data);
        },
        get_session() {
            return load_session();
        },
    };

    async function load_session() {
        const pair = map.get('connect.sid');
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

        const row = await trx('sessions').where({uid}).first();
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

    async function request(method, url, data) {
        let current_method = method;
        let current_url = url;
        let current_data = data;

        while (true) {
            const headers = {};

            if (map.size) {
                headers.Cookie = Array.from(map.values()).join('; ');
            }

            if (current_data) {
                headers['content-type'] = 'application/json';
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
                    map.set(name, pair);
                }
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

module.exports = setup_servers;
