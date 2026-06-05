import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const domainObservations = sqliteTable(
  "domain_observations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    host: text("host").notNull(),
    category: text("category").notNull(),
    score: integer("score").notNull().default(0),
    observedCount: integer("observed_count").notNull().default(1),
    selectedCount: integer("selected_count").notNull().default(0),
    lastObservedAt: text("last_observed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    hostCategoryIdx: uniqueIndex("domain_observations_host_category_idx").on(table.host, table.category),
  }),
);

export const ruleExports = sqliteTable("rule_exports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target: text("target").notNull(),
  ruleCount: integer("rule_count").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
