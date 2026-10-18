<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Example Design Challenge Session — Data Model

A walkthrough showing a design challenge about schema design. The user wants to add multi-tenancy to an existing single-tenant application.

---

**User:** We need to add multi-tenancy to our app. Plan is to add a `tenant_id` column to every table and filter all queries by it.

**Assistant (Scope):** Let me look at what exists.

_Reads the schema migrations, the ORM models, and the query layer._

You have 14 tables, 6 of which have foreign key chains 3+ levels deep. The query layer uses a repository pattern with raw SQL in `src/repositories/`. **How many tenants are you expecting in the first year, and will tenants ever need to see each other's data (e.g., shared resources, cross-tenant reporting)?** I'd recommend clarifying this first — if tenants are fully isolated and count stays under 50, a schema-per-tenant approach avoids the `tenant_id` column on every table and the risk of forgetting a filter.

**User:** We expect 200+ tenants within 6 months. No cross-tenant data sharing. Schema-per-tenant won't scale for us.

**Assistant (Assumptions):** Fair — row-level filtering it is. **You're assuming every query goes through the repository layer, but I found 3 places where controllers run raw SQL directly (`src/controllers/reports.ts:42`, `src/controllers/export.ts:88`, `src/controllers/admin.ts:15`). Are you accounting for those?** I'd recommend auditing all query paths first. A single unfiltered query leaks tenant data — this is a security boundary, not just a data modeling choice.

**User:** Good catch. We'll need to fix those. But the repository pattern covers 90% of queries.

**Assistant (Trade-offs):** The 10% is where the risk lives. **Are you planning to enforce tenant isolation at the application layer (middleware that injects `tenant_id`), or at the database layer (row-level security policies)?** Application-layer filtering is simpler to implement but relies on every developer remembering to use the repository. Database-level RLS is harder to set up but catches leaked queries automatically. I'd recommend RLS given that you have raw SQL paths you can't fully control.

**User:** RLS is a good idea, but we don't have Postgres expertise on the team for that. We'll go with application-layer middleware and add a lint rule to catch raw SQL outside repositories.

**Assistant (Failure Modes):** Understood — you're accepting the risk of application-layer enforcement. **What's your plan for migrating existing data? 14 tables need a `tenant_id` backfill. Will you do it in a single migration with downtime, or a rolling migration with dual-read support?** I'd recommend a rolling approach — a single migration on tables with millions of rows will lock them and cause downtime. But rolling adds complexity: you need to handle rows that don't have `tenant_id` yet during the transition.

**User:** We can take a 30-minute maintenance window. Data volume is small — largest table is 500K rows.

**Assistant (Resolution):** Here's where we landed:

- **Confirmed:** Row-level `tenant_id` column on all 14 tables, filtered via application-layer middleware
- **Confirmed:** Single migration with maintenance window (500K rows, ~30 min acceptable)
- **Confirmed:** Lint rule to prevent raw SQL outside repository layer
- **Rejected:** Schema-per-tenant (won't scale to 200+ tenants), database-level RLS (team lacks Postgres expertise)
- **Validated assumption:** 30-minute downtime is acceptable for the migration
- **Open risk:** 3 controllers with raw SQL (`reports.ts:42`, `export.ts:88`, `admin.ts:15`) must be migrated to repository pattern before multi-tenancy goes live — a missed query leaks tenant data
- **Open risk:** Application-layer enforcement depends on all future developers using the repository pattern. The lint rule mitigates but doesn't eliminate this. Revisit RLS when Postgres expertise grows.
- **Action item:** Audit all query paths for raw SQL before starting the migration

If you want to formalize these decisions, hand this summary to `adr-writing`.
