```
AUTHWALL_PUBLIC_URL=http://authwall.test
AUTHWALL_UPSTREAM_URL=http://127.0.0.1:8080
AUTHWALL_FLOWS=username,magick_link_and_code
```

Invalid `AUTHWALL_FLOWS` values should fail startup instead of falling back to `auto`.
Otherwise, a user may think the app started with the requested flows, while it actually
started with a different and improperly configured authentication surface.
