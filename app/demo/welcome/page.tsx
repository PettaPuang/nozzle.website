import { MockDataService } from "@/lib/utils/mock-data";
import { WelcomeClient } from "./client";

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  // Demo mode: use mock data, no auth required
  const gasStations = MockDataService.getGasStations();
  
  // Group owners from gas stations
  const ownersMap = new Map<string, { id: string; name: string }>();
  gasStations.forEach((gs) => {
    if (!ownersMap.has(gs.owner.id)) {
      ownersMap.set(gs.owner.id, {
        id: gs.owner.id,
        name: gs.owner.name,
      });
    }
  });
  const owners = Array.from(ownersMap.values());

  return (
    <WelcomeClient
      spbus={gasStations.map((gs) => ({
        id: gs.id,
        name: gs.name,
        address: gs.address,
        latitude: gs.latitude,
        longitude: gs.longitude,
        openTime: gs.openTime,
        closeTime: gs.closeTime,
        status: gs.status,
        ownerId: gs.owner.id,
        owner: {
          id: gs.owner.id,
          username: gs.owner.name.toLowerCase().replace(/\s+/g, "."),
          email: `${gs.owner.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          profile: {
            name: gs.owner.name,
            avatar: null,
          },
        },
      }))}
      isAdmin={false}
      userName="Demo User"
      userRole="OWNER"
      owners={owners}
      roles={[]}
      currentUser={null}
      unreadNotificationCounts={{}}
    />
  );
}

