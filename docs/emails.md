# Emails

Authwall sends transactional emails — sign-in links, confirmation codes,
password resets, and security notifications. Every message is rendered from a
template file shipped in the repository, so the wording can be customized
without touching code.

## When email is sent

Email requires a configured mailer. Set one up with
[`AUTHWALL_MAILER`](config.md#authwall_mailer) and a provider (Resend, Mailjet,
or Amazon SES). With no mailer configured, Authwall uses a `fake` mailer that
silently drops every message — fine for local development, but it means
confirmation and password-reset emails never arrive, so it is not safe for
production.

Authwall only sends to **verified** email addresses.

## Template files

Templates live in `design/emails/` as plain-text `.txt` files — one file per
message. In the published Docker image they are at `/app/design/emails/`.

### Template format

Each file is a `Subject:` header, a blank line, then the body:

```
Subject: Your sign-in link

Hi {{display_name}},

Use the link or code below to sign in. Both expire in 10 minutes.

Sign in:
{{link}}

— Authwall
```

- The first line must be `Subject: ...`.
- A blank line separates the subject from the body.
- `{{placeholder}}` markers are replaced at send time (see the reference below).
- If `display_name` is empty, the renderer tidies `Hi ,` down to `Hi,`.

> [!WARNING]
> Rendering fails if a template references a placeholder that Authwall does not
> supply for that message. When editing a template, only use placeholders that
> already appear in the shipped version of that file.

Templates are plain text; there is currently no HTML version.

## Template catalog

| Template file                         | Sent when                                                        |
|---------------------------------------|------------------------------------------------------------------|
| `welcome.txt`                         | A new account is created (no email confirmation needed)          |
| `welcome-and-confirm-email.txt`       | New account that must confirm its email                          |
| `confirm-email.txt`                   | A standalone request to confirm an email address                 |
| `email-change-request.txt`            | A user requests changing their email — sent to the new address   |
| `email-changed.txt`                   | Notice sent to the *old* address that the email is being changed |
| `magic-link.txt`                      | A passwordless sign-in link/code is requested                    |
| `password-reset.txt`                  | A password reset is requested                                    |
| `new-sign-in.txt`                     | A new sign-in to the account is detected                         |
| `password-changed-from-profile.txt`   | The password was changed from the profile page                   |
| `password-changed-via-reset-link.txt` | The password was changed through a reset link                    |
| `<provider>-connected.txt`            | An OAuth provider was linked to the account                      |
| `<provider>-disconnected.txt`         | An OAuth provider was unlinked from the account                  |

`<provider>` is one of `google`, `github`, `microsoft`, `facebook`, `twitter`,
`discord` — twelve files in total.

### Link / code variants

The magic-link, confirm-email, and welcome-and-confirm templates ship in three
forms, and Authwall picks one to match the configured delivery channel
([`AUTHWALL_MAGIC_LINK`](config.md#authwall_magic_link) /
[`AUTHWALL_CONFIRM_EMAIL`](config.md#authwall_confirm_email)):

| Variant                 | Used when the channel is | Example                       |
|-------------------------|--------------------------|-------------------------------|
| base (`name.txt`)       | both a link and a code   | `magic-link.txt`              |
| `name-without-code.txt` | link only                | `magic-link-without-code.txt` |
| `name-without-link.txt` | code only                | `magic-link-without-link.txt` |

Edit all the relevant variants when customizing one of these messages.

## Placeholder reference

Not every placeholder appears in every template; each file uses the subset
relevant to its message.

| Placeholder           | Meaning                                        |
|-----------------------|------------------------------------------------|
| `{{display_name}}`    | The recipient's display name                   |
| `{{link}}`            | A magic-link sign-in URL                       |
| `{{code}}`            | A one-time code the user types into a page     |
| `{{confirm_link}}`    | An email-confirmation URL                      |
| `{{reset_link}}`      | A password-reset URL                           |
| `{{sign_in_link}}`    | The sign-in page URL                           |
| `{{sessions_link}}`   | The active-sessions page URL                   |
| `{{email}}`           | An email address relevant to the message       |
| `{{new_email}}`       | The requested new email address (email change) |
| `{{expires_minutes}}` | Minutes until the link or code expires         |
| `{{date}}`            | A formatted timestamp                          |
| `{{ip}}`              | The client IP address                          |
| `{{ua}}`              | The client browser / user-agent                |

## Customizing the templates

Editing a template is just editing its `.txt` file — keep the `Subject:` header
and the blank line, and reuse only the placeholders already present.

- **From source:** edit the files under `design/emails/` directly.
- **With the published Docker image:** the templates are baked into the image
  at `/app/design/emails/`. To override them, either bind-mount a directory of
  customized templates over `/app/design/emails`, or build a derived image that
  `COPY`s your versions over the originals.

Restart Authwall after changing templates.
