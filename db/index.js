const knex = require('knex');
const config = require('../config');

const db = knex(config.knexvars);

module.exports = db;
