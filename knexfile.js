module.exports = {

    sqlite: {
        client: 'better-sqlite3',
        connection: {
            filename: './data/db.sqlite3'
        },
        useNullAsDefault: true,
        migrations: {
            directory: './db/migrations',
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './db/seeds',
        },
    },

    mysql: {
        client: 'mysql2',
        connection: null,
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            directory: './db/migrations',
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './db/seeds',
        },
    },

};
