export function canAccessRole(requiredRole, actualRole) {
  return !requiredRole || requiredRole === actualRole
}
