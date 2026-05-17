# CLI tools

The `bin/` directory holds small command-line tools for running, building, and
operating Authwall. They fall into four groups.

Most tools assume a source checkout with dependencies installed (`npm install`)
and are run from the repository root, e.g. `bin/activity-summary day`.

## Running and development

| Command     | What it does                                                                    |
|-------------|---------------------------------------------------------------------------------|
| `bin/run`   | Start Authwall (`npm start`).                                                   |
| `bin/watch` | Start in watch mode — restarts on file changes, loads `.env` (`npm run watch`). |
| `bin/test`  | Run the full test suite: unit, API, and end-to-end (`npm run test`).            |

## Database migrations

| Command                   | What it does                               |
|---------------------------|--------------------------------------------|
| `bin/migrate`             | Apply all pending migrations.              |
| `bin/migrate-make <name>` | Create a new migration file.               |
| `bin/migrate-rollback`    | Roll back the most recent migration batch. |

These wrap the Knex CLI for development work against the local SQLite database.

> [!NOTE]
> When the server starts, it applies pending migrations automatically (see
> [Getting started](getting-started.md)). You do not normally need `bin/migrate`
> for a deployed instance — it is a development convenience.

## Secrets and hashing

| Command                 | What it does                                                                                     |
|-------------------------|--------------------------------------------------------------------------------------------------|
| `bin/random-secret`     | Print a random 32-character secret, suitable for [`AUTHWALL_SECRET`](config.md#authwall_secret). |
| `bin/bcrypt <password>` | Print a bcrypt hash of `<password>`, using the configured cost factor.                           |

`bin/bcrypt` is useful for pre-hashing a password for a bootstrap user defined
as `password_hash` in `config/settings.yaml`.

```sh
bin/random-secret
bin/bcrypt 'correct horse battery staple'
```

## Build and release

| Command                           | What it does                                                                                                        |
|-----------------------------------|---------------------------------------------------------------------------------------------------------------------|
| `bin/build`                       | Build the Docker image, stamping version/revision/source/created build args. Tags `vbarbarosh/authwall` by default. |
| `bin/release major\|minor\|patch` | Bump the version, commit it, and create and push the release tag.                                                   |
| `bin/deploy`                      | Build and push the Docker image under its version, major, and revision tags.                                        |

`bin/release` and `bin/deploy` both refuse to run unless the current branch is
`production` and the working tree is clean. `bin/release` only handles the Git
side — it does not run tests or build images; CI runs `bin/test` and then
`bin/deploy` after `production` is pushed.

## Operations and reporting

Two read-only tools summarize what an Authwall instance has been doing.

### `bin/activity-summary`

Summarizes authentication events (sign-ins, sign-ups, password changes, and so
on) recorded in the database over a time window.

```
Usage: bin/activity-summary [day|several-days|week|<days>d] [options]

Options:
  --days N       Summarize the last N days
  --since DATE   Start date/time, inclusive
  --until DATE   End date/time, exclusive; defaults to now
  --json         Print the summary as JSON
  -h, --help     Show this help

Examples:
  bin/activity-summary day
  bin/activity-summary several-days
  bin/activity-summary week
  bin/activity-summary --since 2026-05-01 --until 2026-05-08
```

It reads the database configured by [`AUTHWALL_DB`](config.md#authwall_db).
For a Dockerized deployment, run it inside the Authwall container so it sees the
same configuration.

### `bin/log-summary`

Summarizes HTTP requests from the daily log files Authwall writes when
[`AUTHWALL_LOGGER=daily`](config.md#authwall_logger).

```
Usage: bin/log-summary [today|yesterday|YYYY-MM-DD|PATH] [options]

Options:
  --date YYYY-MM-DD  Read app-YYYY-MM-DD.log from the logs directory
  --file PATH        Read an explicit log file
  --logs-dir DIR     Directory containing daily app-YYYY-MM-DD.log files
  --query            Group by full URL path including query string
  --group GLOB       Collapse matching METHOD path values into one count row
  --json             Print the summary as JSON
  -h, --help         Show this help

Examples:
  bin/log-summary today
  bin/log-summary yesterday
  bin/log-summary 2026-04-26 --logs-dir data/authwall/logs
  bin/log-summary today --group "GET /t/1024/*"
  bin/log-summary --file data/authwall/logs/app-2026-04-26.log
```

`--group` collapses many similar paths into a single row — for example,
`--group "GET /t/*"` reports all `GET /t/...` requests as one count instead of
one row per id.
