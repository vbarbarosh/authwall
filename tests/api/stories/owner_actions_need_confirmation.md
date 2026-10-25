# Actions that need the owner ask "confirm it is you"

Ann leaves her laptop signed in. Someone else at it holds a session of her
account, and a session is all Authwall asked for before five actions:
removing an address, disconnecting a provider, creating a personal access
token, setting a first password and removing the account.

## Before

Run on `2aca0c7`, each of the five went through on the session alone. The
one that hurts most (AW-77, probe p9 of the 10-25 audit): the borrower removes Ann's verified primary,
adds their own address, opens its verification link in the same browser and
asks for a password reset. The reset goes to their address; Ann gets no mail
at all.

## Expected

Each of the five is refused until the session has confirmed it is the owner
in the last ten minutes: a code to the primary address, the password, or a
fresh sign-in with a linked provider. The refusal says what to do, and the
session keeps where to come back; once confirmed, the owner does it again.

An unverified address is removed without asking: it is no way in, and a user
held at the verify step fixes a typo that way.

## Why

A signed-in session proves a browser, not a person. The actions that change
how the account is reached, or end it, need the person.
