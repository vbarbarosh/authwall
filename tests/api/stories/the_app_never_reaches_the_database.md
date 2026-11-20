# The app never reaches the database

The operator starts from the repository's `docker-compose.yaml`, or a recipe
with Postgres, and swaps the demo upstream for their own app.

## Before

Run on `164e035` (AW-171): Authwall, the database and the app shared the
stack's one network, and the database password is the one every copy of the
file holds. An app that runs someone else's code, or has a hole of its own,
could open the identity database: every account, hash and session.

## Expected

The database sits on a network of its own, `db`, marked internal, which only
Authwall joins. The app stays on the default network with Authwall, and
reaches neither the database nor the internet through `db`. Sign-in through
the upstream works as before.

## Why

Only Authwall reads the database. A network is the cheapest wall a Compose
file can draw, and the walkthrough keeps working without a password to set.
