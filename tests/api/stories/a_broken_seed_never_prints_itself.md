# A broken seed never prints itself

The operator gives `AUTHWALL_SEED` as JSON and misses a comma:

```
[{"username":"admin","password":"Winter-PASSWORD-1" "emails":["admin@example.com"]}]
```

Authwall runs under `restart: unless-stopped`, its log collected.

## Before

Run on `ad1edfb` (AW-127): the start failed on an uncaught `JSON.parse`
error, and Node printed the line it failed on, which was the whole seed,
every password in it. Each restart printed it again into the collected log.

## Expected

The start still fails, with `AUTHWALL_SEED: not valid JSON`; a JSON seed that
is not an array of objects fails with `AUTHWALL_SEED: a JSON seed is an array
of objects`. Neither stdout nor stderr holds any part of the seed.
`AUTHWALL_SEED_FILE` already answered a broken file this way.

## Why

A parser's own message, and the source line Node prints with an uncaught
error, quote what they failed on. The seed's text is passwords, so only the
place of an error is told.
