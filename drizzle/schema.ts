import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const solutionTypeEnum = pgEnum("solution_type", [
  "website",
  "webapp",
  "saas",
]);

export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "pending",
  "done",
  "skipped",
]);

export const assetTypeEnum = pgEnum("asset_type", [
  "llms_txt",
  "schema_faq",
  "schema_software",
  "faq_draft",
  "comparison_draft",
  "robots_txt",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

export const solutions = pgTable("solutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: solutionTypeEnum("type").notNull().default("saas"),
  language: text("language").default("fr"),
  markets: jsonb("markets").$type<string[]>().default([]),
  description: text("description"),
  category: text("category"),
  personas: jsonb("personas").$type<string[]>().default([]),
  useCases: jsonb("use_cases").$type<string[]>().default([]),
  integrations: jsonb("integrations").$type<string[]>().default([]),
  keyPages: jsonb("key_pages").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const targetQueries = pgTable("target_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  solutionId: uuid("solution_id")
    .notNull()
    .references(() => solutions.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
});

export const competitors = pgTable("competitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  solutionId: uuid("solution_id")
    .notNull()
    .references(() => solutions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url"),
});

export const audits = pgTable("audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  solutionId: uuid("solution_id")
    .notNull()
    .references(() => solutions.id, { onDelete: "cascade" }),
  technicalChecks: jsonb("technical_checks").$type<Record<string, unknown>>(),
  semanticScores: jsonb("semantic_scores").$type<Record<string, number>>(),
  platformScores: jsonb("platform_scores").$type<Record<string, number>>(),
  pipelineScores: jsonb("pipeline_scores").$type<Record<string, number>>(),
  overallScore: integer("overall_score").default(0),
  ranAt: timestamp("ran_at", { mode: "date" }).defaultNow().notNull(),
});

export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  solutionId: uuid("solution_id")
    .notNull()
    .references(() => solutions.id, { onDelete: "cascade" }),
  auditId: uuid("audit_id").references(() => audits.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tier: text("tier").notNull(),
  effort: text("effort").notNull(),
  priority: text("priority").notNull(),
  assetType: assetTypeEnum("asset_type"),
  status: recommendationStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const generatedAssets = pgTable("generated_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  solutionId: uuid("solution_id")
    .notNull()
    .references(() => solutions.id, { onDelete: "cascade" }),
  type: assetTypeEnum("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const visibilityRuns = pgTable("visibility_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  solutionId: uuid("solution_id")
    .notNull()
    .references(() => solutions.id, { onDelete: "cascade" }),
  shareOfVoice: integer("share_of_voice"),
  ranAt: timestamp("ran_at", { mode: "date" }).defaultNow().notNull(),
});

export const visibilityResults = pgTable("visibility_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => visibilityRuns.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  query: text("query").notNull(),
  mentioned: boolean("mentioned").default(false),
  mentionRank: integer("mention_rank"),
  sources: jsonb("sources").$type<string[]>().default([]),
  competitorsMentioned: jsonb("competitors_mentioned")
    .$type<string[]>()
    .default([]),
  rawResponse: text("raw_response"),
});
