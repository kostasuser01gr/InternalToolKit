/**
 * Predefined import mapping profiles for known file formats.
 * These provide default column→field mappings for common export files.
 */

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: string;
}

export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  importType: string;
  sheetName?: string;
  mappings: ColumnMapping[];
}

export const BOOKINGS_TEMPLATE: ImportTemplate = {
  id: "bookings-europcar-xlsx",
  name: "Bookings.xlsx (Bookings sheet)",
  description: "Europcar/Goldcar bookings export — standard 77-column format",
  importType: "bookings",
  sheetName: "Bookings",
  mappings: [
    { sourceColumn: "Status", targetField: "status" },
    { sourceColumn: "Agr. no", targetField: "agreementNumber" },
    { sourceColumn: "Confirmation no", targetField: "confirmationNumber" },
    { sourceColumn: "Voucher no", targetField: "voucherNumber" },
    { sourceColumn: "Check-out Date", targetField: "checkOutDate", transform: "parseDate" },
    { sourceColumn: "Check-in Date", targetField: "checkInDate", transform: "parseDate" },
    { sourceColumn: "Days", targetField: "durationDays", transform: "parseInt" },
    { sourceColumn: "C/O station", targetField: "checkOutStation" },
    { sourceColumn: "C/I station", targetField: "checkInStation" },
    { sourceColumn: "Model", targetField: "vehicleModel" },
    { sourceColumn: "Group", targetField: "vehicleGroup" },
    { sourceColumn: "Rate code", targetField: "rateCode" },
    { sourceColumn: "Rate name", targetField: "rateName" },
    { sourceColumn: "Program code", targetField: "programCode" },
    { sourceColumn: "Program name", targetField: "programName" },
    { sourceColumn: "Brand", targetField: "brand" },
    { sourceColumn: "Agent", targetField: "agent" },
    { sourceColumn: "Driver First Name", targetField: "driverFirstName" },
    { sourceColumn: "Driver Last Name", targetField: "driverLastName" },
    { sourceColumn: "Driver Email", targetField: "driverEmail" },
    { sourceColumn: "Driver Phone", targetField: "driverPhone" },
    { sourceColumn: "Flight", targetField: "flightNumber" },
  ],
};

export const VEHICLES_TEMPLATE: ImportTemplate = {
  id: "vehicles-fleet-xlsx",
  name: "Vehicles.xlsx (Vehicles sheet)",
  description: "Fleet vehicles export — standard 46-column format",
  importType: "fleet",
  sheetName: "Vehicles",
  mappings: [
    { sourceColumn: "Plate", targetField: "plateNumber", transform: "normalizePlate" },
    { sourceColumn: "State", targetField: "state" },
    { sourceColumn: "Code", targetField: "code" },
    { sourceColumn: "Ownership", targetField: "ownership" },
    { sourceColumn: "Pool type", targetField: "poolType" },
    { sourceColumn: "Category", targetField: "category" },
    { sourceColumn: "Car group", targetField: "carGroup" },
    { sourceColumn: "Color", targetField: "color" },
    { sourceColumn: "Model", targetField: "model" },
    { sourceColumn: "Model year", targetField: "modelYear", transform: "parseInt" },
    { sourceColumn: "Seats", targetField: "seats", transform: "parseInt" },
    { sourceColumn: "Mileage", targetField: "mileage", transform: "parseInt" },
    { sourceColumn: "Station", targetField: "station" },
    { sourceColumn: "Vin", targetField: "vin" },
    { sourceColumn: "Keys", targetField: "keys" },
    { sourceColumn: "Stall", targetField: "stall" },
    { sourceColumn: "Insurance Expiry", targetField: "insuranceExpiry", transform: "parseDate" },
    { sourceColumn: "MOT", targetField: "motExpiry", transform: "parseDate" },
    { sourceColumn: "Road Tax", targetField: "roadTaxExpiry", transform: "parseDate" },
    { sourceColumn: "Fuel Type", targetField: "fuelType" },
    { sourceColumn: "Fuel", targetField: "fuelLevel" },
    { sourceColumn: "Insurance company", targetField: "insuranceCompany" },
    { sourceColumn: "Telematics Provider", targetField: "telematicsProvider" },
    { sourceColumn: "License Expiry Date", targetField: "licenseExpiry", transform: "parseDate" },
  ],
};

export const ALL_TEMPLATES: ImportTemplate[] = [BOOKINGS_TEMPLATE, VEHICLES_TEMPLATE];

export function findTemplate(importType: string): ImportTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.importType === importType);
}
