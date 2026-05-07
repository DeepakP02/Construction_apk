const EDITOR_ROLES = ['PM', 'COMPANY_OWNER', 'FOREMAN'];

const normalizeRole = (role) => String(role || '').toUpperCase();

export const canCreateRFI = (role) => EDITOR_ROLES.includes(normalizeRole(role));

export const canManageRFI = (role) => EDITOR_ROLES.includes(normalizeRole(role));

export const canCommentOnRFI = (role) => Boolean(normalizeRole(role));
