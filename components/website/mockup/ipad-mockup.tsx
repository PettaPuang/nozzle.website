"use client";

import { DeviceFrame } from "./device-frame";
import { TankPreview } from "./tank-preview";
import { ChartPreview } from "./chart-preview";
import { WelcomeIpadPreview } from "./welcome-ipad-preview";
import { StationIpadPreview } from "./station-ipad-preview";

type IpadMockupProps = {
  children?: React.ReactNode;
  type?: "tank" | "chart" | "welcome" | "station";
};

export function IpadMockup({ children, type }: IpadMockupProps) {
  // Render preview berdasarkan type
  const renderContent = () => {
    if (type === "tank") {
      return <TankPreview />;
    }
    if (type === "chart") {
      return <ChartPreview />;
    }
    if (type === "welcome") {
      return <WelcomeIpadPreview />;
    }
    if (type === "station") {
      return <StationIpadPreview />;
    }
    return children;
  };

  return (
    <div className="relative hidden lg:block">
      <DeviceFrame device="ipad" flat={false}>
        {renderContent() || (
          <div className="h-full w-full flex items-center justify-center">
            <div className="text-center space-y-4 p-8">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#006FB8] to-[#005A8C] rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl font-bold text-white">N</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome to Nozzl
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                SPBU Management System
              </p>
            </div>
          </div>
        )}
      </DeviceFrame>
    </div>
  );
}
