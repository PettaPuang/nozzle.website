"use client";

import { useState } from "react";
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/format-client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

/**
 * Format UTC date to local date string for display
 * Uses UTC methods to ensure date doesn't shift due to timezone
 */
function formatUTCDate(date: Date, formatStr: string): string {
  // Handle both Date objects and date strings
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // Use UTC methods to get date components
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth();
  const day = dateObj.getUTCDate();
  
  // Create a new Date object in local timezone with UTC values
  // This ensures format() displays the correct date without timezone shift
  const localDate = new Date(year, month, day);
  
  return format(localDate, formatStr, { locale: localeId });
}

type ExpenseData = {
  id: string;
  category: string;
  transactionDescription: string;
  entryDescription: string | null;
  amount: number;
  date: Date;
};

type ExpenseReportData = {
  byCategory: Array<{
    category: string;
    total: number;
    items: ExpenseData[];
  }>;
  totalExpenses: number;
};

type ExpenseReportTableProps = {
  report: ExpenseReportData | null;
  isLoading?: boolean;
};

export function ExpenseReportTable({
  report,
  isLoading = false,
}: ExpenseReportTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="p-2 lg:p-3">
        <div className="text-sm lg:text-base font-semibold mb-1">
          Rincian Pengeluaran
        </div>
        <div className="text-xs lg:text-sm text-muted-foreground">
          Memuat data...
        </div>
      </div>
    );
  }

  if (!report || !report.byCategory || report.byCategory.length === 0) {
    return (
      <div className="p-2 lg:p-3">
        <div className="text-sm lg:text-base font-semibold mb-1">
          Rincian Pengeluaran
        </div>
        <div className="text-xs lg:text-sm text-muted-foreground">
          Tidak ada pengeluaran pada periode ini
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 lg:p-3">
      <div className="mb-2">
        <div className="text-sm lg:text-base font-semibold">
          Rincian Pengeluaran
        </div>
        <div className="text-xs lg:text-sm text-muted-foreground">
          Detail pengeluaran per kategori
        </div>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px] lg:w-[250px] py-1.5 lg:py-2 bg-muted">
                Kategori
              </TableHead>
              <TableHead className="py-1.5 lg:py-2 min-w-[200px]">
                Deskripsi
              </TableHead>
              <TableHead className="text-right w-[120px] lg:w-[150px] py-1.5 lg:py-2">
                Jumlah (Rp)
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.byCategory.map((categoryData) => {
              const isExpanded = expandedCategories.has(categoryData.category);
              return (
                <React.Fragment key={`category-${categoryData.category}`}>
                  {/* Category Header Row */}
                  <TableRow
                    className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => toggleCategory(categoryData.category)}
                  >
                    <TableCell className="py-1.5 lg:py-2 bg-gray-50 font-semibold text-xs lg:text-sm">
                      {categoryData.category}
                    </TableCell>
                    <TableCell
                      colSpan={1}
                      className="py-1.5 lg:py-2"
                    ></TableCell>
                    <TableCell className="text-right font-mono py-1.5 lg:py-2 text-xs lg:text-sm">
                      {formatCurrency(categoryData.total)}
                    </TableCell>
                  </TableRow>

                  {/* Category Items */}
                  {isExpanded &&
                    categoryData.items.map((item, itemIdx) => (
                      <TableRow
                        key={`${item.id}-${itemIdx}`}
                        className="hover:bg-gray-50"
                      >
                        <TableCell className="py-1.5 lg:py-2 text-xs lg:text-sm">
                          {formatUTCDate(item.date, "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="py-1.5 lg:py-2 text-xs lg:text-sm whitespace-normal wrap-break-word min-w-[200px] max-w-[400px] lg:max-w-none">
                          {item.transactionDescription}
                        </TableCell>
                        <TableCell className="text-right font-mono py-1.5 lg:py-2 text-xs lg:text-sm">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                </React.Fragment>
              );
            })}

            {/* Total Row */}
            <TableRow className="bg-gray-100 font-semibold">
              <TableCell className="py-1.5 lg:py-2 bg-gray-100"></TableCell>
              <TableCell
                colSpan={1}
                className="py-1.5 lg:py-2 text-right text-xs lg:text-sm"
              >
                TOTAL PENGELUARAN:
              </TableCell>
              <TableCell className="text-right font-mono font-semibold py-1.5 lg:py-2 text-xs lg:text-sm">
                {formatCurrency(report.totalExpenses)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
