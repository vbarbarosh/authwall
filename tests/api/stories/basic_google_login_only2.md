```
AUTHWALL_PUBLIC_URL: https://authwall.test
AUTHWALL_TARGET_URL: http://echo:8080
AUTHWALL_UNSET_HEADERS: x-auth-user
AUTHWALL_ALLOWED_EMAILS: jonny@gmail.com
AUTHWALL_GOOGLE_CLIENT_ID: fake_client_id
AUTHWALL_GOOGLE_CLIENT_SECRET: fale_client-secret
AUTHWALL_GOOGLE_REDIRECT_URL: https://authwall.test/auth/google/callback
```

1. `jonny@gmail.com` signs in via Google.
2. The account now has two identities: `oauth_google` and `email`.
3. Jonny disconnects the Google identity.
4. From `/auth/profile`, Jonny tries to reconnect Google, but selects `bobby@gmail.com`, which is outside the allow-list.
5. Authwall should keep the existing session, show `Email is not allowed`, and return the user to `/auth/profile`.

No new session should be created, and the denied Google identity must not be linked.
