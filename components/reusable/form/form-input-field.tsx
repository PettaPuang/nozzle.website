import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { FieldPath, FieldValues } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FormControl as FormControlType } from "@/lib/utils/form-types";
import { asFormControl } from "@/lib/utils/form-types";

type FormInputFieldProps<T extends FieldValues> = {
  control: FormControlType<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "time" | "date";
  required?: boolean;
  showPasswordToggle?: boolean;
  description?: string;
  disabled?: boolean;
  inputClassName?: string;
};

export function FormInputField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  type = "text",
  required = false,
  showPasswordToggle = false,
  description,
  disabled = false,
  inputClassName,
}: FormInputFieldProps<T>) {
  const [showPassword, setShowPassword] = useState(false);
  const inputType =
    type === "password" && showPasswordToggle && showPassword ? "text" : type;

  return (
    <FormField
      control={asFormControl(control)}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
          <FormLabel className="text-xs lg:text-sm">
            {label} {required && <span>*</span>}
          </FormLabel>
          <div className="space-y-1">
            <FormControl>
              <div className="relative">
                <Input
                  type={inputType}
                  placeholder={placeholder}
                  disabled={disabled}
                  autoComplete={type === "password" ? "new-password" : type === "email" ? "email" : "off"}
                  {...field}
                  value={field.value ?? ""}
                  className={cn(
                    "text-xs lg:text-sm",
                    type === "number" && "text-right font-mono",
                    fieldState.error &&
                      "border-red-500 focus-visible:ring-red-500",
                    showPasswordToggle && "pr-10",
                    inputClassName
                  )}
                />
                {showPasswordToggle && (
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                )}
              </div>
            </FormControl>
            {description && (
              <FormDescription className="text-xs lg:text-sm text-muted-foreground">
                {description}
              </FormDescription>
            )}
            <FormMessage className="text-xs lg:text-sm" />
          </div>
        </FormItem>
      )}
    />
  );
}
