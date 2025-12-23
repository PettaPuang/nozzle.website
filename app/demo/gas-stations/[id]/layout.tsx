import { notFound } from "next/navigation";
import { MockDataService } from "@/lib/utils/mock-data";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function GasStationLayout({
  children,
  params,
}: LayoutProps) {
  const { id } = await params;

  // Demo mode: hanya spbu-001 yang bisa dibuka
  if (id !== "spbu-001") {
    notFound();
  }

  const gasStation = MockDataService.getGasStationById(id);
  if (!gasStation) {
    notFound();
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {children}
    </div>
  );
}

