const pg = require('pg');

// int8 → JS number
//
// console.log(await db('sessions').count());
// [ { count: '3' } ] → [ { count: 3 } ]
pg.types.setTypeParser(20, v => Number(v));

module.exports = {

    sqlite: {
        client: 'better-sqlite3',
        connection: {
            filename: `${__dirname}/data/db.sqlite3`
        },
        useNullAsDefault: true,
        migrations: {
            directory: `${__dirname}/db/migrations`,
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: `${__dirname}/db/seeds`,
        },
        custom: {
            name: 'sqlite',
            label: 'SQLite 3',
        },
    },

    mysql: {
        client: 'mysql2',
        // 🐵 Object.create – Just to mute the following warning:
        //
        // node_modules/mysql2/lib/connection_config.js
        //
        //     for (const key in options) {
        //       if (!Object.prototype.hasOwnProperty.call(options, key)) continue;
        //       if (validOptions[key] !== 1) {
        //         // REVIEW: Should this be emitted somehow?
        //         console.error(
        //           `Ignoring invalid configuration option passed to Connection: ${key}. This is currently a warning, but in future versions of MySQL2, an error will be thrown if you pass an invalid configuration option to a Connection`
        //         );
        //       }
        //     }
        //
        // > How the Object.create hack works:
        // >
        // > The object shape:
        // > Object.assign(Object.create({collate: 'utf8mb4_unicode_ci'}), {
        // >     uri: ...,
        // >     charset: 'utf8mb4',
        // >     timezone: 'Z',
        // > })
        // > // Own properties:  { uri, charset, timezone }
        // > // Prototype:       { collate: 'utf8mb4_unicode_ci' }
        // >
        // > Step 1 — knex's cloneDeep preserves the prototype
        // > -------------------------------------------------
        // >
        // > In knex/lib/client.js:76:
        // > this.connectionSettings = cloneDeep(config.connection || {});
        // > Lodash cloneDeep copies the prototype chain intact, so connectionSettings.collate still resolves to 'utf8mb4_unicode_ci' via prototype lookup.
        // >
        // > Step 2 — mysql2 warning is silenced
        // > -----------------------------------
        // >
        // > In mysql2/lib/connection_config.js:91-98:
        // > for (const key in options) {           // iterates own + inherited
        // >     if (!Object.prototype.hasOwnProperty.call(options, key)) continue;  // ← skips 'collate'
        // >     if (validOptions[key] !== 1) {
        // >         console.error(`Ignoring invalid configuration option...`);
        // >     }
        // > }
        // > collate is not in validOptions, but because it lives on the prototype (not an own property),
        // > hasOwnProperty returns false and the continue skips the warning entirely.
        // >
        // > Step 3 — knex DDL uses conn.collate via normal property access
        // > --------------------------------------------------------------
        // >
        // > In knex/lib/dialects/mysql/schema/mysql-tablecompiler.js:36-45:
        // > conn = client.connectionSettings;
        // > const charset   = this.single.charset || conn.charset || '';   // own prop → 'utf8mb4'
        // > const collation = this.single.collate  || conn.collate || '';  // prototype → 'utf8mb4_unicode_ci'
        // >
        // > if (charset)    sql += ` default character set ${charset}`;
        // > if (collation)  sql += ` collate ${collation}`;
        // > Normal conn.collate access walks the prototype chain, so it finds the value and emits:
        // > CREATE TABLE ... DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        // >
        // > Summary
        // > -------
        // >
        // > Object.create({collate: …}) exploits the difference between for...in (which traverses prototypes)
        // > and hasOwnProperty (which doesn't). mysql2's guard uses hasOwnProperty → prototype properties
        // > are invisible to the warning check. But knex's table compiler uses plain property
        // > access → prototype properties are fully visible. So collate silently flows through to DDL
        // > generation while producing zero warnings.
        connection: Object.assign(Object.create({collate: 'utf8mb4_unicode_ci'}), {
            uri: process.env.AUTHWALL_DB,
            charset: 'utf8mb4',
            timezone: 'Z',
        }),
        pool: {
            min: 2,
            max: 10,
            // // https://dev.mysql.com/doc/refman/8.0/en/fractional-seconds.html
            // // By default, '2026-04-18T00:53:28.724Z' will be stored as '2026-04-18T00:53:29'
            // // To store '2026-04-18T00:53:28.724Z' as '2026-04-18T00:53:28' TIME_TRUNCATE_FRACTIONAL mode should be used
            // afterCreate: function (conn, done) {
            //     conn.query("SET SESSION sql_mode = 'TIME_TRUNCATE_FRACTIONAL'", (error) => done(error, conn));
            // },
        },
        migrations: {
            directory: `${__dirname}/db/migrations`,
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: `${__dirname}/db/seeds`,
        },
        custom: {
            name: 'mysql',
            label: 'MySQL',
        },
    },

    postgres: {
        client: 'pg',
        connection: process.env.AUTHWALL_DB,
        pool: {
            min: 2,
            max: 10,
        },
        migrations: {
            directory: `${__dirname}/db/migrations`,
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: `${__dirname}/db/seeds`,
        },
        custom: {
            name: 'postgres',
            label: 'PostgreSQL',
        },
    },

};
