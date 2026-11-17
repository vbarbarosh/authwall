# A sign-in by email or by a provider returns to the page asked for

Ann opens `/reports`, is sent to `/auth/sign-in?return=%2Freports`, and signs
in without a password: by the code from an email, by the link in that email,
or with Google.

## Expected

Each way lands her on `/reports`, as the password form does. The request for
a magic link still answers with its notice; the mailed link carries the
return, and the open of that link lands there. Google's start keeps the return
in the session while she is at Google, and the callback lands there. A return
to another site is never kept: the mail has none, and the callback lands on
`/`.

## Why

The return rode only in the query of the post that signs in. A magic link
crosses an email and Google crosses its own site, and both came back without
it: every such sign-in landed on `/`.
