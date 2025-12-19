"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StationCard } from "@/components/gas-stations/station/station-card";
import type { OperationalDataForClient } from "@/lib/services/operational.service";
import type { RoleCode } from "@/lib/utils/permissions";

type StationsTabContentProps = {
  stations: OperationalDataForClient["stations"];
  canOperate: boolean;
  gasStationId: string;
  gasStationOpenTime: string | null;
  gasStationCloseTime: string | null;
  userRole: RoleCode;
  userActiveShiftInOtherStation?: {
    stationCode: string;
    stationName: string;
    gasStationName: string;
  } | null;
  userId?: string; // Tambahkan userId untuk validasi check-out
};

export function StationsTabContent({
  stations,
  canOperate,
  gasStationId,
  gasStationOpenTime,
  gasStationCloseTime,
  userRole,
  userActiveShiftInOtherStation: initialUserActiveShiftInOtherStation,
  userId,
}: StationsTabContentProps) {
  const router = useRouter();
  const [userActiveShiftInOtherStation, setUserActiveShiftInOtherStation] = useState(
    initialUserActiveShiftInOtherStation
  );
  const prevPropRef = useRef<string | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update state ketika prop berubah (setelah refresh)
  // Gunakan JSON.stringify untuk membandingkan object secara deep
  useEffect(() => {
    const currentProp = JSON.stringify(initialUserActiveShiftInOtherStation);
    if (prevPropRef.current !== currentProp) {
      prevPropRef.current = currentProp;
      setUserActiveShiftInOtherStation(initialUserActiveShiftInOtherStation);
    }
  }, [initialUserActiveShiftInOtherStation]);

  // Handler untuk update state setelah check-in berhasil di station tertentu
  const handleCheckInSuccess = useCallback((stationCode: string, stationName: string) => {
    // Set state untuk semua station card bahwa user yang sedang login sudah check-in di station ini
    // Ini akan membuat button check-in di station lain langsung invisible
    // Hanya untuk user yang sedang login, bukan user lain
    setUserActiveShiftInOtherStation({
      stationCode,
      stationName,
      gasStationName: "", // Akan di-update setelah refresh
    });
    // Debounce refresh untuk menghindari multiple refresh calls
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
    }, 100);
  }, [router]);

  // Handler untuk update state setelah check-out berhasil
  const handleCheckOutSuccess = useCallback(() => {
    // Reset state setelah check-out, sehingga button check-in muncul kembali
    setUserActiveShiftInOtherStation(null);
    // Debounce refresh untuk menghindari multiple refresh calls
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh();
    }, 100);
  }, [router]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {stations.length > 0 ? (
        <div className="space-y-2 lg:space-y-3">
          {stations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              canOperate={canOperate}
              gasStationId={gasStationId}
              activeShift={station.activeShift}
              gasStationOpenTime={gasStationOpenTime}
              gasStationCloseTime={gasStationCloseTime}
              userRole={userRole}
              userActiveShiftInOtherStation={userActiveShiftInOtherStation}
              userId={userId}
              onCheckInSuccess={handleCheckInSuccess}
              onCheckOutSuccess={handleCheckOutSuccess}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-gray-400 mb-2">
            <svg
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <p className="text-sm text-gray-500 font-medium">Belum ada station</p>
          <p className="text-xs text-gray-400 mt-1">
            Tambahkan station baru melalui menu Settings
          </p>
        </div>
      )}
    </>
  );
}
