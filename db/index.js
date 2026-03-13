const knex = require('knex');
const config = require('../src/config');

const db = knex(config.knexvars);

module.exports = db;
