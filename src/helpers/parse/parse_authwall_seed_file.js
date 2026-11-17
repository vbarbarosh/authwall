const fs = require('fs');
const {parse} = require('csv-parse/sync');

const FIELDS = ['username', 'emails', 'display_name', 'password_hash'];
const CSV_COLUMNS_REQUIRED = ['username', 'emails', 'password_hash'];
const BCRYPT_HASH = /^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/;

// AUTHWALL_SEED_FILE: the seed users from a JSON array or a CSV whose header
// row names its columns, told apart by the text. A password is only ever its
// bcrypt hash, as the database stores it; anything else stops startup.
function parse_authwall_seed_file(path)
{
    if (!path) {
        return [];
    }

    const text = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
    const records = text.trimStart().startsWith('[') ? parse_seed_file_json(path, text) : parse_seed_file_csv(path, text);
    return records.map((v, i) => parse_seed_file_record(path, v, i + 1));
}

// The parsers' own messages may quote a field: a hash or a password. Only
// the place of an error is told.
function parse_seed_file_json(path, text)
{
    let records = null;
    try {
        records = JSON.parse(text);
    }
    catch {
        throw new Error(`AUTHWALL_SEED_FILE ${path}: not valid JSON`);
    }
    if (!Array.isArray(records) || records.some(v => (typeof v !== 'object') || (v === null) || Array.isArray(v))) {
        throw new Error(`AUTHWALL_SEED_FILE ${path}: a JSON file is an array of objects`);
    }
    return records;
}

function parse_seed_file_csv(path, text)
{
    let rows = null;
    try {
        rows = parse(text, {trim: true, skip_empty_lines: true});
    }
    catch (error) {
        throw new Error(`AUTHWALL_SEED_FILE ${path}: the CSV does not parse at line ${error.lines ?? '?'} (${error.code ?? 'error'})`);
    }
    if (!rows.length) {
        return [];
    }

    const [header, ...body] = rows;
    check_seed_file_header(path, header);
    return body.map(function (row) {
        const out = {};
        for (const [i, column] of header.entries()) {
            out[column] = row[i];
        }
        return out;
    });
}

function check_seed_file_header(path, header)
{
    if (header.includes('password')) {
        throw new Error(`AUTHWALL_SEED_FILE ${path}: the header names "password"; a plain password is never kept in the file, its bcrypt hash goes in "password_hash" (bin/password-hash makes one)`);
    }

    // A first line with no known column is data: echoing it would log a hash
    // or a password.
    if (!header.some(v => FIELDS.includes(v))) {
        throw new Error(`AUTHWALL_SEED_FILE ${path}: the first line names no known column; a CSV opens with a header row naming username, emails and password_hash, and may name display_name`);
    }

    const unknown = header.filter(v => !FIELDS.includes(v));
    const missing = CSV_COLUMNS_REQUIRED.filter(v => !header.includes(v));
    const repeated = header.filter((v, i) => header.indexOf(v) !== i);
    if (unknown.length || missing.length || repeated.length) {
        const found = [`unknown: ${unknown.join(', ') || '-'}`, `missing: ${missing.join(', ') || '-'}`, `repeated: ${repeated.join(', ') || '-'}`].join('; ');
        throw new Error(`AUTHWALL_SEED_FILE ${path}: the header row names username, emails and password_hash, and may name display_name (${found})`);
    }
}

function parse_seed_file_record(path, record, row)
{
    for (const key of Object.keys(record)) {
        if (key === 'password') {
            throw new Error(`AUTHWALL_SEED_FILE ${path}, user ${row}: "password" is never kept in the file; put its bcrypt hash in "password_hash" (bin/password-hash makes one)`);
        }
        if (!FIELDS.includes(key)) {
            throw new Error(`AUTHWALL_SEED_FILE ${path}, user ${row}: unknown field "${key}"; the fields are ${FIELDS.join(', ')}`);
        }
    }

    const password_hash = record.password_hash || undefined;
    if (password_hash && !BCRYPT_HASH.test(password_hash)) {
        throw new Error(`AUTHWALL_SEED_FILE ${path}, user ${row}: "password_hash" is not a bcrypt hash`);
    }

    const emails = Array.isArray(record.emails) ? record.emails : String(record.emails ?? '').split(/[\s,]+/);
    return {
        username: record.username || undefined,
        password_hash,
        display_name: record.display_name || undefined,
        email: emails.filter(Boolean),
    };
}

module.exports = parse_authwall_seed_file;
