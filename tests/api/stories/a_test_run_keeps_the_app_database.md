# A test run keeps the app database

A developer's `.env` names the app's database, the one Mocha's account lives
in. They run `npm run test:api`, then `npm run test:e2e`; another time they
export `AUTHWALL_DB` for the app and run the suites in the same shell.

## Expected

The suites read no `.env`. With `AUTHWALL_DB` unset they run on a temporary
SQLite file, and the e2e server is started on its own file too, never on a
server already listening on the app's port. An exported `AUTHWALL_DB` names
the database they run on: the API suite and the e2e server take it only when
it is empty or was made by the suites, which leave a `test_database_mark`
table in it. A database holding the app's tables without that mark is
refused before anything is migrated, seeded or deleted. Mocha's account is
there after every run.

## Why

The API suite empties ten tables after each `[concurrent]` test, and the e2e
server migrates the database and seeds a user with a known password. Both
read the database from `AUTHWALL_DB`, and both used to load `.env` first, so
the temporary default never applied on a machine whose `.env` named the
app's database: one routine test run deleted every user, session, token and
event in it (AW-105).
