"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User } from "lucide-react";
import {
  FormInputField,
  FormSelectField,
  FormTextareaField,
  FormUploadField,
} from "@/components/reusable/form";
import {
  createUserWithProfileSchema,
  updateUserWithProfileSchema,
  type CreateUserWithProfileInput,
  type UpdateUserWithProfileInput,
} from "@/lib/validations/user.validation";
import { createUser, updateUser } from "@/lib/actions/user.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type RoleOption =
  | { value: string; label: string } // Format standar
  | { id: string; name: string; code: string }; // Format dari settings

type UserFormProps = {
  trigger: React.ReactNode | null;
  roles: RoleOption[]; // Menerima format fleksibel
  gasStationId?: string;
  ownerOnly?: boolean;
  staffOnly?: boolean; // Jika true, hanya tampilkan MANAGER, UNLOADER, OPERATOR, FINANCE, ACCOUNTING
  allowRoleChange?: boolean; // Default true, set false untuk disable role change
  currentUserRole?: string; // Role dari current user untuk permission check
  currentUserOwnerId?: string | null; // OwnerId dari current user (untuk admin yang membuat OWNER_GROUP/ADMINISTRATOR)
  owners?: Array<{ id: string; name: string }>; // Untuk memilih owner saat membuat ADMINISTRATOR (jika bukan ownerOnly)
  editData?: {
    id: string;
    username: string;
    email: string;
    role: string; // Role enum
    profile: {
      name: string;
      phone: string | null;
      address: string | null;
      avatar: string | null;
    } | null;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function UserForm({
  trigger,
  roles,
  gasStationId,
  ownerOnly = false,
  staffOnly = false,
  allowRoleChange = true,
  currentUserRole,
  currentUserOwnerId = null,
  owners = [],
  editData,
  open: controlledOpen,
  onOpenChange,
}: UserFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingData, setPendingData] = useState<
    CreateUserWithProfileInput | UpdateUserWithProfileInput | null
  >(null);
  const router = useRouter();

  // Use controlled open if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  // Normalize roles to standard format { value, label }
  const normalizedRoles = roles.map((role) => {
    if ("value" in role && "label" in role) {
      return role; // Sudah dalam format standar
    }
    // Format { id, name, code } -> { value, label }
    return {
      value: role.code,
      label: role.name,
    };
  });

  // Filter roles based on ownerOnly prop
  // ownerOnly = true: hanya OWNER, ADMINISTRATOR, dan OWNER_GROUP (untuk admin panel)
  // ownerOnly = false: semua role kecuali OWNER, ADMINISTRATOR, dan DEVELOPER (untuk gas station)
  // staffOnly = true: hanya MANAGER, UNLOADER, OPERATOR, FINANCE, ACCOUNTING (untuk settings card di office tab)
  let availableRoles = ownerOnly
    ? normalizedRoles.filter(
        (role) =>
          role.value === "OWNER" ||
          role.value === "ADMINISTRATOR" ||
          role.value === "OWNER_GROUP"
      )
    : staffOnly
    ? normalizedRoles.filter(
        (role) =>
          role.value === "MANAGER" ||
          role.value === "UNLOADER" ||
          role.value === "OPERATOR" ||
          role.value === "FINANCE" ||
          role.value === "ACCOUNTING"
      )
    : normalizedRoles.filter(
        (role) =>
          role.value !== "OWNER" &&
          role.value !== "ADMINISTRATOR" &&
          role.value !== "DEVELOPER"
      );

  // Filter roles based on currentUserRole
  // DEVELOPER: bisa membuat semua (OWNER, ADMINISTRATOR, OWNER_GROUP)
  // ADMINISTRATOR: bisa membuat ADMINISTRATOR dan OWNER_GROUP, tapi tidak bisa OWNER
  // OWNER_GROUP: tidak bisa membuat apa-apa (di-filter out semua)
  // Jika staffOnly = true, skip filter currentUserRole karena sudah di-filter sebelumnya
  if (!staffOnly) {
    if (currentUserRole === "ADMINISTRATOR") {
      // ADMINISTRATOR bisa membuat ADMINISTRATOR dan OWNER_GROUP, tapi tidak OWNER
      availableRoles = availableRoles.filter(
        (role) => role.value === "ADMINISTRATOR" || role.value === "OWNER_GROUP"
      );
    } else if (currentUserRole !== "DEVELOPER") {
      // Untuk role selain DEVELOPER dan ADMINISTRATOR (termasuk OWNER_GROUP), filter out semua
      availableRoles = availableRoles.filter(
        (role) =>
          role.value !== "DEVELOPER" &&
          role.value !== "ADMINISTRATOR" &&
          role.value !== "OWNER_GROUP" &&
          role.value !== "OWNER"
      );
    }
    // DEVELOPER tidak perlu filter, bisa akses semua
  }

  // Get owner role for default value
  const ownerRole = availableRoles.find((role) => role.value === "OWNER");
  // Untuk ADMINISTRATOR, default ke ADMINISTRATOR jika OWNER tidak tersedia
  // Gunakan useMemo untuk menghindari perubahan reference setiap render
  const defaultRoleValue = useMemo(() => {
    if (currentUserRole === "ADMINISTRATOR") {
      return (
        (
          availableRoles.find((role) => role.value === "ADMINISTRATOR") ||
          availableRoles[0]
        )?.value || ""
      );
    }
    return ownerRole?.value || "";
  }, [currentUserRole, availableRoles, ownerRole]);

  // Watch roleId untuk show/hide ownerId field
  const form = useForm<CreateUserWithProfileInput | UpdateUserWithProfileInput>(
    {
      resolver: zodResolver(
        editData ? updateUserWithProfileSchema : createUserWithProfileSchema
      ) as any,
      defaultValues: editData
        ? {
            username: editData.username,
            email: editData.email,
            roleId: editData.role, // role sekarang adalah enum string
            ownerId: "",
            name: editData.profile?.name || "",
            phone: editData.profile?.phone || "",
            address: editData.profile?.address || "",
            avatar: editData.profile?.avatar || "",
            password: "",
            confirmPassword: "",
          }
        : {
            username: "",
            email: "",
            password: "",
            confirmPassword: "",
            roleId: ownerOnly && defaultRoleValue ? defaultRoleValue : "",
            ownerId: "",
            name: "",
            phone: "",
            address: "",
            avatar: "",
          },
    }
  );

  const selectedRoleId = form.watch("roleId");

  // Reset form ketika Sheet dibuka atau editData berubah
  useEffect(() => {
    if (open) {
      if (editData) {
        form.reset({
          username: editData.username,
          email: editData.email,
          roleId: editData.role,
          ownerId: "",
          name: editData.profile?.name || "",
          phone: editData.profile?.phone || "",
          address: editData.profile?.address || "",
          avatar: editData.profile?.avatar || "",
          password: "",
          confirmPassword: "",
        });
      } else {
        form.reset({
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
          roleId: ownerOnly && defaultRoleValue ? defaultRoleValue : "",
          ownerId: "",
          name: "",
          phone: "",
          address: "",
          avatar: "",
        });
      }
    } else {
      // Reset form ketika Sheet ditutup
      form.reset({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        roleId: ownerOnly && defaultRoleValue ? defaultRoleValue : "",
        ownerId: "",
        name: "",
        phone: "",
        address: "",
        avatar: "",
      });
      setPendingData(null);
    }
  }, [open, editData, ownerOnly, defaultRoleValue, form]);

  const handleSubmit: SubmitHandler<
    CreateUserWithProfileInput | UpdateUserWithProfileInput
  > = async (data) => {
    // For edit mode, remove password fields if empty
    const submitData = editData
      ? {
          ...data,
          ...(data.password === "" && { password: undefined }),
          ...(data.confirmPassword === "" && { confirmPassword: undefined }),
        }
      : data;
    setPendingData(
      submitData as CreateUserWithProfileInput | UpdateUserWithProfileInput
    );
    setConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingData) return;

    setLoading(true);
    try {
      // Prepare submit data - hapus roleId jika tidak boleh ubah role
      let submitData =
        editData && !allowRoleChange
          ? { ...pendingData, roleId: undefined } // Hapus roleId jika tidak boleh ubah role
          : pendingData;

      // Jika ownerOnly=true dan role adalah OWNER_GROUP atau ADMINISTRATOR,
      // set ownerId dari currentUserOwnerId (hanya untuk ADMINISTRATOR, bukan DEVELOPER)
      // DEVELOPER harus pilih owner secara manual untuk OWNER_GROUP dan ADMINISTRATOR
      if (ownerOnly && !editData && currentUserOwnerId && currentUserRole !== "DEVELOPER") {
        const roleId = (submitData as CreateUserWithProfileInput).roleId;
        if (roleId === "ADMINISTRATOR" || roleId === "OWNER_GROUP") {
          submitData = {
            ...submitData,
            ownerId: currentUserOwnerId,
          } as CreateUserWithProfileInput;
        }
      }

      // For owner creation, don't pass gasStationId
      const result = editData
        ? await updateUser(editData.id, submitData as any)
        : await createUser(
            submitData as CreateUserWithProfileInput,
            ownerOnly ? undefined : gasStationId
          );

      if (result.success) {
        toast.success(result.message);
        setConfirmDialogOpen(false);
        setOpen(false);
        form.reset({
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
          roleId: (ownerOnly && defaultRoleValue
            ? defaultRoleValue
            : "") as any,
          ownerId: "",
          name: "",
          phone: "",
          address: "",
          avatar: "",
        });
        setPendingData(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = availableRoles; // Sudah dalam format { value, label }

  return (
    <Sheet open={open} onOpenChange={setOpen} key={editData?.id || "new"}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="p-2">
        <SheetHeader className="px-2 pt-2">
          <SheetTitle className="text-base lg:text-xl">
            {editData
              ? "Edit User"
              : ownerOnly
              ? "Create New Owner"
              : "Create New User"}
          </SheetTitle>
          <SheetDescription className="text-xs lg:text-sm">
            {editData
              ? "Update user account and profile information"
              : ownerOnly
              ? "Add a new owner account with profile information"
              : "Add a new user with profile information"}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-2 lg:space-y-4 px-2 lg:px-4"
            autoComplete="off"
          >
            {/* Account Information */}
            <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
              <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                <User className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                <h3 className="font-semibold text-xs lg:text-sm">
                  Account Information
                </h3>
              </div>

              <FormInputField
                control={form.control}
                name="username"
                label="Username"
                placeholder="Enter username"
                required
              />

              <FormInputField
                control={form.control}
                name="email"
                label="Email"
                type="email"
                placeholder="Enter email"
                required
              />

              <FormSelectField
                control={form.control}
                name="roleId"
                label="Role"
                placeholder="Select role"
                options={roleOptions}
                required
                disabled={!allowRoleChange}
              />

              {/* Owner selection untuk OWNER_GROUP dan ADMINISTRATOR:
                  - DEVELOPER (ownerOnly): tampilkan untuk OWNER_GROUP dan ADMINISTRATOR (tidak punya ownerId)
                  - ADMINISTRATOR (ownerOnly): tidak tampilkan (ownerId dari session)
                  - Bukan ownerOnly: tampilkan untuk OWNER_GROUP */}
              {((selectedRoleId === "OWNER_GROUP") || 
                (selectedRoleId === "ADMINISTRATOR" && ownerOnly && currentUserRole === "DEVELOPER")) &&
               owners.length > 0 && 
               (!ownerOnly || currentUserRole === "DEVELOPER") && (
                <FormSelectField
                  control={form.control}
                  name="ownerId"
                  label="Owner"
                  placeholder="Pilih Owner"
                  options={owners.map((owner) => ({
                    value: owner.id,
                    label: owner.name,
                  }))}
                  required
                />
              )}

              <FormInputField
                control={form.control}
                name="password"
                label={
                  editData
                    ? "New Password (leave blank to keep current)"
                    : "Password"
                }
                type="password"
                placeholder={
                  editData ? "Leave blank to keep current" : "Enter password"
                }
                required={!editData}
                showPasswordToggle
              />

              <FormInputField
                control={form.control}
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                placeholder={
                  editData ? "Leave blank to keep current" : "Confirm password"
                }
                required={!editData}
                showPasswordToggle
              />
            </div>

            {/* Profile Information */}
            <div className="space-y-2 lg:space-y-3 rounded-lg border bg-card p-2 lg:p-4">
              <div className="flex items-center gap-1.5 lg:gap-2 pb-1.5 lg:pb-2 border-b">
                <User className="h-3 w-3 lg:h-4 lg:w-4 text-primary" />
                <h3 className="font-semibold text-xs lg:text-sm">
                  Profile Information
                </h3>
              </div>

              <FormUploadField
                control={form.control}
                name="avatar"
                label="Photo Profile"
                maxSize={2}
              />

              <FormInputField
                control={form.control}
                name="name"
                label="Full Name"
                placeholder="Enter full name"
                required
              />

              <FormInputField
                control={form.control}
                name="phone"
                label="Phone Number"
                type="tel"
                placeholder="+62 812 3456 7890"
              />

              <FormTextareaField
                control={form.control}
                name="address"
                label="Address"
                placeholder="Enter full address"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-1.5 lg:gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset({
                    username: "",
                    email: "",
                    password: "",
                    confirmPassword: "",
                    roleId:
                      ownerOnly && defaultRoleValue ? defaultRoleValue : "",
                    ownerId: "",
                    name: "",
                    phone: "",
                    address: "",
                    avatar: "",
                  });
                  setPendingData(null);
                  setOpen(false);
                }}
                size="sm"
                className="text-xs lg:text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                size="sm"
                className="text-xs lg:text-sm"
              >
                {loading
                  ? "Saving..."
                  : editData
                  ? "Update User"
                  : "Create User"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="p-2 lg:p-6 max-w-[90vw] lg:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base lg:text-xl">
              Konfirmasi {editData ? "Update" : "Create"} User
            </DialogTitle>
            <DialogDescription className="text-xs lg:text-sm">
              Yakin ingin {editData ? "mengupdate" : "membuat"} user{" "}
              <span className="font-semibold">{pendingData?.username}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-1.5 lg:gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={loading}
              size="sm"
              className="text-xs lg:text-sm"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={loading}
              size="sm"
              className="text-xs lg:text-sm"
            >
              {loading ? "Processing..." : "Ya, Lanjutkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
