import { FieldPath, FieldValues } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FormControl as FormControlType } from "@/lib/utils/form-types";
import { asFormControl } from "@/lib/utils/form-types";

type FormSelectFieldProps<T extends FieldValues> = {
  control: FormControlType<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
};

export function FormSelectField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "Pilih...",
  required = false,
  options,
  disabled = false,
}: FormSelectFieldProps<T>) {
  return (
    <FormField
      control={asFormControl(control)}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
          <FormLabel className="text-xs lg:text-sm">
            {label} {required && <span>*</span>}
          </FormLabel>
          <div className="space-y-1" suppressHydrationWarning>
            <Select
              onValueChange={field.onChange}
              value={field.value || undefined}
            >
              <FormControl>
                <SelectTrigger
                  disabled={disabled}
                  className={cn(
                    "w-full text-xs lg:text-sm",
                    fieldState.error && "border-red-500 focus:ring-red-500"
                  )}
                  suppressHydrationWarning
                >
                  <SelectValue placeholder={placeholder} />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="z-80">
                {options
                  .filter((option) => option.value !== "")
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs lg:text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <FormMessage className="text-xs lg:text-sm" />
          </div>
        </FormItem>
      )}
    />
  );
}
