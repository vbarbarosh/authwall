# Authentication UX Dictionary

```
GET /auth/sign-in   authenticate user       | Display sign-in page (login form)
GET /auth/sign-out  destroy session/token   | Display sign-out confirmation page
GET /auth/sign-up   create account          | Display page by which user could create new account (registration form)
GET /auth/forgot-password  send reset email | Display page to start password recovery
GET /auth/reset-password   change password using token | Display page for setting a new password using a reset token
GET /auth/change-password   Display page for changing current password

POST /auth/sign-in   User submits username + password | Authenticate user using submitted credentials
POST /auth/sign-out  User confirms intentiopn for sign out | Destroy session/token
POST /auth/sign-up   User submits username + password and its confirmation
POST /auth/forgot-password  send reset email | Send password reset email
POST /auth/reset-password   apply reset token + new password  | Apply reset token and set new password
POST /auth/change-password  change current password to  | User submits current password and new password

GET /auth/profile  Display profile for current user
PATCH /auth/profile ?
DELETE /auth/account ?

GET /auth/me                    current authenticated user | ??
GET /auth/verify-email?token=xxx
POST /auth/resend-verification
GET /auth/mfa/setup             ??
GET /auth/mfa/verify            ??

GET /auth/providers ??
GET /auth/oauth/google                     Start OAuth | Server redirects user to Google authorization page
GET /auth/oauth/google/callback?code=XXXX  Google redirects the user back
    Server:
        - exchanges code for token
        - fetches user profile
        - creates or finds user
        - creates session
        - redirects to app

📝 OAuth is a redirect-based protocol, not a JSON API call.
The browser must follow redirects.
Typical chain:
    GET /auth/oauth/google
            ↓
    Google login page
            ↓
    GET /auth/oauth/google/callback
            ↓
    Session created
            ↓
    Redirect to app
```
