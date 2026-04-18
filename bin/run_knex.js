#!/usr/bin/env node

const {spawnSync} = require('child_process');
const get_database_env = require('../db/get_database_env');

const args = process.argv.slice(2);

if (!args.length) {
    throw new Error('Usage: node ./bin/run_knex.js <knex args...>');
}

const database_env = get_database_env();
const knex_cli = require.resolve('knex/bin/cli.js');
const result = spawnSync(process.execPath, [knex_cli, ...args, `--env=${database_env}`], {
    stdio: 'inherit',
    env: process.env,
});

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 0);
