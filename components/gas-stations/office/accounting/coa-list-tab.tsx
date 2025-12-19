"use client";

import { useState, useEffect } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COACategoryBadge } from "@/components/reusable/badges/coa-category-badge";
import { Loader2, Plus } from "lucide-react";
import { getCOAsWithBalance, createCOA } from "@/lib/actions/coa.actions";
import { formatNumber } from "@/lib/utils/format-client";
import { toast } from "sonner";
import { COADetailSheet } from "./coa-detail-sheet";
import { Form } from "@/components/ui/form";
import { FormInputField } from "@/components/reusable/form";
import { FormSelectField } from "@/components/reusable/form/form-select-field";
import {
  createCOASchema,
  type CreateCOAInput,
} from "@/lib/validations/coa.validation";
import type { COAWithBalanceForClient } from "@/lib/services/coa.service";

const coaCategoryOptions = [
  { value: "ASSET", label: "Aset" },
  { value: "LIABILITY", label: "Kewajiban" },
  { value: "EQUITY", label: "Ekuitas" },
  { value: "REVENUE", label: "Pendapatan" },
  { value: "COGS", label: "HPP" },
  { value: "EXPENSE", label: "Beban" },
];

type COAListTabProps = {
  gasStationId: string;
};

export function COAListTab({ gasStationId }: COAListTabProps) {
  const [coas, setCoas] = useState<COAWithBalanceForClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCOA, setSelectedCOA] =
    useState<COAWithBalanceForClient | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateCOAInput>({
    resolver: zodResolver(createCOASchema),
    defaultValues: {
      gasStationId,
      code: null,
      name: "",
      category: "ASSET",
      status: "ACTIVE",
      description: null,
    },
  });

  useEffect(() => {
    fetchCOAs();
  }, [gasStationId]);

  const fetchCOAs = async () => {
    setLoading(true);
    try {
      const result = await getCOAsWithBalance(gasStationId);
      if (result.success && result.data) {
        setCoas(result.data as COAWithBalanceForClient[]);
      } else {
        toast.error(result.message || "Gagal memuat daftar COA");
      }
    } catch (error) {
      console.error("Error fetching COAs:", error);
      toast.error("Gagal memuat daftar COA");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCOA = async (data: CreateCOAInput) => {
    setSubmitting(true);
    try {
      const result = await createCOA(data);
      if (result.success) {
        toast.success(result.message || "COA berhasil dibuat");
        setCreateDialogOpen(false);
        form.reset();
        fetchCOAs();
      } else {
        toast.error(result.message || "Gagal membuat COA");
      }
    } catch (error) {
      console.error("Error creating COA:", error);
      toast.error("Gagal membuat COA");
    } finally {
      setSubmitting(false);
    }
  };

  const groupedCOAs = coas.reduce((acc, coa) => {
    if (!acc[coa.category]) {
      acc[coa.category] = [];
    }
    acc[coa.category].push(coa);
    return acc;
  }, {} as Record<string, COAWithBalanceForClient[]>);

  // Urutan kategori: COGS sebelum EXPENSE
  const categoryOrder = [
    "ASSET",
    "LIABILITY",
    "EQUITY",
    "REVENUE",
    "COGS",
    "EXPENSE",
  ];
  const sortedCategoryEntries = Object.entries(groupedCOAs).sort(
    ([catA], [catB]) => {
      const indexA = categoryOrder.indexOf(catA);
      const indexB = categoryOrder.indexOf(catB);
      // Jika kategori tidak ada di order, taruh di akhir
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-dvh flex flex-col">
        <div className="flex items-center justify-between mb-2 lg:mb-3">
          <h3 className="text-sm lg:text-base font-semibold">Chart of Accounts</h3>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            size="sm"
            className="h-7 lg:h-8 text-xs lg:text-sm"
          >
            <Plus className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-1.5" />
            Tambah COA
          </Button>
        </div>
        <div className="rounded-md border flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px] md:min-w-[220px] lg:min-w-[250px] font-semibold pl-2 md:pl-3 lg:pl-4">
                  Nama COA
                </TableHead>
                <TableHead className="w-[90px] md:w-[110px] lg:w-[130px] font-semibold">
                  Kategori
                </TableHead>
                <TableHead className="w-[160px] md:w-[180px] lg:w-[200px] font-semibold text-right">
                  Debit
                </TableHead>
                <TableHead className="w-[160px] md:w-[180px] lg:w-[200px] font-semibold text-right">
                  Kredit
                </TableHead>
                <TableHead className="w-[160px] md:w-[180px] lg:w-[200px] font-semibold text-right">
                  Saldo
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCategoryEntries.map(([category, categoryCOAs]) => (
                <React.Fragment key={category}>
                  <TableRow className="bg-muted/50">
                    <TableCell
                      colSpan={5}
                      className="font-semibold text-xs lg:text-sm py-0.5 md:py-1 lg:py-2 px-2 md:px-3 lg:px-4"
                    >
                      <COACategoryBadge category={category} />
                    </TableCell>
                  </TableRow>
                  {categoryCOAs.map((coa) => (
                    <TableRow
                      key={coa.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedCOA(coa);
                        setDetailSheetOpen(true);
                      }}
                    >
                      <TableCell className="font-medium pl-2 md:pl-3 lg:pl-4 py-0.5 md:py-1">
                        <div className="min-w-0 truncate">{coa.name}</div>
                      </TableCell>
                      <TableCell className="py-0.5 md:py-1">
                        <COACategoryBadge category={coa.category} />
                      </TableCell>
                      <TableCell className="w-[160px] md:w-[180px] lg:w-[200px] text-right font-mono whitespace-nowrap py-0.5 md:py-1">
                        {formatNumber(coa.totalDebit)}
                      </TableCell>
                      <TableCell className="w-[160px] md:w-[180px] lg:w-[200px] text-right font-mono whitespace-nowrap py-0.5 md:py-1">
                        {formatNumber(coa.totalCredit)}
                      </TableCell>
                      <TableCell className="w-[160px] md:w-[180px] lg:w-[200px] text-right font-mono font-semibold whitespace-nowrap py-0.5 md:py-1">
                        {formatNumber(coa.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
              {coas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 lg:py-12 text-xs lg:text-sm text-muted-foreground"
                  >
                    Tidak ada COA
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* COA Detail Sheet */}
      {selectedCOA && (
        <COADetailSheet
          open={detailSheetOpen}
          onOpenChange={(open) => {
            setDetailSheetOpen(open);
            if (!open) {
              setSelectedCOA(null);
            }
          }}
          coa={selectedCOA}
          onUpdate={() => {
            fetchCOAs();
          }}
        />
      )}

      {/* Create COA Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            form.reset({
              gasStationId,
              code: null,
              name: "",
              category: "ASSET",
              status: "ACTIVE",
              description: null,
            });
          }
        }}
      >
        <DialogContent className="max-w-[90%] md:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Tambah COA Baru</DialogTitle>
            <DialogDescription>
              Buat akun baru untuk gas station ini
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleCreateCOA)}
              className="space-y-4"
            >
              <FormInputField
                control={form.control}
                name="name"
                label="Nama COA"
                placeholder="Contoh: Kas Toko, Bank BCA"
                required
              />

              <FormSelectField
                control={form.control}
                name="category"
                label="Kategori"
                required
                options={coaCategoryOptions}
              />

              <FormInputField
                control={form.control}
                name="code"
                label="Kode COA"
                placeholder="Kode akun (opsional)"
              />

              <FormInputField
                control={form.control}
                name="description"
                label="Deskripsi"
                placeholder="Keterangan singkat (opsional)"
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false);
                  }}
                  disabled={submitting}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
