const Promise = require('bluebird');
const als = require('./als');
const db = require('../../db');

async function bootstrap_database()
{
    als.logger.write(`📡 Connecting to ${db.client.config.custom.label}...`);

    const max_attempts = 30;
    const delay_ms = 1000;

    for (let attempt = 1; attempt <= max_attempts; ++attempt) {
        try {
            await db.raw('SELECT 1');
            break;
        }
        catch (error) {
            if (attempt === max_attempts) {
                als.logger.write(`❌ ${db.client.config.custom.label} initialization failed`);
                throw error;
            }
            als.logger.write(`⏳ ${db.client.config.custom.label} not ready (attempt ${attempt}/${max_attempts}) - ${JSON.stringify(error.message).slice(1, -1)}`);
            await Promise.delay(delay_ms);
        }
    }

    als.logger.write(`✅ Connection to ${db.client.config.custom.label} established`);

    let version;
    switch (db.client.config.custom.name) {
    case 'sqlite':
        version = await db.raw('SELECT sqlite_version() AS version').then(v => v[0].version);
        break;
    case 'mysql':
        version = await db.raw('SELECT VERSION() AS version').then(v => v[0][0].version);
        break;
    case 'postgres':
        version = await db.raw('SELECT VERSION() AS version').then(v => v.rows[0].version);
        break;
    default:
        throw new Error(`Invalid database driver: ${db.client.config.custom.name}`);
    }
    als.logger.write(`🧬 ${db.client.config.custom.label} version: ${version}`);

    const [batch, migrations] = await db.migrate.latest();
    if (migrations.length) {
        als.logger.write(`Applied ${migrations.length} migration(s)`);
    }

    als.logger.write(`✅ ${db.client.config.custom.label} is ready`);
}

module.exports = bootstrap_database;
