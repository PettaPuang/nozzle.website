import { Control, FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodTypeAny } from "zod";
import type { Resolver } from "react-hook-form";
import { z } from "zod";

/**
 * Type helper untuk Control yang lebih fleksibel dengan zodResolver
 * Mengatasi masalah type inference ketika menggunakan z.coerce.number() atau z.coerce.date()
 *
 * Masalah terjadi karena zodResolver dengan z.coerce menghasilkan tipe input/output yang berbeda,
 * sehingga TypeScript tidak bisa infer dengan benar.
 *
 * Solusi: Menggunakan Control<T, unknown> yang lebih type-safe daripada any,
 * dengan helper function untuk type assertion internal yang aman.
 *
 * @example
 * ```tsx
 * type FormInput = z.infer<typeof schema>;
 *
 * type FormFieldProps<T extends FieldValues> = {
 *   control: FormControl<T>;
 *   name: FieldPath<T>;
 * };
 * ```
 */
export type FormControl<T extends FieldValues> = Control<T, unknown>;

/**
 * Type-safe wrapper untuk FormField control prop
 * Mengatasi masalah type inference dengan zodResolver + z.coerce
 *
 * Function ini melakukan type assertion internal untuk kompatibilitas dengan resolver,
 * sambil tetap menjaga type safety di level API dengan generic T.
 *
 * @example
 * ```tsx
 * <FormField
 *   control={asFormControl(control)}
 *   name="fieldName"
 *   ...
 * />
 * ```
 */
export function asFormControl<T extends FieldValues>(
  control: Control<T, unknown> | Control<T, any>
): Control<T, unknown> {
  return control as Control<T, unknown>;
}

/**
 * Helper function untuk membuat zodResolver dengan type assertion yang aman
 * Mengatasi masalah type inference ketika menggunakan z.coerce
 *
 * Function ini melakukan type assertion internal untuk kompatibilitas dengan resolver,
 * sambil tetap menjaga type safety di level API dengan generic T.
 *
 * @example
 * ```tsx
 * const form = useForm<FormInput>({
 *   resolver: createZodResolver(createSchema),
 *   defaultValues: { ... }
 * });
 * ```
 */
export function createZodResolver<T extends FieldValues>(
  schema: ZodTypeAny
): Resolver<T> {
  return zodResolver(schema as any) as Resolver<T>;
}

/**
 * Custom Zod number type yang otomatis handle formatted string dengan thousand separators
 *
 * Karena z.preprocess() return ZodEffects (bukan ZodNumber), maka tidak bisa di-chain.
 * Gunakan function ini untuk membuat custom number schema dengan validasi yang diinginkan.
 *
 * @example
 * ```ts
 * const schema = z.object({
 *   capacity: zNumber(z.number().int().positive()),
 *   price: zNumber(z.number().int().min(0).optional()),
 * });
 * ```
 */
export function zNumber<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => {
    // Jika sudah number, return langsung
    if (typeof val === "number") {
      return val;
    }
    // Jika string, hapus thousand separators (dots) sebelum parse
    if (typeof val === "string") {
      const cleaned = val.replace(/\./g, "");
      const parsed = parseFloat(cleaned.replace(",", "."));
      return isNaN(parsed) ? 0 : parsed;
    }
    // Jika undefined/null/empty, return undefined untuk optional fields
    if (val === undefined || val === null || val === "") {
      return undefined;
    }
    return 0;
  }, schema);
}
