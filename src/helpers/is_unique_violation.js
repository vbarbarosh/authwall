// Whether a query failed because a row with the same unique key (a unique
// index or the primary key) is already there, as each database reports it.
// Any other constraint (NOT NULL, a foreign key, a check) is not "already
// exists", and neither is the bare SQLITE_CONSTRAINT of a driver that does
// not tell them apart.
function is_unique_violation(error)
{
    switch (error?.code) {
    case 'ER_DUP_ENTRY':                  // MySQL
    case '23505':                         // PostgreSQL, unique_violation
    case 'SQLITE_CONSTRAINT_UNIQUE':      // better-sqlite3
    case 'SQLITE_CONSTRAINT_PRIMARYKEY':  // better-sqlite3
        return true;
    default:
        return false;
    }
}

module.exports = is_unique_violation;
