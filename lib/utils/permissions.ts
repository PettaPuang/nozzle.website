// RBAC Permissions untuk SPBU Management System

export const ROLES = {
  DEVELOPER: "DEVELOPER",
  ADMINISTRATOR: "ADMINISTRATOR",
  OWNER: "OWNER",
  OWNER_GROUP: "OWNER_GROUP",
  MANAGER: "MANAGER",
  OPERATOR: "OPERATOR",
  UNLOADER: "UNLOADER",
  FINANCE: "FINANCE",
  ACCOUNTING: "ACCOUNTING",
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

/**
 * Check if user has specific role
 * DEVELOPER always passes all checks!
 * ADMINISTRATOR always passes all checks! (server-side sudah check gas station access)
 * OWNER_GROUP memiliki permission yang sama dengan OWNER
 *
 * @param userRole - Role code dari user (dari database)
 * @param requiredRole - Role yang dibutuhkan
 * @returns boolean - true jika user punya role tersebut
 *
 * @example
 * ```typescript
 * // Check if user is admin
 * if (hasRole(user.role, "ADMINISTRATOR")) {
 *   // allow delete
 * }
 * ```
 */
export function hasRole(
  userRole: RoleCode | undefined,
  requiredRole: RoleCode
): boolean {
  if (!userRole) return false;

  // Developer bypass - always return true (pass semua hal di aplikasi)
  if (userRole === ROLES.DEVELOPER) return true;

  // Administrator bypass - always return true (pass semua hal dalam gas station milik ownernya)
  // Note: Server-side sudah check gas station access, jadi di client-side bisa langsung pass
  if (userRole === ROLES.ADMINISTRATOR) return true;

  // OWNER_GROUP memiliki permission yang sama dengan OWNER
  if (requiredRole === ROLES.OWNER) {
    return userRole === ROLES.OWNER || userRole === ROLES.OWNER_GROUP;
  }
  if (userRole === ROLES.OWNER_GROUP && requiredRole === ROLES.OWNER_GROUP) {
    return true;
  }

  return userRole === requiredRole;
}

/**
 * Check if user has any of the required roles
 * DEVELOPER always passes all checks!
 * ADMINISTRATOR always passes all checks! (server-side sudah check gas station access)
 * OWNER_GROUP memiliki permission yang sama dengan OWNER
 *
 * @param userRole - Role code dari user (dari database)
 * @param requiredRoles - Array role yang dibutuhkan (salah satu saja cukup)
 * @returns boolean - true jika user punya salah satu role
 *
 * @example
 * ```typescript
 * // Check if user is admin, owner, or manager
 * if (hasAnyRole(user.role, ["OWNER", "MANAGER"])) {
 *   // allow view
 *   // Developer, Administrator, dan Owner Group juga otomatis bisa!
 * }
 *
 * // In component/action
 * if (hasAnyRole(user.role, ["OWNER"])) {
 *   // allow delete
 *   // Developer, Administrator, dan Owner Group juga otomatis bisa!
 * }
 * ```
 */
export function hasAnyRole(
  userRole: RoleCode | undefined,
  requiredRoles: RoleCode[]
): boolean {
  if (!userRole) return false;

  // Developer bypass - always return true (pass semua hal di aplikasi)
  if (userRole === ROLES.DEVELOPER) return true;

  // Administrator bypass - always return true (pass semua hal dalam gas station milik ownernya)
  // Note: Server-side sudah check gas station access, jadi di client-side bisa langsung pass
  if (userRole === ROLES.ADMINISTRATOR) return true;

  // OWNER_GROUP memiliki permission yang sama dengan OWNER
  const normalizedRoles = requiredRoles.map(r => 
    r === ROLES.OWNER ? [ROLES.OWNER, ROLES.OWNER_GROUP] : [r]
  ).flat();

  return normalizedRoles.includes(userRole);
}

/**
 * Alias for hasAnyRole - more intuitive name
 * Universal permission checker - ONE FUNCTION FOR ALL!
 * DEVELOPER always passes all checks! (pass semua hal di aplikasi)
 * ADMINISTRATOR always passes all checks! (pass semua hal dalam gas station milik ownernya)
 * OWNER_GROUP memiliki permission yang sama dengan OWNER
 *
 * @example
 * ```typescript
 * // Simple role check
 * hasPermission(user.role, ["OWNER"])
 * // Developer, Administrator, dan Owner Group otomatis pass!
 *
 * // Multiple roles (user must have one of them)
 * hasPermission(user.role, ["OWNER", "MANAGER"])
 * // Developer, Administrator, dan Owner Group otomatis pass!
 *
 * // Usage in component
 * {hasPermission(user.role, ["OWNER"]) && (
 *   <Button onClick={handleDelete}>Delete</Button>
 * )}
 * // Developer, Administrator, dan Owner Group bisa delete juga!
 *
 * // Usage in action/service
 * if (!hasPermission(user.role, ["FINANCE"])) {
 *   throw new Error("Unauthorized");
 * }
 * // Developer dan Administrator tidak akan throw error
 * ```
 */
export function hasPermission(
  userRole: RoleCode | undefined,
  requiredRoles: RoleCode[]
): boolean {
  if (!userRole) return false;
  
  // Developer bypass
  if (userRole === ROLES.DEVELOPER) return true;
  
  // Administrator bypass
  if (userRole === ROLES.ADMINISTRATOR) return true;
  
  // OWNER_GROUP memiliki permission yang sama dengan OWNER
  const normalizedRoles = requiredRoles.map(r => 
    r === ROLES.OWNER ? [ROLES.OWNER, ROLES.OWNER_GROUP] : [r]
  ).flat();
  
  return normalizedRoles.includes(userRole);
}

/**
 * Role labels untuk display di UI
 */
export const ROLE_LABELS: Record<RoleCode, string> = {
  DEVELOPER: "Developer",
  ADMINISTRATOR: "Administrator",
  OWNER: "Owner",
  OWNER_GROUP: "Owner Group",
  MANAGER: "Manager",
  OPERATOR: "Operator",
  UNLOADER: "Unloader",
  FINANCE: "Finance",
  ACCOUNTING: "Accounting",
} as const;

/**
 * Get human-readable label for a role code
 *
 * @param role - Role code (enum string)
 * @returns Human-readable label
 *
 * @example
 * ```typescript
 * getRoleLabel("DEVELOPER") // "Developer"
 * getRoleLabel("OWNER") // "Owner"
 * ```
 */
export function getRoleLabel(role: RoleCode | string | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role as RoleCode] || role;
}
