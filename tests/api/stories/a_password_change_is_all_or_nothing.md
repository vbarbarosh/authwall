# A password change is all or nothing

Ann lost her laptop, signed in on it, and has a personal access token for a
script. From her phone she changes her password, on the password form or on
the profile form, and the database fails halfway: the new password is
written, then revoking her tokens fails.

## Expected

Nothing of the change stays: the old password still signs in, the laptop's
session and the token still work, and the form answers with an error, so Ann
tries again. When the database works, the change writes the new password
and ends the laptop's session, the links in flight and the token together.

## Why

The new password was written first, and the other sessions, links and
tokens were ended by separate statements after it. A failure between them
left the new password in effect beside credentials of the old one, while Ann
believed the laptop was out (AW-110). A reset already settles all of it in
one transaction; a change now does the same.
