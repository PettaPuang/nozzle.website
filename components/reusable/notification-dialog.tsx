"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Bell } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  getNotificationsForGasStation,
  markNotificationAsRead,
} from "@/lib/actions/notification.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  gasStationId: string | null;
  gasStation: {
    id: string;
    name: string;
  } | null;
};

type NotificationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gasStationId: string;
  gasStationName: string;
};

export function NotificationDialog({
  open,
  onOpenChange,
  gasStationId,
  gasStationName,
}: NotificationDialogProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && gasStationId) {
      fetchNotifications();
    }
  }, [open, gasStationId]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const result = await getNotificationsForGasStation(gasStationId);
      if (result.success && result.data) {
        setNotifications(result.data as Notification[]);
      } else {
        toast.error(result.message || "Gagal mengambil notifikasi");
      }
    } catch (error) {
      toast.error("Gagal mengambil notifikasi");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (markingAsRead.has(notificationId)) return;

    setMarkingAsRead((prev) => new Set(prev).add(notificationId));
    try {
      const result = await markNotificationAsRead(notificationId);
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        );
        router.refresh(); // Refresh untuk update badge count
      } else {
        toast.error(result.message || "Gagal menandai notifikasi");
      }
    } catch (error) {
      toast.error("Gagal menandai notifikasi");
    } finally {
      setMarkingAsRead((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const getNotificationTypeBadge = (type: string) => {
    switch (type) {
      case "SUBSCRIPTION_EXPIRY_WARNING":
        return (
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-200"
          >
            Peringatan
          </Badge>
        );
      case "SUBSCRIPTION_EXPIRED":
        return <Badge variant="destructive">Kedaluwarsa</Badge>;
      case "PAYMENT_FAILED":
        return <Badge variant="destructive">Pembayaran</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifikasi - {gasStationName}
          </DialogTitle>
          <DialogDescription>
            Daftar notifikasi untuk SPBU ini
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Memuat notifikasi...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada notifikasi
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "rounded-lg border p-4 transition-colors",
                    notification.isRead
                      ? "bg-muted/50"
                      : "bg-white border-orange-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getNotificationTypeBadge(notification.type)}
                        {!notification.isRead && (
                          <div className="h-2 w-2 rounded-full bg-orange-500" />
                        )}
                      </div>
                      <h4 className="font-semibold text-sm mb-1">
                        {notification.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(
                          new Date(notification.createdAt),
                          "dd MMM yyyy, HH:mm",
                          { locale: id }
                        )}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={markingAsRead.has(notification.id)}
                        className="shrink-0"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
