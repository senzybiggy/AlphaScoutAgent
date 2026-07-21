import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scanHistory = pgTable("scan_history", {
  id: serial("id").primaryKey(),
  target: text("target").notNull(),
  type: text("type").notNull(),
  chain: text("chain"),
  result: jsonb("result").notNull(),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertScanHistorySchema = createInsertSchema(scanHistory).omit({
  id: true,
  scannedAt: true,
});

export type ScanHistory = typeof scanHistory.$inferSelect;
export type InsertScanHistory = z.infer<typeof insertScanHistorySchema>;
