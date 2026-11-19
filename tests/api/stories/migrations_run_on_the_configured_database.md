# Migrations run on the configured database

An operator runs Authwall on PostgreSQL, or on a SQLite file of its own:
`AUTHWALL_DB` names it. Before an upgrade they run `bin/migrate`, and after
a bad one `bin/migrate-rollback`.

## Expected

Both scripts open the database `AUTHWALL_DB` names, the one the server
migrates when it starts, and say which one: its kind, then its file or its
URL without the password. `bin/migrate` applies the pending migrations in
one batch; `bin/migrate-rollback` rolls back the latest batch. With
`AUTHWALL_DB` unset both work on `data/db.sqlite3`, as the server does.

## Why

The scripts ran the Knex CLI with `--env=sqlite`, which always opens
`data/db.sqlite3`: whatever `AUTHWALL_DB` said, a migration went to a
SQLite file next to the code, made it if it was missing, and reported
success; a rollback went there too, and the real database was left as it
was (M-11).
