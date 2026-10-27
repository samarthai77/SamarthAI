'use strict';
// Fixed function allowlist; values from data attributes are arguments, never code.
document.addEventListener('click', function (event) {
  const button = event.target.closest('[data-security-action]');
  if (!button) return;
  const actions = {
    trackFamilyMember: value => window.trackFamilyMember(value),
    deleteFamilyMember: value => window.deleteFamilyMember(value),
    approveJoinRequest: value => window.approveJoinRequest(value),
    rejectJoinRequest: value => window.rejectJoinRequest(value),
    quickStatus: (id, status) => window.quickStatus(id, status),
    openNoteModal: id => window.openNoteModal(id),
    openDisableModal: (serviceId, id) => window.openDisableModal(serviceId, id)
  };
  const action = actions[button.dataset.securityAction];
  if (!Object.hasOwn(actions, button.dataset.securityAction) || !action) return;
  action(button.dataset.arg1, button.dataset.arg2);
});
