<p>
<a target="_blank" href="https://hub.docker.com/r/vbarbarosh/authwall"><img src="https://img.shields.io/docker/pulls/vbarbarosh/authwall" /></a>
<a target="_blank" href="https://hub.docker.com/r/vbarbarosh/authwall"><img src="https://img.shields.io/docker/v/vbarbarosh/authwall?sort=semver&label=docker%20image%20ver." /></a>
<a target="_blank" href="https://github.com/vbarbarosh/authwall"><img src="https://img.shields.io/github/last-commit/vbarbarosh/authwall" /></a>
<a target="_blank" href="https://github.com/vbarbarosh/authwall"><img src="https://img.shields.io/github/stars/vbarbarosh/authwall?style=flat" /></a>
<br>
<a target="_blank" href="https://github.com/vbarbarosh/authwall/actions"><img src="https://github.com/vbarbarosh/authwall/actions/workflows/master.yml/badge.svg" alt="@vbarbarosh/authwall CI status" /></a>
<a target="_blank" href="https://github.com/vbarbarosh/authwall/actions"><img src="https://github.com/vbarbarosh/authwall/actions/workflows/production.yml/badge.svg" alt="@vbarbarosh/authwall CI status" /></a>
<a target="_blank" href="https://github.com/vbarbarosh/authwall/actions"><img src="https://github.com/vbarbarosh/authwall/actions/workflows/trivy.yml/badge.svg" alt="@vbarbarosh/authwall Trivy status" /></a>
<a target="_blank" href="https://opensource.org/licenses/MIT" rel="nofollow"><img src="https://img.shields.io/github/license/vbarbarosh/authwall" alt="License" /></a>
<a target="_blank" href="https://codecov.io/gh/vbarbarosh/authwall"><img src="https://codecov.io/gh/vbarbarosh/authwall/graph/badge.svg" alt="Code coverage" /></a>
</p>

<p align="center"><img src="logo.png" alt="Logo" width="400"></p>

**Authwall** is an authentication proxy — it sits between clients and an internal app,
handles sign-in, and forwards authenticated requests with an `X-Auth-User` header.

```
client → authwall → your app
```

## Documentation

Full documentation lives in [`docs/`](docs/README.md):

* [Overview & quick start](docs/overview.md) — what Authwall is, with runnable `docker run` recipes
* [Getting started](docs/getting-started.md) — quick start and the full Docker Compose walkthrough
* [Configuration reference](docs/config.md) — every environment variable
* [Glossary](docs/glossary.md) — terms used throughout the docs and code

## License

[MIT](LICENSE)
