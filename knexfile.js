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
        connection: process.env.AUTHWALL_MYSQL,
        pool: {
            min: 2,
            max: 10
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
