const Promise = require('bluebird');
const db = require('../../db');

async function bootstrap_database()
{
    console.log('📡 Connecting to database...');

    const max_attempts = 30;
    const delay_ms = 1000;

    for (let attempt = 1; attempt <= max_attempts; ++attempt) {
        try {
            await db.raw('SELECT 1');
            break;
        }
        catch (error) {
            if (attempt === max_attempts) {
                console.error('❌ Database initialization failed');
                throw error;
            }
            console.log(`⏳ MySQL not ready (attempt ${attempt}/${max_attempts})`);
            await Promise.delay(delay_ms);
        }
    }

    const [batch, migrations] = await db.migrate.latest();
    if (migrations.length) {
        console.log(`Applied ${migrations.length} migration(s)`);
    }

    console.log('✅ Database ready');
}

module.exports = bootstrap_database;
