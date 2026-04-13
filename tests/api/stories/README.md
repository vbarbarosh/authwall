- user signed up using GitHub, no verified email was found; now he tries to change password via profile page; what to do?
- user signed up using Google with verified email; after a while he tries to sign-in using email + password; he always will get "Invalid username or password" since no password was set!
- prevent user from removing last Authentication method
    - user signed up using Google, then connected GitHub account, then disconnected Google; only after email+password or username+password will be defined GitHub account could be disconnected; otherwise account becomes orphan without the ability to sign-in
- edge cases
    - user signed up using Google, then connected GitHub account, then disconnected Google
      - now signup using the same Google account should lead to creating new user, and since
        email already attached to another user, this one will be without email
- user navigated to /auth/profile; redirected to /auth/sign-in?return=/auth/profile; chose Continue with GitHub; after sucesfull login he should be redirected to /auth/profile
- user signed up using GitHub without email; he wants to set password - since no email nor username this should be impossible
