const config = require('../../config');
const db = require('../../db');
const fs = require('fs');
const path = require('path');

const DAY_MS = 24*60*60*1000;
const BATCH_SIZE = 1000;
const DAY_LOG_FILE = /^app-(\d{4}-\d{2}-\d{2})\.log$/;

// The records that end, and the columns that say when: a row goes
// retention.ended_days after the first of them.
const ENDED_RECORDS = [
    {table: 'sessions', columns: ['expires_at']},
    {table: 'magic_links', columns: ['expires_at', 'used_at']},
    {table: 'confirm_codes', columns: ['expires_at', 'used_at']},
    {table: 'email_verify_tokens', columns: ['expires_at', 'used_at']},
    {table: 'password_reset_tokens', columns: ['expires_at', 'used_at']},
    {table: 'email_change_tokens', columns: ['expires_at', 'used_at']},
    {table: 'personal_access_tokens', columns: ['expires_at', 'revoked_at']},
];

// Deletes what has outlived config.retention (M-10): the records that ended
// ended_days ago, and the sign-in history and the day log files older than
// history_days. A period of 0 keeps its records forever. Returns how many
// went, by table, and log_files for the day files.
async function records_prune(now)
{
    const out = {};
    const {ended_days, history_days} = config.retention;
    for (const record of ENDED_RECORDS) {
        out[record.table] = ended_days ? await rows_delete_before(record.table, record.columns, days_before(now, ended_days)) : 0;
    }
    out.auth_events = history_days ? await rows_delete_before('auth_events', ['created_at'], days_before(now, history_days)) : 0;
    out.log_files = history_days ? await day_logs_delete_before(days_before(now, history_days)) : 0;
    return out;
}

// In batches, so a long backlog never holds a table locked for long.
async function rows_delete_before(table, columns, cutoff)
{
    let total = 0;
    while (true) {
        const ids = await db(table)
            .where(function () {
                for (const column of columns) {
                    this.orWhere(column, '<', cutoff);
                }
            })
            .limit(BATCH_SIZE)
            .pluck('id');
        if (ids.length) {
            await db(table).whereIn('id', ids).delete();
            total += ids.length;
        }
        if (ids.length < BATCH_SIZE) {
            return total;
        }
    }
}

// The files the daily logger writes, named by their UTC day. Any other file
// in the folder is not Authwall's and stays.
async function day_logs_delete_before(cutoff)
{
    const cutoff_day = cutoff.toISOString().slice(0, 10);
    let total = 0;
    for (const name of await fs.promises.readdir(config.logs_dir)) {
        const match = name.match(DAY_LOG_FILE);
        if (match && (match[1] < cutoff_day)) {
            await fs.promises.rm(path.join(config.logs_dir, name), {force: true});
            total++;
        }
    }
    return total;
}

function days_before(now, days)
{
    return new Date(now.getTime() - days*DAY_MS);
}

module.exports = records_prune;
