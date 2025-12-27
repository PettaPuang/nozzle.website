"use client";

import { DeviceFrame } from "./device-frame";
import { WelcomeIphonePreview } from "./welcome-preview";
import { StationIphonePreview } from "./station-preview";
import { TankIphonePreview } from "./tank-iphone-preview";
import { ChartIphonePreview } from "./chart-iphone-preview";

type IphoneMockupProps = {
  children?: React.ReactNode;
  type?: "welcome" | "station" | "tank" | "chart";
  flat?: boolean;
};

export function IphoneMockup({
  children,
  type,
  flat = false,
}: IphoneMockupProps) {
  // Render preview berdasarkan type
  const renderContent = () => {
    if (type === "welcome") {
      return <WelcomeIphonePreview />;
    }
    if (type === "station") {
      return <StationIphonePreview />;
    }
    if (type === "tank") {
      return <TankIphonePreview />;
    }
    if (type === "chart") {
      return <ChartIphonePreview />;
    }
    return children;
  };

  return (
    <DeviceFrame device="iphone" flat={flat}>
      {renderContent() || (
        <div className="h-full w-full flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#006FB8] to-[#005A8C] rounded-2xl flex items-center justify-center shadow-xl">
              <span className="text-3xl font-bold text-white">N</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome to Nozzl
            </h2>
          </div>
        </div>
      )}
    </DeviceFrame>
  );
}

// Alias for backward compatibility
export const IphoneLandscapeMockup = IphoneMockup;
