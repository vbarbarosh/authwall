# Microsoft email is verified only when its domain owner vouches for it

Jonny signs in with a Microsoft work account. Authwall exchanges the code with
Microsoft's token endpoint and receives an access token and an ID token. In
one run the app registration requests the `xms_edov` optional claim and the
tenant has verified the domain of `jonny@example.com`; in another the claim is
absent, or false. A third run has `AUTHWALL_ALLOWED_DOMAINS=example.com` set.

## Expected

With `xms_edov: true`, the account is created with `jonny@example.com` as a
verified address, and under the allow-list Jonny is admitted.

Without the claim, or with it false, the account is still created but holds no
email address at all; Jonny can add one from the profile and verify it there.
Under the allow-list the same sign-in is refused with *"A verified email is
required"*, exactly as a GitHub account with no verified address is.

An ID token issued for another client, or by an issuer outside
`login.microsoftonline.com`, fails the sign-in.

## Why

Every other gated adapter takes the provider's word per address: GitHub's
`verified` flag, Google's `email_verified`, Discord's account flag.
Microsoft's userinfo `email` is set by whoever administers the account's
tenant, and Microsoft documents it as mutable and not for authorization; on
the `common` authority any tenant can put any address on an account, so an
allow-list was one tenant away from admitting anyone, and storing that address
verified also squatted it against its real owner.

`xms_edov` is the statement Microsoft does stand behind: the address's domain
belongs to the tenant the account lives in and that tenant verified it.
Reading it means reading the ID token, which Authwall receives directly from
the token endpoint over TLS and validates for audience, issuer, tenant,
subject and expiry. The choice between this and the alternatives is recorded
in [`notes/decisions.md`](../../../notes/decisions.md).
