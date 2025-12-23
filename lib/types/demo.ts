// Demo types - simplified types for demo experience

export type GasStationWithOwner = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  openTime: string | null;
  closeTime: string | null;
  status: "ACTIVE" | "INACTIVE";
  ownerId: string;
  owner: {
    id: string;
    username: string;
    email: string;
    profile: {
      name: string;
      avatar: string | null;
    } | null;
  };
};

export type ProductForClient = {
  id: string;
  name: string;
  ron: string | null;
  purchasePrice: number;
  sellingPrice: number;
  gasStationId: string;
};

export type UserWithDetails = {
  id: string;
  username: string;
  email: string;
  role: string;
  profile: {
    name: string;
    phone: string | null;
    address: string | null;
    avatar: string | null;
  } | null;
};

export type RoleOption = {
  value: string;
  label: string;
};

export type TankWithStock = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  currentStock: number;
  product: {
    id: string;
    name: string;
    sellingPrice: number;
  };
};

export type OperationalDataForClient = {
  stations: Array<{
    id: string;
    code: string;
    name: string;
    gasStationId: string;
    tanks: Array<{
      id: string;
      code: string;
      name: string;
      productId: string;
      capacity: number;
      currentStock: number;
      product: {
        name: string;
        sellingPrice: number;
      };
    }>;
    nozzles: Array<{
      id: string;
      code: string;
      name: string;
      tankId: string;
      productId: string;
      product: {
        name: string;
        sellingPrice: number;
      };
    }>;
  }>;
  gasStation: {
    openTime: string | null;
    closeTime: string | null;
    userActiveShiftInOtherStation: {
      stationCode: string;
      stationName: string;
      gasStationName: string;
    } | null;
  };
};

export type GasStationDetailForClient = {
  gasStation: {
    id: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    openTime: string | null;
    closeTime: string | null;
    status: "ACTIVE" | "INACTIVE";
    financeCanPurchase: boolean;
    managerCanPurchase: boolean;
  };
  stations: Array<{
    id: string;
    code: string;
    name: string;
    gasStationId: string;
  }>;
  staff: any[];
  administrators: any[];
  ownerGroups: any[];
};

export type UnloadWithRelations = any;
export type ActiveRole = any;
export type OperatorWithShifts = any;

