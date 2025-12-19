import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getRoleLabel, type RoleCode } from "@/lib/utils/permissions";

type RoleBadgeProps = {
  role: RoleCode | string;
  className?: string;
  showLabel?: boolean;
};

const roleConfig = {
  DEVELOPER: {
    label: "Developer",
    bg: "#7C3AED",
    text: "#FFFFFF",
  },
  ADMINISTRATOR: {
    label: "Administrator",
    bg: "#DC2626",
    text: "#FFFFFF",
  },
  OWNER: {
    label: "Owner",
    bg: "#059669",
    text: "#FFFFFF",
  },
  OWNER_GROUP: {
    label: "Owner Group",
    bg: "#0891B2",
    text: "#FFFFFF",
  },
  MANAGER: {
    label: "Manager",
    bg: "#EA580C",
    text: "#FFFFFF",
  },
  OPERATOR: {
    label: "Operator",
    bg: "#2563EB",
    text: "#FFFFFF",
  },
  UNLOADER: {
    label: "Unloader",
    bg: "#7C2D12",
    text: "#FFFFFF",
  },
  FINANCE: {
    label: "Finance",
    bg: "#BE185D",
    text: "#FFFFFF",
  },
  ACCOUNTING: {
    label: "Accounting",
    bg: "#B45309",
    text: "#FFFFFF",
  },
} as const;

export function RoleBadge({
  role,
  className,
  showLabel = true,
}: RoleBadgeProps) {
  const config =
    roleConfig[role as keyof typeof roleConfig] || {
      label: getRoleLabel(role),
      bg: "#6B7280",
      text: "#FFFFFF",
    };

  return (
    <Badge
      className={cn("border font-medium", className)}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.bg,
      }}
    >
      {showLabel ? config.label : role}
    </Badge>
  );
}

export function getRoleColorScheme(role: RoleCode | string) {
  return (
    roleConfig[role as keyof typeof roleConfig] || {
      label: getRoleLabel(role),
      bg: "#6B7280",
      text: "#FFFFFF",
    }
  );
}

