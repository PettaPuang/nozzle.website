"use client";

import { useState } from "react";
import { FieldPath, FieldValues } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FormControl as FormControlType } from "@/lib/utils/form-types";
import { asFormControl } from "@/lib/utils/form-types";

type FormDateFieldProps<T extends FieldValues> = {
  control: FormControlType<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  defaultValue?: string | Date;
};

export function FormDateField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = "Pilih tanggal",
  required = false,
  disabled = false,
  defaultValue,
}: FormDateFieldProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <FormField
      control={asFormControl(control)}
      name={name}
      render={({ field, fieldState }) => {
        const getDateValue = (value: any): Date | undefined => {
          if (!value) return undefined;
          if (value instanceof Date) return value;
          if (typeof value === "string" || typeof value === "number") {
            const date = new Date(value);
            return isNaN(date.getTime()) ? undefined : date;
          }
          return undefined;
        };

        const dateValue =
          getDateValue(field.value) || getDateValue(defaultValue);

        return (
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
                      disabled={disabled}
                      size="sm"
                      className={cn(
                        "w-full justify-start text-left font-normal h-8 lg:h-10 text-xs lg:text-sm",
                        !dateValue && "text-muted-foreground",
                        fieldState.error && "border-red-500 focus:ring-red-500"
                      )}
                    >
                      <CalendarIcon className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                      {dateValue ? (
                        format(dateValue, "dd MMM yyyy")
                      ) : (
                        <span>{placeholder}</span>
                      )}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1 lg:p-3" align="start">
                  <Calendar
                    mode="single"
                    selected={dateValue}
                    onSelect={(date) => {
                      field.onChange(date);
                      setOpen(false);
                    }}
                    disabled={disabled}
                    initialFocus
                    className="p-0"
                    classNames={{
                      months: "flex flex-col gap-1 lg:gap-2",
                      month: "space-y-0.5 lg:space-y-1",
                      caption:
                        "flex justify-center pt-0.5 lg:pt-1 relative items-center",
                      caption_label: "text-xs lg:text-sm font-medium",
                      nav: "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between",
                      button_previous: "h-6 w-6 lg:h-8 lg:w-8",
                      button_next: "h-6 w-6 lg:h-8 lg:w-8",
                      table: "w-full border-collapse",
                      head_row: "flex pb-0",
                      head_cell:
                        "text-[9px] lg:text-[10px] text-muted-foreground font-normal flex-1 text-center p-0 w-6 lg:w-8 leading-tight",
                      row: "flex w-full mt-0 gap-0",
                      cell: "h-5 w-5 lg:h-7 lg:w-7 text-center text-xs lg:text-sm p-0 m-0 relative flex-1",
                      day: "w-full h-5 lg:h-7 p-0 m-0 font-normal aria-selected:opacity-100 flex items-center justify-center text-xs lg:text-sm",
                      day_selected:
                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground",
                      day_outside:
                        "day-outside text-muted-foreground opacity-50",
                      day_disabled: "text-muted-foreground opacity-50",
                      day_hidden: "invisible",
                    }}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage className="text-xs lg:text-sm" />
            </div>
          </FormItem>
        );
      }}
    />
  );
}
