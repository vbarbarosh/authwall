<p>
<a target="_blank" href="https://hub.docker.com/r/vbarbarosh/authwall"><img src="https://img.shields.io/docker/pulls/vbarbarosh/authwall" /></a>
<a target="_blank" href="https://hub.docker.com/r/vbarbarosh/authwall"><img src="https://img.shields.io/docker/v/vbarbarosh/authwall/2?label=docker%20image%20ver." /></a>
<a target="_blank" href="https://github.com/vbarbarosh/authwall"><img src="https://img.shields.io/github/last-commit/vbarbarosh/authwall" /></a>
<a target="_blank" href="https://github.com/vbarbarosh/authwall"><img src="https://img.shields.io/github/stars/vbarbarosh/authwall?style=flat" /></a>
<br>
<a target="_blank" href="https://github.com/vbarbarosh/authwall/actions"><img src="https://github.com/vbarbarosh/authwall/actions/workflows/playwright.yml/badge.svg" alt="@vbarbarosh/authwall CI status" /></a>
<a target="_blank" href="https://opensource.org/licenses/MIT" rel="nofollow"><img src="https://img.shields.io/github/license/vbarbarosh/authwall" alt="License" /></a>
</p>

<p align="center"><img src="logo.png" alt="Logo" width="400"></p>

**Authwall** is an authentication proxy — it sits between clients and an internal app, handling sign-in (email/password, magic links, Google OAuth, GitHub OAuth) and forwarding authenticated   
requests with an X-Auth-User header.

```
client
    ↓
authwall
    ↓
your app
```

```mermaid
sequenceDiagram
    participant client
    participant authwall
    participant your_app

    client ->> authwall: request
    authwall ->> your_app: request (X-Auth-User)
    your_app -->> authwall: response
    authwall -->> client: response
```
