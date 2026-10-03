# An added address is confirmed only where its account is signed in

Sam already has an account: username `sam`, a password, and his GitHub
linked. It has no email yet, so his profile offers "Add email". He adds
`vera@corp.test`, Vera's address, and Authwall mails Vera "confirm this
address". Vera taps the link on her phone.

## Expected

Vera's tap confirms nothing. Her browser is not signed in to Sam's account,
so it is sent to sign in ("Sign in to confirm this address"), with the link
kept as where to return. She cannot sign in to Sam's account, so the address
stays unconfirmed, and Sam's sessions are untouched.

Sam confirms his own added address in a browser signed in to the account:
the one that added it, or his phone after signing in there. A tap elsewhere
does not use the link up.

An account whose only way in is its password (a username, nothing linked) is
handed over to whoever taps, as a sign-up is.

## Why

A confirmation link proves who reads the mailbox (AW-25). Handing the
account to that reader works when the password is the only other way in:
the handover voids it. Sam's GitHub would survive it, and he would sign
back in with Vera's address confirmed on his account. So an account with
another way in waits for the link in a browser signed in to it.
