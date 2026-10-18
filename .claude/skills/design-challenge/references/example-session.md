<!-- ⚠️ MANAGED BY @sanofi-accelerator/ai-standards — DO NOT EDIT -->
<!-- Local changes will be overwritten on next `ai-standards sync` -->

# Example Design Challenge Session

A short walkthrough showing how the design-challenge skill drives a conversation. The user wants to add a caching layer in front of their API.

---

**User:** I want to add Redis caching in front of our `/users/:id` endpoint to reduce database load.

**Assistant (Scope):** Before I challenge the design, let me understand what exists today.

_Reads the route handler, the database query, and current response times from the codebase._

The handler queries PostgreSQL directly on every request. Average response time is ~40ms based on the middleware logging I found. **My question: What latency target are you trying to hit, and what traffic volume is driving this?** I'd recommend defining a concrete threshold — say, p95 under 15ms at 500 req/s — so we can evaluate whether caching is the right lever.

**User:** We're seeing spikes to 200ms during peak hours at around 300 req/s. Target is p95 under 50ms.

**Assistant (Assumptions):** Got it — so the steady-state is fine, it's the peak spikes that hurt. That shifts the question. **Are you assuming the spikes are caused by database load, or could it be connection pool exhaustion or query plan degradation under load?** I'd recommend ruling out connection pool limits first — I see the pool is set to `max: 10` in `db/config.ts`, which at 300 req/s could cause queuing.

**User:** Good catch. We haven't checked pool sizing. But even so, we want caching for the read-heavy profile data.

**Assistant (Trade-offs):** Fair — let's accept caching as a goal and challenge the shape of it. **What invalidation strategy are you planning? TTL-based, write-through, or event-driven?** Each has a different consistency trade-off. I'd recommend TTL with a short window (30-60s) for user profiles, since stale-for-a-minute is acceptable for read-heavy display data and it avoids coupling the write path to the cache.

**User:** TTL at 60s works. We don't need real-time consistency for profiles.

**Assistant (Failure Modes):** One more before we move on. **What happens when Redis is unavailable — does the endpoint fail, or fall back to the database?** I'd recommend a fallback-to-DB pattern with a circuit breaker so a Redis outage doesn't cascade into a full outage. I see no circuit breaker library in `package.json` today, so that would be a new dependency.

**User:** Fallback to DB, definitely. We'll add opossum for the circuit breaker.

**Assistant (Resolution):** Here's where we landed:

- **Confirmed:** Add Redis caching for `/users/:id` with 60s TTL
- **Confirmed:** Fallback to direct DB query when Redis is unavailable, using opossum circuit breaker
- **Validated assumption:** Stale-for-60s is acceptable for profile display data
- **Open risk:** Connection pool sizing (`max: 10`) may be the root cause of peak latency spikes — investigate before attributing all improvement to caching
- **Action item:** Load test with increased pool size _before_ adding Redis to isolate the actual bottleneck

If you want to formalize these decisions, hand this summary to `adr-writing`.
