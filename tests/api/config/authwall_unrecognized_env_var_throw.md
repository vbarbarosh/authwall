```
AUTHWALL_PUBLIC_URL=http://authwall.test
AUTHWALL_TARGET_URL=http://127.0.0.1:8080
AUTHWALL_TAREGT_URL=http://wrong.test
```

Unrecognized `AUTHWALL_` variables should fail startup. Otherwise, a typo can be
silently ignored and the app may start with different settings than the user intended.
