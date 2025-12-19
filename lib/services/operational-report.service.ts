import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { TankHistoryService } from "./tank-history.service";
import {
  startOfDayUTC,
  endOfDayUTC,
  addDaysUTC,
  getDateRangeBetweenUTC,
} from "@/lib/utils/datetime";
import { OperationalService } from "./operational.service";

/**
 * @deprecated Use ReportSalesChartService for getSalesChartData
 * @deprecated Use ReportSalesService for getComprehensiveSalesReport and getAvailableProducts
 * This file is kept for backward compatibility only
 */
export class OperationalReportService {}
