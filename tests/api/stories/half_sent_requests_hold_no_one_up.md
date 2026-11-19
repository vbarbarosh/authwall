# Half-sent requests hold no one up

Authwall proxies an app with `/favicon.ico` public. An anonymous client opens
256 `POST /favicon.ico` requests, each announcing a large body it never
sends, and keeps them open. Ann, signed in, then opens a page of the app, and
someone else asks for `/favicon.ico`.

## Before

Run on `6c8c2ad` (AW-122): the proxy shared the library's pool of upstream
sockets, capped at 256. Each half-sent request held one until its body ended,
so both ordinary requests got no answer at all while the 256 were held.
Server-sent events or long polls, 256 of them, met the same cliff.

## Expected

Ann's page and `/favicon.ico` are answered while the 256 are held. Each
request still takes its own upstream socket for as long as it lasts, as
before; there is no shared cap for them to fill.

## Why

The proxy now keeps its own pool of upstream sockets, with no cap, kept
alive between requests as before. A WebSocket upgrade takes none from it.
No timeout was added for slow responses, which server-sent events and long
polls need; Node's own limit on an unfinished request, five minutes, still
frees what a client never completes.
