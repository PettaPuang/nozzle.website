"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, Package, X } from "lucide-react";
import { ProductForm } from "./product-form";
import { PertaminaStripes } from "@/components/ui/pertamina-stripes";
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/lib/actions/product.actions";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/format-client";
import { cn } from "@/lib/utils";
import { getProductColor } from "@/lib/utils/product-colors";

type ProductListSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gasStationId: string;
  products: Array<{
    id: string;
    name: string;
    ron?: string | null;
    purchasePrice: number;
    sellingPrice: number;
  }>;
  inline?: boolean;
};

export function ProductListSheet({
  open,
  onOpenChange,
  gasStationId,
  products = [],
  inline = false,
}: ProductListSheetProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<
    ProductListSheetProps["products"][0] | null
  >(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const handleSubmit = async (data: any, id?: string) => {
    if (id) {
      // Update existing product
      const result = await updateProduct(id, data);
      if (result.success) {
        setFormOpen(false);
        setEditingProduct(null);
        router.refresh();
      } else {
        alert(result.message);
      }
    } else {
      // Create new product
      const result = await createProduct(data);
      if (result.success) {
        setFormOpen(false);
        router.refresh();
      } else {
        alert(result.message);
      }
    }
  };

  const handleEdit = (product: ProductListSheetProps["products"][0]) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleDeleteClick = (productId: string) => {
    setProductToDelete(productId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    const result = await deleteProduct(productToDelete);
    if (result.success) {
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingProduct(null);
    onOpenChange(false);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingProduct(null);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  if (inline) {
    return (
      <div className="h-full flex flex-col">
        {/* Content */}
        <div className="flex-1 p-3 lg:p-6 space-y-2 lg:space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-sm lg:text-base font-semibold">
              All Products ({products.length})
            </h3>
            <Button
              size="sm"
              onClick={handleAddNew}
              className="h-8 lg:h-9 text-xs lg:text-sm px-2 lg:px-3"
            >
              <Plus className="mr-1 lg:mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4" />
              <span className="hidden lg:inline">Add Product</span>
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {products.length > 0 ? (
              <div className="grid grid-cols-4 gap-4">
                {products.map((product) => {
                  const margin = product.sellingPrice - product.purchasePrice;
                  const marginPercent =
                    product.purchasePrice > 0
                      ? ((margin / product.purchasePrice) * 100).toFixed(1)
                      : "0";
                  const colors = getProductColor(product.name);

                  return (
                    <Card
                      key={product.id}
                      className={cn(
                        "border-2 overflow-hidden hover:shadow-lg transition-shadow",
                        colors.border
                      )}
                    >
                      {/* Card Header dengan gradient */}
                      <CardHeader
                        className={cn("py-2 lg:py-3 px-2 lg:px-4", colors.bg)}
                        style={{
                          color: colors.hex.text,
                        }}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="font-bold text-sm lg:text-base text-left hover:opacity-80 transition-opacity"
                              style={{
                                color: colors.hex.text,
                              }}
                              suppressHydrationWarning
                            >
                              {product.name}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={() => handleEdit(product)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(product.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>

                      {/* Card Content */}
                      <CardContent className="pt-1 pb-1.5 lg:pb-1 px-2 lg:px-4 space-y-0.5 lg:space-y-1">
                        {/* Harga Beli */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] lg:text-xs text-gray-600">
                            Harga Beli
                          </span>
                          <span className="font-semibold text-xs lg:text-sm text-gray-900 font-mono">
                            {formatCurrency(product.purchasePrice)}
                          </span>
                        </div>

                        {/* Harga Jual */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] lg:text-xs text-gray-600">
                            Harga Jual
                          </span>
                          <span className="font-semibold text-xs lg:text-sm text-gray-900 font-mono">
                            {formatCurrency(product.sellingPrice)}
                          </span>
                        </div>

                        {/* Margin - Highlighted */}
                        <div className="pt-1.5 lg:pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] lg:text-xs font-medium text-gray-700">
                              Margin
                            </span>
                            <div className="text-right">
                              <div className="font-bold text-xs lg:text-sm text-green-600 font-mono">
                                {formatCurrency(margin)}
                              </div>
                              <div className="text-[10px] lg:text-xs text-green-600">
                                ({marginPercent}%)
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs lg:text-sm text-gray-500 py-8 lg:py-10 border rounded">
                <Package className="h-8 w-8 lg:h-12 lg:w-12 mx-auto mb-2 opacity-20" />
                <p>No products yet. Add your first product!</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Product Form - Slides from bottom over the list */}
        <ProductForm
          open={formOpen}
          onClose={handleFormClose}
          onSubmit={handleSubmit}
          gasStationId={gasStationId}
          editData={editingProduct || undefined}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hapus Product?</DialogTitle>
              <DialogDescription>
                Apakah Anda yakin ingin menghapus product ini? Tindakan ini
                tidak dapat dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop - Full Screen */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-100 transition-opacity"
          onClick={handleClose}
        />
      )}

      {/* Sliding Panel - Product List - Optimized for tablet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 bg-white border-t shadow-2xl z-110 transition-transform duration-300 ease-in-out",
          open ? "translate-y-0" : "translate-y-full",
          "w-[50%] lg:w-[40%]" // Tablet 50%, Desktop 40%
        )}
        style={{ height: "100%" }}
      >
        {/* Header */}
        <div className="bg-white relative border-b">
          <div className="px-3 lg:px-6 py-2 lg:py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base lg:text-lg font-semibold">
                  Product Management
                </h2>
                <p className="text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">
                  Manage all products available for gas stations
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8 lg:h-10 lg:w-10"
              >
                <X className="h-4 w-4 lg:h-5 lg:w-5" />
              </Button>
            </div>
          </div>
          {/* Pertamina Color Stripes */}
          <PertaminaStripes />
        </div>

        {/* Content */}
        <div className="p-3 lg:p-6 space-y-2 lg:space-y-4 h-[calc(100%-80px)] lg:h-[calc(100%-88px)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm lg:text-base font-semibold">
              All Products ({products.length})
            </h3>
            <Button
              size="sm"
              onClick={handleAddNew}
              className="h-8 lg:h-9 text-xs lg:text-sm px-2 lg:px-3"
            >
              <Plus className="mr-1 lg:mr-2 h-3.5 w-3.5 lg:h-4 lg:w-4" />
              <span className="hidden lg:inline">Add Product</span>
            </Button>
          </div>

          <ScrollArea className="h-[calc(100%-50px)] lg:h-[calc(100%-60px)]">
            {products.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
                {products.map((product) => {
                  const margin = product.sellingPrice - product.purchasePrice;
                  const marginPercent =
                    product.purchasePrice > 0
                      ? ((margin / product.purchasePrice) * 100).toFixed(1)
                      : "0";
                  const colors = getProductColor(product.name);

                  return (
                    <Card
                      key={product.id}
                      className={cn(
                        "border-2 overflow-hidden hover:shadow-lg transition-shadow",
                        colors.border
                      )}
                    >
                      {/* Card Header dengan gradient */}
                      <CardHeader
                        className={cn("py-2 lg:py-3 px-2 lg:px-4", colors.bg)}
                        style={{
                          color: colors.hex.text,
                        }}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="font-bold text-sm lg:text-base text-left hover:opacity-80 transition-opacity"
                              style={{
                                color: colors.hex.text,
                              }}
                              suppressHydrationWarning
                            >
                              {product.name}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={() => handleEdit(product)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(product.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>

                      {/* Card Content */}
                      <CardContent className="pt-1 pb-1.5 lg:pb-1 px-2 lg:px-4 space-y-0.5 lg:space-y-1">
                        {/* Harga Beli */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] lg:text-xs text-gray-600">
                            Harga Beli
                          </span>
                          <span className="font-semibold text-xs lg:text-sm text-gray-900 font-mono">
                            {formatCurrency(product.purchasePrice)}
                          </span>
                        </div>

                        {/* Harga Jual */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] lg:text-xs text-gray-600">
                            Harga Jual
                          </span>
                          <span className="font-semibold text-xs lg:text-sm text-gray-900 font-mono">
                            {formatCurrency(product.sellingPrice)}
                          </span>
                        </div>

                        {/* Margin - Highlighted */}
                        <div className="pt-1.5 lg:pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] lg:text-xs font-medium text-gray-700">
                              Margin
                            </span>
                            <div className="text-right">
                              <div className="font-bold text-xs lg:text-sm text-green-600 font-mono">
                                {formatCurrency(margin)}
                              </div>
                              <div className="text-[10px] lg:text-xs text-green-600">
                                ({marginPercent}%)
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-xs lg:text-sm text-gray-500 py-8 lg:py-10 border rounded">
                <Package className="h-8 w-8 lg:h-12 lg:w-12 mx-auto mb-2 opacity-20" />
                <p>No products yet. Add your first product!</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Product Form - Slides from bottom over the list */}
        <ProductForm
          open={formOpen}
          onClose={handleFormClose}
          onSubmit={handleSubmit}
          gasStationId={gasStationId}
          editData={editingProduct || undefined}
        />
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Product?</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus product ini? Tindakan ini tidak
              dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
