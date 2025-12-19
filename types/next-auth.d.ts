import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      roleCode: string; // Enum Role: DEVELOPER, ADMINISTRATOR, OWNER, MANAGER, OPERATOR, UNLOADER, FINANCE, ACCOUNTING
      assignedGasStationId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    roleCode: string; // Enum Role
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    roleCode: string; // Enum Role
    assignedGasStationId?: string;
  }
}
