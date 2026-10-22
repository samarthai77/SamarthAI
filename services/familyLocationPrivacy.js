'use strict';
// Normal sharing stays unavailable until server-verified consent and expiry exist.
// A legacy sharing boolean or last_updated is not proof of valid consent.
// Authorized active SOS alerts use their separate emergency authorization.
function redactFamilyLocation(member) { return { ...member, location: null, last_updated: null }; }
function denyFamilyLocationRead() {
 const error = new Error('Family location unavailable: verified consent and sharing expiry are not configured');
 error.status = 403; throw error;
}
module.exports = { redactFamilyLocation, denyFamilyLocationRead };
