import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sharedReports = pgTable("shared_reports", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  result: jsonb("result").notNull(),
  target: text("target").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const insertSharedReportSchema = createInsertSchema(sharedReports).omit({
  id: true,
  createdAt: true,
});

export type SharedReport = typeof sharedReports.$inferSelect;
export type InsertSharedReport = z.infer<typeof insertSharedReportSchema>;
