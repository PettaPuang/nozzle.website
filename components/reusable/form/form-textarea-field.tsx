import { FieldPath, FieldValues } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FormControl as FormControlType } from "@/lib/utils/form-types";
import { asFormControl } from "@/lib/utils/form-types";

type FormTextareaFieldProps<T extends FieldValues> = {
  control: FormControlType<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
};

export function FormTextareaField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required = false,
  rows = 3,
}: FormTextareaFieldProps<T>) {
  return (
    <FormField
      control={asFormControl(control)}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-start gap-1.5 lg:gap-3">
          <FormLabel className="text-xs lg:text-sm pt-2">
            {label} {required && <span>*</span>}
          </FormLabel>
          <div className="space-y-1">
            <FormControl>
              <Textarea
                placeholder={placeholder}
                rows={rows}
                className={cn(
                  "resize-none text-xs lg:text-sm",
                  fieldState.error && "border-red-500 focus-visible:ring-red-500"
                )}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            </FormControl>
            <FormMessage className="text-xs lg:text-sm" />
          </div>
        </FormItem>
      )}
    />
  );
}

