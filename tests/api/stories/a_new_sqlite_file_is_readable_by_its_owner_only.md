# A new SQLite file is readable by its owner only

The operator runs Authwall on a machine other people use too, with the
default SQLite database and the usual umask, `022`. The first start, or a
`bin/migrate` run first, makes the database file.

## Before

Run on `83a4cf7` (AW-169): the file came out `rw-r--r--`. Anyone on the
machine who can enter its folder could copy it, and with it every password
hash, address and sign-in record.

## Expected

The server's first start and `bin/migrate` alike make the file
`rw-------`. A file that already exists keeps its mode: an install from
before the fix runs `chmod 600` on it once.

## Why

Authwall named the file and left making it to SQLite, which takes its mode
from the umask. The secret key beside it was already made owner-only.
