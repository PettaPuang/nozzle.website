"use client";

import * as React from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayPicker } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { startOfDayUTC } from "@/lib/utils/datetime";
import { cn } from "@/lib/utils";

interface DatePickerOwnerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  className?: string;
  buttonClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "default" | "sm";
}

export function DatePickerOwner({
  date,
  onSelect,
  className,
  buttonClassName,
  placeholder = "Pilih tanggal",
  disabled = false,
  size = "default",
}: DatePickerOwnerProps) {
  const [open, setOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(date || new Date());

  React.useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  React.useEffect(() => {
    if (date) {
      setMonth(date);
    }
  }, [date]);

  const CustomCaption = ({ displayMonth }: any) => {
    return (
      <div className="flex items-center justify-between px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const newDate = new Date(
              displayMonth.getFullYear(),
              displayMonth.getMonth() - 1
            );
            setMonth(newDate);
          }}
          className={cn(
            "h-7 w-7 lg:h-9 lg:w-9 p-0",
            size === "sm" && "h-6 w-6 lg:h-8 lg:w-8"
          )}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 lg:h-5 lg:w-5",
              size === "sm" && "h-3 w-3 lg:h-4 lg:w-4"
            )}
          />
        </Button>
        <div
          className={cn(
            "font-medium",
            size === "sm" ? "text-xs lg:text-sm" : "text-sm lg:text-base"
          )}
        >
          {displayMonth.toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const newDate = new Date(
              displayMonth.getFullYear(),
              displayMonth.getMonth() + 1
            );
            setMonth(newDate);
          }}
          className={cn(
            "h-7 w-7 lg:h-9 lg:w-9 p-0",
            size === "sm" && "h-6 w-6 lg:h-8 lg:w-8"
          )}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 lg:h-5 lg:w-5",
              size === "sm" && "h-3 w-3 lg:h-4 lg:w-4"
            )}
          />
        </Button>
      </div>
    );
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            size={size === "sm" ? "sm" : "default"}
            className={cn(
              "w-full justify-start text-left font-normal",
              size === "sm" ? "h-8 lg:h-10 text-xs lg:text-sm" : "h-10 text-sm",
              !date && "text-muted-foreground",
              buttonClassName
            )}
            disabled={disabled}
          >
            <CalendarIcon
              className={cn(
                "mr-1.5 lg:mr-2",
                size === "sm" ? "h-3 w-3 lg:h-4 lg:w-4" : "h-4 w-4"
              )}
            />
            {date ? (
              format(date, size === "sm" ? "dd MMM yyyy" : "d MMM yyyy", {
                locale: id,
              })
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "w-auto p-0",
            size === "sm" && "p-2 lg:p-4",
            isMobile && "max-w-[95vw] max-h-[85vh] overflow-y-auto"
          )}
          align="start"
          side={isMobile ? "left" : "bottom"}
          sideOffset={4}
          collisionPadding={8}
        >
          <div className="p-2">
            <CustomCaption displayMonth={month} />
            <DayPicker
              mode="single"
              selected={date}
              onSelect={(selectedDate) => {
                if (selectedDate) {
                  // Convert local date to UTC start of day
                  const utcDate = startOfDayUTC(
                    new Date(
                      Date.UTC(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth(),
                        selectedDate.getDate(),
                        0,
                        0,
                        0,
                        0
                      )
                    )
                  );
                  onSelect?.(utcDate);
                } else {
                  onSelect?.(undefined);
                }
                setOpen(false);
              }}
              month={month}
              onMonthChange={setMonth}
              showOutsideDays
              className={size === "sm" ? "p-0" : "p-1"}
              classNames={{
                root: "w-full",
                months: "flex flex-col gap-2 lg:gap-3 w-full",
                month: "space-y-1 lg:space-y-2 w-full",
                month_caption: "hidden",
                caption: "hidden",
                nav: "hidden",
                month_grid: "w-full mt-2",
                weekdays: "flex w-full",
                weekday:
                  "text-[10px] lg:text-xs text-muted-foreground font-normal flex-1 text-center p-1 w-8 lg:w-10 leading-tight",
                week: "flex w-full mt-1 gap-0",
                day: "h-7 w-7 lg:h-9 lg:w-9 text-center text-sm lg:text-base p-0 m-0 relative flex-1",
                day_button:
                  "w-full h-full p-0 m-0 font-normal flex items-center justify-center text-sm lg:text-base hover:bg-accent hover:text-accent-foreground rounded-md transition-colors",
                selected:
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-medium",
                today: "bg-accent text-accent-foreground font-medium",
                outside: "text-muted-foreground opacity-50",
                disabled: "text-muted-foreground opacity-50",
                hidden: "invisible",
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
