# Themes

A theme is your own look for Authwall's pages: sign-in, sign-up, the profile
and every other screen are one file, `design/public_html/spa.html`. Copy it,
change its styles, logo and words, and mount your copy over the shipped one.
The emails have templates of their own ([Emails](emails.md)).

## Make one

Take the shipped page out of the image:

```sh
mkdir -p theme
docker run --rm vbarbarosh/authwall \
    cat /app/design/public_html/spa.html > theme/spa.html
```

Edit `theme/spa.html`, then mount the folder over the shipped one:

```sh
docker run -d --name authwall -p 3000:3000 \
    -e AUTHWALL_UPSTREAM_URL=http://internal:8080 \
    -v ./theme:/app/design/public_html:ro \
    vbarbarosh/authwall
```

- the page is read on every request: save, reload, and the change is there
- other files in the folder are served under `/auth/`: `theme/logo.svg` is
  `/auth/logo.svg`
- the folder replaces the shipped one whole, so `spa.html` must be in it

## See every screen: the demo bar

Open the page at <http://localhost:3000> and a row of links runs over it, the
demo bar: one link per screen (Sign In, Sign Up, Reset Request, Magic Link,
Profile, Sessions, Tokens and the rest), and one per sign-up form layout the
configuration allows. A click shows that screen at once, without walking
through its flow, so each one can be styled in turn.

- it shows only at `localhost` and `127.0.0.1`, or with `?demo=1` in the
  address; at any other address the page has no bar
- its links only switch the screen in the browser: nothing reaches the server

## Keep the wiring

Styles, layout and words are yours to change. Keep the forms, their `id` and
`data-testid` attributes, and the script: the page reads `/auth/status` to
know which screens and buttons the configuration allows, and posts its forms
to the `/auth/` routes with those ids.
