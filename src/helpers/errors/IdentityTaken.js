// Thrown inside a transaction to roll it back: an identity it was to claim
// was claimed first, by another user.
class IdentityTaken extends Error
{
}

module.exports = IdentityTaken;
