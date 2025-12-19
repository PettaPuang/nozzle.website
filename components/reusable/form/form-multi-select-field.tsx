"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { FieldValues, Path } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ProductBadge } from "@/components/reusable/badges/product-badge";
import { cn } from "@/lib/utils";
import type { FormControl as FormControlType } from "@/lib/utils/form-types";
import { asFormControl } from "@/lib/utils/form-types";

type FormMultiSelectFieldProps<T extends FieldValues> = {
  control: FormControlType<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options: Array<{ value: string; label: string; productName?: string }>;
};

export function FormMultiSelectField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "Pilih...",
  description,
  required = false,
  options,
}: FormMultiSelectFieldProps<T>) {
  const [open, setOpen] = React.useState(false);

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
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                      "w-full justify-between font-normal h-auto min-h-10 text-xs lg:text-sm",
                      !field.value?.length && "text-muted-foreground",
                      fieldState.error && "border-red-500 focus:ring-red-500"
                    )}
                  >
                    <div className="flex gap-1 flex-wrap">
                      {field.value?.length > 0 ? (
                        field.value.map((val: string) => {
                          const option = options.find((opt) => opt.value === val);
                          if (!option) return null;
                          
                          // Gunakan ProductBadge jika ada productName, otherwise gunakan Badge biasa
                          if (option.productName) {
                            return (
                              <ProductBadge
                                key={val}
                                productName={option.productName}
                                label={option.label}
                                className="mr-1 mb-1"
                              />
                            );
                          }
                          
                          return (
                            <Badge
                              variant="secondary"
                              key={val}
                              className="mr-1 mb-1 text-xs lg:text-sm"
                            >
                              {option.label}
                            </Badge>
                          );
                        })
                      ) : (
                        <span>{placeholder}</span>
                      )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cari..." className="text-xs lg:text-sm" />
                  <CommandList>
                    <CommandEmpty className="text-xs lg:text-sm">Tidak ada data.</CommandEmpty>
                    <CommandGroup>
                      {options.map((option) => {
                        const isSelected = field.value?.includes(option.value);
                        return (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            className="text-xs lg:text-sm"
                            onSelect={() => {
                              const currentValue = field.value || [];
                              const newValue = isSelected
                                ? currentValue.filter(
                                    (val: string) => val !== option.value
                                  )
                                : [...currentValue, option.value];
                              field.onChange(newValue);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center gap-2 flex-1">
                              <span>{option.label}</span>
                              {option.productName && (
                                <ProductBadge
                                  productName={option.productName}
                                  className="ml-auto"
                                />
                              )}
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {description && <FormDescription className="text-xs lg:text-sm">{description}</FormDescription>}
            <FormMessage className="text-xs lg:text-sm" />
          </div>
        </FormItem>
      )}
    />
  );
}

