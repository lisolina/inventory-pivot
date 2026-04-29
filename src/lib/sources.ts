// Central registry of source links for data shown in the Command Center.
// Each entry tells the user where the data ultimately comes from.

const MASTER_SHEET_ID = "1OgqxbZYGaMVWEHJ_up-_F3fBzhaNJ8I-7jT9vhvUFwI";
const NEW_TABLES_SHEET_ID = "1nLxMpCHH8kPR4YFffSbuQky2rFEebNfwVpgZqFOC5K8";

const sheet = (id: string, gid?: number) =>
  `https://docs.google.com/spreadsheets/d/${id}/edit${gid != null ? `#gid=${gid}` : ""}`;

const SHOPIFY_ADMIN = "https://admin.shopify.com/store/lisolina-pasta";
const QBO = "https://app.qbo.intuit.com/app/homepage";
const QBO_REPORTS = "https://app.qbo.intuit.com/app/reports";

export type SourceKey =
  | "inventory"
  | "cash"
  | "cashFlows"
  | "expenses"
  | "orders"
  | "ordersFaire"
  | "ordersDTC"
  | "salesVelocity"
  | "production"
  | "margins"
  | "tasks"
  | "worldTasks"
  | "crm"
  | "dust"
  | "bankWeekly"
  | "qboDashboard"
  | "qboReports";

export const SOURCES: Record<SourceKey, { label: string; url: string }> = {
  inventory:    { label: "Master Sheet — Finished Products",   url: sheet(MASTER_SHEET_ID, 0) },
  cash:         { label: "Master Sheet — Cash",                url: sheet(NEW_TABLES_SHEET_ID) },
  cashFlows:    { label: "Master Sheet — Cash Flows",          url: sheet(NEW_TABLES_SHEET_ID) },
  expenses:     { label: "Master Sheet — Expenses",            url: sheet(NEW_TABLES_SHEET_ID) },
  orders:       { label: "Shopify Admin — Orders",             url: `${SHOPIFY_ADMIN}/orders` },
  ordersFaire:  { label: "Shopify — Faire orders",             url: `${SHOPIFY_ADMIN}/orders?query=channel%3Afaire` },
  ordersDTC:    { label: "Shopify — DTC orders",               url: `${SHOPIFY_ADMIN}/orders?query=channel%3Aonline_store` },
  salesVelocity:{ label: "Shopify — Analytics",                url: `${SHOPIFY_ADMIN}/analytics` },
  production:   { label: "Master Sheet — Production",          url: sheet(NEW_TABLES_SHEET_ID) },
  margins:      { label: "Master Sheet — Margins",             url: sheet(NEW_TABLES_SHEET_ID) },
  tasks:        { label: "Tasks (internal)",                   url: sheet(MASTER_SHEET_ID) },
  worldTasks:   { label: "World Building (internal)",          url: sheet(MASTER_SHEET_ID) },
  crm:          { label: "Sales CRM (internal)",               url: sheet(MASTER_SHEET_ID) },
  dust:         { label: "Master Sheet — Dust Launch",         url: sheet(NEW_TABLES_SHEET_ID) },
  bankWeekly:   { label: "Master Sheet — Bank & Weekly",       url: sheet(NEW_TABLES_SHEET_ID) },
  qboDashboard: { label: "QuickBooks Online",                  url: QBO },
  qboReports:   { label: "QuickBooks — Reports",               url: QBO_REPORTS },
};