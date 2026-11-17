const Database = require('better-sqlite3');
const assert = require('assert');
const is_unique_violation = require('./is_unique_violation');

// What mysql2 and pg set as error.code: the MySQL error name and the
// PostgreSQL SQLSTATE.
const tests = [
    ['MySQL, a duplicate key', {code: 'ER_DUP_ENTRY'}, true],
    ['PostgreSQL, a duplicate key', {code: '23505'}, true],
    ['MySQL, NOT NULL', {code: 'ER_BAD_NULL_ERROR'}, false],
    ['MySQL, a foreign key', {code: 'ER_NO_REFERENCED_ROW_2'}, false],
    ['PostgreSQL, NOT NULL', {code: '23502'}, false],
    ['PostgreSQL, a foreign key', {code: '23503'}, false],
    ['sqlite3, any constraint', {code: 'SQLITE_CONSTRAINT'}, false],
    ['a number, not a SQLSTATE', {code: 23505}, false],
    ['an error with no code', new Error('UNIQUE constraint failed'), false],
    ['null', null, false],
    ['undefined', undefined, false],
];

// What better-sqlite3 throws, one statement per constraint.
const sqlite_tests = [
    ['insert into items (id, slug, title) values (2, \'a\', \'x\')', true],
    ['insert into items (id, slug, title) values (1, \'b\', \'x\')', true],
    ['insert into items (id, slug, title) values (3, \'c\', null)', false],
    ['insert into items (id, slug, title, size) values (4, \'d\', \'x\', 0)', false],
    ['insert into tags (id, item_id) values (1, 99)', false],
];

describe('is_unique_violation', function () {
    for (const [label, error, expected] of tests) {
        it(`${label} → ${expected}`, function () {
            assert.strictEqual(is_unique_violation(error), expected);
        });
    }
    for (const [sql, expected] of sqlite_tests) {
        it(`better-sqlite3: ${sql} → ${expected}`, function () {
            assert.strictEqual(is_unique_violation(sqlite_error_catch(sql)), expected);
        });
    }
});

function sqlite_error_catch(sql)
{
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec('create table items (id integer primary key, slug text unique, title text not null, size integer check (size > 0))');
    sqlite.exec('create table tags (id integer primary key, item_id integer references items (id))');
    sqlite.exec('insert into items (id, slug, title) values (1, \'a\', \'x\')');
    try {
        sqlite.exec(sql);
    }
    catch (error) {
        return error;
    }
    finally {
        sqlite.close();
    }
    throw new Error(`No error from: ${sql}`);
}
