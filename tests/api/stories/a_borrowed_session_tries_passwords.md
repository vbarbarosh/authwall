# A borrowed session tries passwords

Mallory sits at Ann's signed-in laptop and does not know her password. The
password change form and the profile form both ask for the current password,
and answer at once whether it was right.

## Before

Run on `f170995` (AW-87): the budget was read before the password was
compared and written after, so 40 passwords sent at once all read it unspent
and all 40 were compared, at each of the three doors; a right one among them
was accepted.

## Expected

Each wrong current password counts against the budget "confirm it is you"
already keeps for Ann's account: five failures within 15 minutes, wrong codes
and wrong passwords alike. After the fifth, both forms and the confirmation
refuse even the right password with *"Too many attempts. Try again later."*,
and Ann's password stays as it was. Once the 15 minutes pass, the right
password works again.

Mallory sends 40 passwords at once to one of the three doors. No more than
five are compared, and the rest are refused uncompared, as they would be one
after another.

## Why

The confirmation counted its failures, but the two password forms compared the
current password with no budget at all, so a held session could try a whole
list of passwords against them, and learn the one that also opens Ann's mail
or her other accounts (M-07). One budget across the three doors means trying
at another one gains nothing.
