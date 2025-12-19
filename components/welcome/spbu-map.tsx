"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Icon, LatLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";

type Spbu = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
};

type SpbuMapProps = {
  spbus: Spbu[];
  selectedId?: string | null;
};

// Pertamina marker icon using logo PNG
const createPertaminaIcon = () => {
  return new Icon({
    iconUrl: "/picture/pertaminalogo.png",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

// Component to handle map updates
function MapUpdater({ selectedId, validSpbus, onBoundsFitted }: { selectedId?: string | null; validSpbus: Spbu[]; onBoundsFitted: () => void }) {
  const map = useMap();
  const hasFittedBounds = useRef(false);

  // Fit bounds to all markers on initial load
  useEffect(() => {
    if (!hasFittedBounds.current && validSpbus.length > 0) {
      const timer = setTimeout(() => {
        try {
          const bounds = new LatLngBounds(
            validSpbus.map((spbu) => [spbu.latitude as number, spbu.longitude as number] as [number, number])
          );
          map.fitBounds(bounds, { padding: [50, 50] });
          hasFittedBounds.current = true;
          onBoundsFitted();
        } catch (error) {
          console.error("Map fitBounds error:", error);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [map, validSpbus, onBoundsFitted]);

  // Invalidate size on mount and window resize
  useEffect(() => {
    const handleResize = () => {
      try {
        map.invalidateSize();
      } catch (error) {
        console.error("Map invalidateSize error:", error);
      }
    };

    const timer = setTimeout(handleResize, 200);
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  // Center map when selectedId changes
  useEffect(() => {
    if (selectedId) {
      const selected = validSpbus.find((spbu) => spbu.id === selectedId);
      if (selected && selected.latitude && selected.longitude) {
        try {
          map.flyTo([selected.latitude, selected.longitude], 15, {
            duration: 1,
          });
        } catch (error) {
          console.error("Map flyTo error:", error);
        }
      }
    }
  }, [selectedId, map, validSpbus]);

  return null;
}

export function SpbuMap({ spbus, selectedId }: SpbuMapProps) {
  const [mounted, setMounted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasFittedBounds, setHasFittedBounds] = useState(false);

  useEffect(() => {
    setMounted(true);
    const readyTimer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(readyTimer);
  }, []);

  // Memoize validSpbus
  const validSpbus = useMemo(
    () => spbus.filter((spbu) => spbu.latitude !== null && spbu.longitude !== null),
    [spbus]
  );

  // Calculate center from valid markers or use default
  const center: [number, number] = useMemo(() => {
    if (validSpbus.length > 0) {
      const avgLat = validSpbus.reduce((sum, spbu) => sum + (spbu.latitude as number), 0) / validSpbus.length;
      const avgLng = validSpbus.reduce((sum, spbu) => sum + (spbu.longitude as number), 0) / validSpbus.length;
      return [avgLat, avgLng];
    }
    // Default to South Sulawesi if no valid markers
    return [-3.6687994, 119.9740534];
  }, [validSpbus]);

  // Calculate default zoom based on number of markers
  const defaultZoom = useMemo(() => {
    if (validSpbus.length === 0) return 8;
    if (validSpbus.length === 1) return 15;
    return 10;
  }, [validSpbus.length]);

  // Memoize icon
  const pertaminaIcon = useMemo(() => createPertaminaIcon(), []);

  // Callback untuk menandai bounds sudah di-fit
  const handleBoundsFitted = useCallback(() => {
    setHasFittedBounds(true);
  }, []);

  // Reset fit bounds flag when validSpbus changes significantly
  useEffect(() => {
    if (validSpbus.length === 0) {
      setHasFittedBounds(false);
    }
  }, [validSpbus.length]);

  if (!mounted || !isReady) {
    return <div className="h-full w-full bg-gray-100 animate-pulse" />;
  }

  return (
    <MapContainer
      center={center}
      zoom={defaultZoom}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <MapUpdater 
        selectedId={selectedId} 
        validSpbus={validSpbus} 
        onBoundsFitted={handleBoundsFitted}
      />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {validSpbus.map((spbu) => (
        <Marker
          key={spbu.id}
          position={[spbu.latitude as number, spbu.longitude as number]}
          icon={pertaminaIcon}
        >
          <Popup>
            <div className="text-sm">
              <h3 className="font-semibold">{spbu.name}</h3>
              <p className="text-xs text-gray-600">{spbu.address}</p>
              <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                {spbu.status}
              </span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

