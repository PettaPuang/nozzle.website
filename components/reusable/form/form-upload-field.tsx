import { useState, useEffect } from "react";
import { FieldPath, FieldValues, useWatch } from "react-hook-form";
import { Upload, Loader2, X } from "lucide-react";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { FormControl as FormControlType } from "@/lib/utils/form-types";
import { asFormControl } from "@/lib/utils/form-types";
import { toast } from "sonner";

type FormUploadFieldProps<T extends FieldValues> = {
  control: FormControlType<T>;
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  accept?: string;
  maxSize?: number; // in MB
  onFileChange?: (file: File | null) => void;
};

export function FormUploadField<T extends FieldValues>({
  control,
  name,
  label,
  required = false,
  accept = "image/*",
  maxSize = 5,
  onFileChange,
}: FormUploadFieldProps<T>) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputId = `upload-${name}`;

  // Watch field value untuk sync dengan preview
  const fieldValue = useWatch({
    control: asFormControl(control),
    name,
  });

  // Set preview dari field value ketika berubah
  useEffect(() => {
    if (fieldValue) {
      if (Array.isArray(fieldValue)) {
        setPreviews(
          (fieldValue as string[]).filter(
            (url: string) => url && url.startsWith("http")
          )
        );
      } else if (typeof fieldValue === "string") {
        // Handle string yang di-join dengan comma (dari database)
        const stringValue = fieldValue as string;
        if (stringValue.includes(",")) {
          setPreviews(
            stringValue
              .split(",")
              .filter((url: string) => url && url.trim().startsWith("http"))
          );
        } else if (stringValue.startsWith("http")) {
          setPreviews([stringValue]);
        } else {
          setPreviews([]);
        }
      } else {
        setPreviews([]);
      }
    } else {
      setPreviews([]);
    }
  }, [fieldValue]);


  return (
    <>
      <FormField
        control={asFormControl(control)}
        name={name}
        render={({ field, fieldState }) => {
          const handleFileChange = async (file: File) => {
            // Validate file size
            if (file.size > maxSize * 1024 * 1024) {
              toast.error(`Ukuran file harus kurang dari ${maxSize}MB`);
              return;
            }

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
              const previewUrl = reader.result as string;
              setPreviews((prev) => [...prev, previewUrl]);
            };
            reader.readAsDataURL(file);

            // Upload to Vercel Blob
            setUploading(true);
            try {
              const formData = new FormData();
              formData.append("file", file);

              const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
              });

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Gagal upload file");
              }

              const data = await response.json();
              const currentUrls = Array.isArray(field.value)
                ? field.value
                : field.value
                ? [field.value]
                : [];
              const newUrls = [...currentUrls, data.url];
              setPreviews(newUrls);
              // Return string if single image, array if multiple
              if (newUrls.length === 1) {
                field.onChange(newUrls[0]);
              } else {
                field.onChange(newUrls);
              }
              onFileChange?.(file);
              toast.success("Foto berhasil diupload");
            } catch (error) {
              console.error("Upload error:", error);
              toast.error(
                error instanceof Error ? error.message : "Gagal upload foto"
              );
              setPreviews((prev) => prev.slice(0, -1));
            } finally {
              setUploading(false);
            }
          };

          const handleRemoveImage = (index: number) => {
            const currentUrls = Array.isArray(field.value)
              ? field.value
              : field.value
              ? [field.value]
              : [];
            const newUrls = currentUrls.filter((_, i) => i !== index);
            setPreviews(newUrls);
            if (newUrls.length === 0) {
              field.onChange("");
            } else if (newUrls.length === 1) {
              field.onChange(newUrls[0]);
            } else {
              field.onChange(newUrls);
            }
          };


          return (
            <FormItem className="grid grid-cols-[100px_1fr] lg:grid-cols-[150px_1fr] items-center gap-1.5 lg:gap-3">
              <FormLabel className="text-xs lg:text-sm">
                {label} {required && <span>*</span>}
              </FormLabel>
              <div className="space-y-1">
                <FormControl>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept={accept}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileChange(file);
                        }
                        // Reset input agar bisa upload file yang sama lagi
                        e.target.value = "";
                      }}
                      className="hidden"
                      id={inputId}
                      disabled={uploading}
                    />

                    {/* List Foto yang sudah di-upload */}
                    {previews.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {previews.map((preview, index) => (
                          <div key={index} className="relative">
                            <Avatar className="h-16 w-16 lg:h-20 lg:w-20">
                              <AvatarImage
                                src={preview}
                                alt={`Foto ${index + 1}`}
                              />
                              <AvatarFallback>Foto</AvatarFallback>
                            </Avatar>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-1 -right-1 h-5 w-5 lg:h-6 lg:w-6 rounded-full"
                              onClick={() => handleRemoveImage(index)}
                              disabled={uploading}
                            >
                              <X className="h-3 w-3 lg:h-4 lg:w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "w-full h-16 lg:h-20 flex-col gap-1 text-xs lg:text-sm",
                        fieldState.error &&
                          "border-red-500 focus-visible:ring-red-500",
                        uploading && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() =>
                        document.getElementById(inputId)?.click()
                      }
                      disabled={uploading}
                    >
                      <div className="flex items-center gap-1.5 lg:gap-2">
                        {uploading ? (
                          <Loader2 className="h-3 w-3 lg:h-4 lg:w-4 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3 lg:h-4 lg:w-4" />
                        )}
                        <span>
                          {uploading ? "Uploading..." : "Tambah Foto"}
                        </span>
                      </div>
                      <span className="text-[10px] lg:text-xs text-muted-foreground font-normal">
                        {accept.includes("image") ? "JPG, PNG" : "File"}, max{" "}
                        {maxSize}MB
                      </span>
                    </Button>
                  </div>
                </FormControl>
                <FormMessage className="text-xs lg:text-sm" />
              </div>
            </FormItem>
          );
        }}
      />
    </>
  );
}
