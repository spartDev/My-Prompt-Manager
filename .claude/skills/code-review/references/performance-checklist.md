<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Performance Checklist

Quick reference for common performance issues during code review.

## Database Queries

- [ ] No N+1 query patterns (use eager loading, joins, or batch queries)
- [ ] Queries use appropriate indexes (check `EXPLAIN` plans for full scans)
- [ ] No `SELECT *` when only specific columns are needed
- [ ] Pagination on all list endpoints (no unbounded result sets)
- [ ] Connection pooling configured (not opening new connections per request)
- [ ] Transactions scoped to minimum duration

## Data Fetching

- [ ] No unbounded loops over external data sources
- [ ] API calls batched where possible (avoid sequential requests for independent data)
- [ ] Appropriate caching strategy (cache-control headers, memoization, query caching)
- [ ] Large payloads compressed (gzip/brotli)
- [ ] Timeouts configured on all external calls

## Frontend / UI

- [ ] No unnecessary re-renders (React: check deps arrays, memoization)
- [ ] Images optimized (lazy loading, appropriate formats, responsive sizes)
- [ ] Large lists virtualized (don't render 10,000 DOM nodes)
- [ ] Bundle size checked (no accidental full-library imports)
- [ ] Code splitting applied for route-level chunks
- [ ] No synchronous blocking operations in render path

## Async Operations

- [ ] CPU-intensive work offloaded (workers, queues, background jobs)
- [ ] No synchronous file I/O in request handlers
- [ ] Parallel execution where operations are independent (`Promise.all`)
- [ ] Streaming for large data transfers (don't buffer entire response in memory)

## Memory

- [ ] No large objects created in hot paths (loops, request handlers)
- [ ] Event listeners cleaned up (no memory leaks in long-lived processes)
- [ ] Caches bounded (max size, TTL eviction)
- [ ] No unbounded array growth (logs, buffers, queues)

## Common Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| N+1 queries in a loop | Use `IN` clause, join, or dataloader |
| Fetching all records then filtering in code | Filter in the query (WHERE clause) |
| Synchronous crypto/hashing in request path | Use async variants or worker threads |
| Re-rendering entire list on single item change | Memoize list items, key properly |
| Importing entire library for one function | Import specific module (`lodash/get` not `lodash`) |
| Polling when webhooks/SSE available | Use push-based updates |
