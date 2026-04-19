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
