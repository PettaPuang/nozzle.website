"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Trash2, Menu, Plus } from "lucide-react";
import { ProductBadge, TankBadge } from "@/components/reusable/badges";
import { NozzleBadge } from "@/components/reusable/badges/nozzle-badge";
import { formatNumber } from "@/lib/utils/format-client";
import type { OperationalDataForClient } from "@/lib/services/operational.service";

type InfrastructureTabContentProps = {
  tanks: Array<{
    id: string;
    code: string;
    name: string;
    capacity: number;
    product: {
      id: string;
      name: string;
      ron: string | null;
      purchasePrice: number;
      sellingPrice: number;
    };
  }>;
  stations: OperationalDataForClient["stations"];
  onAddTank: () => void;
  onEditTank: (tank: any) => void;
  onDeleteTank: (id: string, name: string) => void;
  onAddStation: () => void;
  onEditStation: (station: any) => void;
  onDeleteStation: (id: string, name: string) => void;
  onAddNozzle: () => void;
  onEditNozzle: (nozzle: any) => void;
  onDeleteNozzle: (id: string, name: string) => void;
};

export function InfrastructureTabContent({
  tanks,
  stations,
  onAddTank,
  onEditTank,
  onDeleteTank,
  onAddStation,
  onEditStation,
  onDeleteStation,
  onAddNozzle,
  onEditNozzle,
  onDeleteNozzle,
}: InfrastructureTabContentProps) {
  // Flatten all nozzles from all stations
  const allNozzles = stations.flatMap((station) =>
    station.nozzles.map((nozzle) => ({
      ...nozzle,
      stationCode: station.code,
      stationName: station.name,
    }))
  );

  const totalNozzles = allNozzles.length;

  return (
    <div className="space-y-3 lg:space-y-6">
      {/* Tanks & Stations Section - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6">
        {/* Tanks Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5 lg:mb-3">
            <h3 className="text-xs lg:text-sm font-semibold">Tanks</h3>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onAddTank}
                className="text-xs lg:text-sm"
              >
                <Plus className="mr-1.5 lg:mr-2 h-3 w-3" />
                Add Tank
              </Button>
            </div>
          </div>

          {tanks.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead className="w-[50px] lg:w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tanks.map((tank) => (
                    <TableRow key={tank.id}>
                      <TableCell className="font-medium">{tank.name}</TableCell>
                      <TableCell>
                        <TankBadge
                          tankCode={tank.code}
                          productName={tank.product.name}
                        />
                      </TableCell>
                      <TableCell>
                        <ProductBadge productName={tank.product.name} />
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatNumber(tank.capacity)} L
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 lg:h-8 lg:w-8"
                            >
                              <Menu className="h-3 w-3 lg:h-4 lg:w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onEditTank(tank)}
                              className="text-xs lg:text-sm"
                            >
                              <Edit className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 text-xs lg:text-sm"
                              onClick={() => onDeleteTank(tank.id, tank.name)}
                            >
                              <Trash2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border p-4 lg:p-8 text-center">
              <p className="text-xs lg:text-sm text-muted-foreground">
                No tanks configured
              </p>
            </div>
          )}
        </div>

        {/* Stations Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5 lg:mb-3">
            <h3 className="text-xs lg:text-sm font-semibold">Stations</h3>
            <div className="flex items-center gap-1.5 lg:gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onAddStation}
                className="text-xs lg:text-sm"
              >
                <Plus className="mr-1.5 lg:mr-2 h-3 w-3" />
                Add Station
              </Button>
            </div>
          </div>

          {stations.length > 0 ? (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Tanks</TableHead>
                    <TableHead>Nozzles</TableHead>
                    <TableHead className="w-[50px] lg:w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stations.map((station) => (
                    <TableRow key={station.id}>
                      <TableCell className="font-medium">
                        {station.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{station.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-0.5 lg:gap-1">
                          {station.tankConnections.map((conn) => {
                            return (
                              <ProductBadge
                                key={conn.id}
                                productName={conn.tank.product.name}
                                label={conn.tank.code}
                              />
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-0.5 lg:gap-1">
                          {station.nozzles.map((nozzle) => (
                            <NozzleBadge
                              key={nozzle.id}
                              code={nozzle.code}
                              productName={nozzle.product.name}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 lg:h-8 lg:w-8"
                            >
                              <Menu className="h-3 w-3 lg:h-4 lg:w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onEditStation(station)}
                              className="text-xs lg:text-sm"
                            >
                              <Edit className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 text-xs lg:text-sm"
                              onClick={() =>
                                onDeleteStation(station.id, station.name)
                              }
                            >
                              <Trash2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border p-4 lg:p-8 text-center">
              <p className="text-xs lg:text-sm text-muted-foreground">
                No stations configured
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nozzles Section */}
      <div>
        <div className="flex items-center justify-between mb-1.5 lg:mb-3">
          <h3 className="text-xs lg:text-sm font-semibold">Nozzles</h3>
          <div className="flex items-center gap-1.5 lg:gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onAddNozzle}
              className="text-xs lg:text-sm"
            >
              <Plus className="mr-1.5 lg:mr-2 h-3 w-3" />
              Add Nozzle
            </Button>
          </div>
        </div>

        {allNozzles.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Tank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-[50px] lg:w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allNozzles.map((nozzle) => {
                  return (
                    <TableRow key={nozzle.id}>
                      <TableCell className="font-medium">
                        {nozzle.name || nozzle.code}
                      </TableCell>
                      <TableCell>
                        <NozzleBadge
                          code={nozzle.code}
                          productName={nozzle.product.name}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline">{nozzle.stationCode}</Badge>
                          <span className="text-xs lg:text-sm text-gray-600">
                            {nozzle.stationName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ProductBadge
                            productName={nozzle.product.name}
                            label={nozzle.tank.code}
                          />
                          <span className="text-xs lg:text-sm text-gray-600">
                            {nozzle.tank.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ProductBadge productName={nozzle.product.name} />
                          {nozzle.product.ron && (
                            <span className="text-xs lg:text-sm text-gray-600">
                              {nozzle.product.ron}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 lg:h-8 lg:w-8"
                            >
                              <Menu className="h-3 w-3 lg:h-4 lg:w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => onEditNozzle(nozzle)}
                              className="text-xs lg:text-sm"
                            >
                              <Edit className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 text-xs lg:text-sm"
                              onClick={() =>
                                onDeleteNozzle(nozzle.id, nozzle.name || nozzle.code)
                              }
                            >
                              <Trash2 className="mr-1.5 lg:mr-2 h-3 w-3 lg:h-4 lg:w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-lg border p-4 lg:p-8 text-center">
            <p className="text-xs lg:text-sm text-muted-foreground">
              No nozzles configured
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
