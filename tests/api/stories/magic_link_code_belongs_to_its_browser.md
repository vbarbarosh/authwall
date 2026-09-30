# A magic-link code belongs to the browser that asked for it

Mocha asks for a sign-in code at `mocha@authwall.test`. Someone who knows the
address, in another browser, posts five wrong codes for it before Mocha has
read the mail.

## Expected

The stranger's codes are refused and touch nothing: they are checked only
against codes that browser asked for, and it asked for none. Mocha types the
code from the mail and is signed in; all five guesses of that code are still
there.

The code works only in the browser that asked for it. Typed into another
browser, even the right code is refused. The link in the same mail is not
tied to a browser.

## Why

A code was checked against the newest code for the address, whoever posted
it. Anyone could spend its five guesses and so void Mocha's code before Mocha
typed it (AW-36), and every guess was a guess at Mocha's code. Now a stranger
who wants to guess has to ask for a code of their own, which goes to Mocha's
mailbox and does not replace the code Mocha's browser holds.
