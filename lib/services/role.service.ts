import { ROLES, ROLE_LABELS } from "@/lib/utils/permissions";

export type RoleOption = {
  value: string;
  label: string;
};

export class RoleService {
  /**
   * Get all available roles (enum values)
   * Tidak perlu query database karena Role sekarang enum
   */
  static findAllActive(): RoleOption[] {
    return Object.values(ROLES)
      .map((role) => ({
        value: role,
        label: ROLE_LABELS[role] || role,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
}

export type ActiveRole = RoleOption;
