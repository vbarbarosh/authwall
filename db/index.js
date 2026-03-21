const knex = require('knex');
const config = require('../config2');

const db = knex(config.knexvars);

module.exports = db;
