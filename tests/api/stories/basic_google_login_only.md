```
AUTHWALL_PUBLIC_URL: https://authwall.test
AUTHWALL_UPSTREAM_URL: http://echo:8080
AUTHWALL_UNSET_HEADERS: x-auth-user
AUTHWALL_ALLOWED_EMAILS: jonny@gmail.com
AUTHWALL_GOOGLE_CLIENT_ID: fake_client_id
AUTHWALL_GOOGLE_CLIENT_SECRET: fale_client-secret
AUTHWALL_GOOGLE_REDIRECT_URL: https://authwall.test/auth/google/callback
```

- `jonny@gmail.com` can sign in via Google
- `bobby@gmail.com` must be rejected whether Bobby was never registered or was previously registered by another flow
- exactly one flow should be enabled: Google
