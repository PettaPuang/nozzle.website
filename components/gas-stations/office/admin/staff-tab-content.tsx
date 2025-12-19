"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, Menu } from "lucide-react";
import { RoleBadge } from "@/components/reusable/badges/role-badge";
import type { OperationalDataForClient } from "@/lib/services/operational.service";

type StaffTabContentProps = {
  gasStation: {
    ownerId: string;
    owner: {
      id: string;
      username: string;
      email: string;
      role?: string;
      profile?: {
        name: string;
        phone?: string | null;
      } | null;
    };
  };
  staff: Array<{
    id: string;
    username: string;
    email: string;
    role: string; // Role enum: DEVELOPER, ADMINISTRATOR, OWNER, etc.
    profile?: {
      name: string;
      phone?: string | null;
    } | null;
  }>;
  administrators?: Array<{
    id: string;
    username: string;
    email: string;
    profile?: {
      name: string;
      phone?: string | null;
    } | null;
  }>;
  ownerGroups?: Array<{
    id: string;
    username: string;
    email: string;
    profile?: {
      name: string;
      phone?: string | null;
    } | null;
  }>;
  onAddStaff: () => void;
  onEditStaff: (user: any) => void;
  onDeleteStaff: (id: string, name: string) => void;
};

export function StaffTabContent({
  gasStation,
  staff,
  administrators = [],
  ownerGroups = [],
  onAddStaff,
  onEditStaff,
  onDeleteStaff,
}: StaffTabContentProps) {
  return (
    <div className="space-y-3 lg:space-y-6">
      {/* Owner Section - Table */}
      <div>
        <div className="flex items-center justify-between mb-1.5 lg:mb-3">
          <h3 className="text-xs lg:text-sm font-semibold">Owner</h3>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Username</TableHead>
                <TableHead className="w-[20%]">Name</TableHead>
                <TableHead className="w-[15%]">Role</TableHead>
                <TableHead className="w-[35%]">Contact</TableHead>
                <TableHead className="w-[10%] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Owner Row */}
              <TableRow>
                <TableCell className="font-medium">
                  {gasStation.owner.username}
                </TableCell>
                <TableCell>
                  {gasStation.owner.profile?.name || "-"}
                </TableCell>
                <TableCell>
                  <RoleBadge role="OWNER" className="text-[9px] lg:text-xs" />
                </TableCell>
                <TableCell>
                  <div>{gasStation.owner.email}</div>
                  {gasStation.owner.profile?.phone && (
                    <div className="text-[9px] lg:text-xs text-muted-foreground">
                      {gasStation.owner.profile.phone}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 lg:h-8 lg:w-8"
                      >
                        <Menu className="h-3 w-3 lg:h-4 lg:w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onEditStaff({
                          id: gasStation.owner.id ?? gasStation.ownerId,
                          username: gasStation.owner.username,
                          email: gasStation.owner.email,
                          role: gasStation.owner.role ?? "OWNER",
                          profile: gasStation.owner.profile,
                        })}
                        className="text-xs lg:text-sm"
                      >
                        <Edit className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                        Edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              {/* Owner Groups Rows */}
              {ownerGroups.map((og) => (
                <TableRow key={og.id}>
                  <TableCell className="font-medium">
                    {og.username}
                  </TableCell>
                  <TableCell>
                    {og.profile?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role="OWNER_GROUP" className="text-[9px] lg:text-xs" />
                  </TableCell>
                  <TableCell>
                    <div>{og.email}</div>
                    {og.profile?.phone && (
                      <div className="text-[9px] lg:text-xs text-muted-foreground">
                        {og.profile.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 lg:h-8 lg:w-8"
                        >
                          <Menu className="h-3 w-3 lg:h-4 lg:w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onEditStaff({
                            id: og.id,
                            username: og.username,
                            email: og.email,
                            role: "OWNER_GROUP",
                            profile: og.profile,
                          })}
                          className="text-xs lg:text-sm"
                        >
                          <Edit className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 text-xs lg:text-sm"
                          onClick={() =>
                            onDeleteStaff(
                              og.id,
                              og.profile?.name || og.username
                            )
                          }
                        >
                          <Trash2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {/* Administrators Rows */}
              {administrators.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">
                    {admin.username}
                  </TableCell>
                  <TableCell>
                    {admin.profile?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role="ADMINISTRATOR" className="text-[9px] lg:text-xs" />
                  </TableCell>
                  <TableCell>
                    <div>{admin.email}</div>
                    {admin.profile?.phone && (
                      <div className="text-[9px] lg:text-xs text-muted-foreground">
                        {admin.profile.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 lg:h-8 lg:w-8"
                        >
                          <Menu className="h-3 w-3 lg:h-4 lg:w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onEditStaff({
                            id: admin.id,
                            username: admin.username,
                            email: admin.email,
                            role: "ADMINISTRATOR",
                            profile: admin.profile,
                          })}
                          className="text-xs lg:text-sm"
                        >
                          <Edit className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 text-xs lg:text-sm"
                          onClick={() =>
                            onDeleteStaff(
                              admin.id,
                              admin.profile?.name || admin.username
                            )
                          }
                        >
                          <Trash2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {/* Empty State */}
              {ownerGroups.length === 0 && administrators.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs lg:text-sm text-muted-foreground">
                    No owner group or admin
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Staff Section */}
      <div>
        <div className="flex items-center justify-between mb-1.5 lg:mb-3">
          <h3 className="text-xs lg:text-sm font-semibold">Assigned Staff</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={onAddStaff}
            className="text-xs lg:text-sm"
          >
            <Plus className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-3 lg:w-3" />
            Assign
          </Button>
        </div>

        {staff.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Username</TableHead>
                  <TableHead className="w-[20%]">Name</TableHead>
                  <TableHead className="w-[15%]">Role</TableHead>
                  <TableHead className="w-[35%]">Contact</TableHead>
                  <TableHead className="w-[10%] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.username}
                    </TableCell>
                    <TableCell>
                      {user.profile?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <RoleBadge
                        role={user.role}
                        className="text-[9px] lg:text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <div>{user.email}</div>
                      {user.profile?.phone && (
                        <div className="text-[9px] lg:text-xs text-muted-foreground">
                          {user.profile.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 lg:h-8 lg:w-8"
                          >
                            <Menu className="h-3 w-3 lg:h-4 lg:w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onEditStaff(user)}
                            className="text-xs lg:text-sm"
                          >
                            <Edit className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 text-xs lg:text-sm"
                            onClick={() =>
                              onDeleteStaff(
                                user.id,
                                user.profile?.name || user.username
                              )
                            }
                          >
                            <Trash2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-lg border p-4 lg:p-8 text-center">
            <p className="text-xs lg:text-sm text-muted-foreground">
              No staff assigned yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
