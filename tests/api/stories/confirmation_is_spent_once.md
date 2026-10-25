# A confirmation covers the action that asked for it, once

Ann is asked "confirm it is you" before removing an address, types her
password, and is called away before she removes anything. Her laptop stays
signed in.

## Before

Run on `8de628d`, a confirmation marked the whole session for ten minutes
(AW-81). In that window anyone at the laptop could link their own Google
account to Ann's (the connect skips the primary-address check once the
session is confirmed), and any second token, removal or disconnect went
through without asking.

## Expected

The confirmation remembers what asked for it. Only that action accepts it,
within the ten minutes, and using it spends it: a second token asks again,
and a Google account linked by someone else asks again, though Ann has just
confirmed.

## Why

Ann confirmed one thing. A borrowed session must not inherit her yes for
anything else.
