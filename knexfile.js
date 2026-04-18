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
    },

    mysql: {
        client: 'mysql2',
        connection: {
            uri: process.env.AUTHWALL_MYSQL,
        },
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
    },

};
