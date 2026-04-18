const config = require('../../../config');
const crypto = require('crypto');
const http_post_json = require('../../http/http_post_json');
const ignore = require('@vbarbarosh/node-helpers/src/ignore');

function make_mailer_ses({now = () => new Date()} = {})
{
    return {
        send: async function ({to, subject, text}) {
            const endpoint = `https://email.${config.mailer.ses.region}.amazonaws.com/v2/email/outbound-emails`;
            const body = JSON.stringify({
                FromEmailAddress: config.mailer.ses.from,
                Destination: {
                    ToAddresses: parse_ses_recipients(to),
                },
                Content: {
                    Simple: {
                        Subject: {
                            Charset: 'UTF-8',
                            Data: subject,
                        },
                        Body: {
                            Text: {
                                Charset: 'UTF-8',
                                Data: text,
                            },
                        },
                    },
                },
            });
            const headers = sign_ses_request({
                method: 'POST',
                url: endpoint,
                body,
                region: config.mailer.ses.region,
                key: config.mailer.ses.key,
                secret: config.mailer.ses.secret,
                session_token: config.mailer.ses.session_token,
                now: now(),
            });
            const out = await http_post_json(endpoint, JSON.parse(body), {headers}).catch(throw_ses_error);
            if (!out?.MessageId) {
                throw new Error(`Email delivery failed: Invalid SES response\n\n${JSON.stringify(out)}`);
            }
            return out;
        },
        [Symbol.dispose]: ignore,
    };
}

function parse_ses_recipients(input)
{
    return split_email_addresses(input).map(extract_email_address);
}

function split_email_addresses(input)
{
    if (typeof input !== 'string' || !input.trim()) {
        throw new Error('Missing email input');
    }

    const out = [];
    let quote = false;
    let angle = 0;
    let start = 0;

    for (let i = 0; i < input.length; ++i) {
        const char = input[i];
        if (char === '"' && input[i - 1] !== '\\') {
            quote = !quote;
        }
        else if (!quote && char === '<') {
            angle++;
        }
        else if (!quote && char === '>') {
            angle = Math.max(0, angle - 1);
        }
        else if (!quote && !angle && char === ',') {
            const part = input.slice(start, i).trim();
            if (part) {
                out.push(part);
            }
            start = i + 1;
        }
    }

    const tail = input.slice(start).trim();
    if (tail) {
        out.push(tail);
    }

    return out;
}

function extract_email_address(input)
{
    const value = input.trim();
    const match = value.match(/<(.*)>$/);
    return match ? match[1].trim() : value;
}

function sign_ses_request({method, url, body, region, key, secret, session_token, now})
{
    const service = 'ses';
    const parsed = new URL(url);
    const amz_date = format_amz_date(now);
    const date_stamp = amz_date.slice(0, 8);
    const payload_hash = sha256_hex(body);
    const headers = {
        host: parsed.host,
        'content-type': 'application/json',
        'x-amz-content-sha256': payload_hash,
        'x-amz-date': amz_date,
    };

    if (session_token) {
        headers['x-amz-security-token'] = session_token;
    }

    const canonical_headers = Object.keys(headers).sort().map(k => `${k}:${canonicalize_header_value(headers[k])}\n`).join('');
    const signed_headers = Object.keys(headers).sort().join(';');
    const canonical_request = [
        method,
        parsed.pathname,
        '',
        canonical_headers,
        signed_headers,
        payload_hash,
    ].join('\n');
    const credential_scope = `${date_stamp}/${region}/${service}/aws4_request`;
    const string_to_sign = [
        'AWS4-HMAC-SHA256',
        amz_date,
        credential_scope,
        sha256_hex(canonical_request),
    ].join('\n');

    const signing_key = get_signature_key(secret, date_stamp, region, service);
    const signature = crypto.createHmac('sha256', signing_key).update(string_to_sign, 'utf8').digest('hex');
    return {
        ...headers,
        Authorization: `AWS4-HMAC-SHA256 Credential=${key}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}`,
    };
}

function canonicalize_header_value(input)
{
    return String(input).trim().replace(/\s+/g, ' ');
}

function get_signature_key(secret, date_stamp, region, service)
{
    const k_date = crypto.createHmac('sha256', `AWS4${secret}`).update(date_stamp, 'utf8').digest();
    const k_region = crypto.createHmac('sha256', k_date).update(region, 'utf8').digest();
    const k_service = crypto.createHmac('sha256', k_region).update(service, 'utf8').digest();
    return crypto.createHmac('sha256', k_service).update('aws4_request', 'utf8').digest();
}

function sha256_hex(input)
{
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function format_amz_date(date)
{
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:-]/g, '');
}

function throw_ses_error(error)
{
    const response = error.response?.data;
    const type = response?.__type || response?.Code || response?.code;
    const message = response?.message || response?.Message || error.message;
    throw new Error(`Email delivery failed: ${type ? `${type}: ` : ''}${message}\n\n${JSON.stringify(response ?? {message: error.message})}`, {cause: error});
}

module.exports = make_mailer_ses;
