# Passwordless Magic-Link Flow

The system authenticates a user by proving control of the email inbox rather than requiring a password.

## Flow

```
Enter email
    │
    ▼
POST /auth/email
    │
    ▼
Server generates login token
    │
    ▼
Email sent to user
    │
    ▼
User clicks link
    │
    ▼
GET /auth/email/callback?token=...
    │
    ▼
Token verified
    │
    ▼
User created or found
    │
    ▼
Session created
    │
    ▼
Redirect to app
```


```
Enter email
    │
    ▼
POST /auth/magic-link
    │
    ▼
Server generates:
    token
    code
    │
    ▼
Email sent containing:
    clickable link
    login code
```
