const Promise = require('bluebird');
const als = require('./als');
const db = require('../../db');

async function bootstrap_database()
{
    als.logger.write('📡 Connecting to database...');

    const max_attempts = 30;
    const delay_ms = 1000;

    for (let attempt = 1; attempt <= max_attempts; ++attempt) {
        try {
            await db.raw('SELECT 1');
            break;
        }
        catch (error) {
            if (attempt === max_attempts) {
                als.logger.write('❌ Database initialization failed');
                throw error;
            }
            als.logger.write(`⏳ MySQL not ready (attempt ${attempt}/${max_attempts})`);
            await Promise.delay(delay_ms);
        }
    }

    const [batch, migrations] = await db.migrate.latest();
    if (migrations.length) {
        als.logger.write(`Applied ${migrations.length} migration(s)`);
    }

    als.logger.write('✅ Database ready');
}

module.exports = bootstrap_database;
