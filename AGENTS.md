# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # next dev --turbopack
npm run build    # next build --turbopack
npm run start    # production server
npm run lint     # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit # the ONLY real type check — see below
```

`next.config.ts` sets `typescript.ignoreBuildErrors: true`, so `npm run build` passes with type errors. Run `npx tsc --noEmit` explicitly to type-check. The repo currently type-checks and lints clean, so that flag can safely be removed.

There is no test framework, test script, or test files in this repo.

## Environment

Required vars (see README for provider links):

```
MONGODB_URI=               # needed at BUILD time — `/` is prerendered from the DB
CLOUDINARY_URL=            # SDK auto-configures from this; no cloudinary.config() call exists
NEXT_PUBLIC_POSTHOG_KEY=   # currently commented out in .env, see Analytics below
NEXT_PUBLIC_POSTHOG_HOST=  # declared but never read by any code
NEXT_PUBLIC_BASE_URL=      # no longer used by page rendering; kept for external callers
```

## Architecture

### Server Components read Mongoose directly — never fetch this app's own API

All server-side data access goes through `lib/actions/*.actions.ts` (`'use server'`), which call `connectDB()` and query models directly: `getAllEvents`, `getEventBySlug`, `getSimilarEventsBySlug` for reads, `createBooking` for writes.

**Never make a Server Component `fetch()` a `/api/...` route of this app.** A `'use cache'` page is prerendered during `next build`, when no server is listening — a self-fetch dies with `ECONNREFUSED` and fails the build. That was the original design and it broke `npm run build`; see `fix-review/README.md` for the diff and reasoning.

The `app/api/events/` route handlers still exist and remain correct for external or client-side callers. They are simply not in the path of a server render.

**Serialization is not optional.** Mongoose `.lean()` still returns `ObjectId` and `Date` instances, which cannot cross into a Client Component (`BookEvent` receives `eventId`). Actions run results through the local `toPlain()` helper (a `JSON.parse(JSON.stringify(...))` round-trip) and return `PlainEvent` — the all-strings type in `database/event.model.ts`, re-exported from `@/database`. Use `PlainEvent` for anything leaving an action; `IEvent` is the Mongoose document type and belongs only inside the model layer.

### Next.js 16 `cacheComponents` and the params-promise pattern

`next.config.ts` enables `cacheComponents: true`. Cached scopes are marked with `'use cache'` + `cacheLife('hours')` (see `app/page.tsx:7` and `components/EventDetails.tsx:37`).

Because a `'use cache'` component may not read dynamic APIs, `app/events/[slug]/page.tsx` does **not** await `params`. It passes the unresolved promise down into a `<Suspense>`-wrapped cached child, which awaits it inside the cache scope:

```tsx
const slug = params.then((p) => p.slug);   // NOT awaited here
<Suspense fallback={...}><EventDetails params={slug} /></Suspense>
```

Follow this shape for any new dynamic route that renders a cached component. Awaiting `params` in the page would opt the whole page out of caching.

Cached scopes also call `cacheTag('events')`, and `POST /api/events` calls `revalidateTag('events', 'max')` so a new event shows up right away. Any new cached read of event data should tag itself `'events'` too, or it will stay stale for up to a day.

**Known consequence:** because `EventDetails` calls `notFound()` from inside the Suspense boundary, the 200 shell has already been streamed by the time the status could change — so an unknown slug renders the not-found UI but returns **HTTP 200**, not 404. Resolving the slug in the page (outside Suspense) is what fixes it.

### Database layer

- `lib/mongodb.ts` — `connectDB()` with a `global.mongoose` cache to survive hot reloads, `bufferCommands: false`, and a one-shot retry against public DNS (1.1.1.1 / 8.8.8.8) when a `mongodb+srv://` SRV lookup hits `ECONNREFUSED`. Every API route and Server Action must `await connectDB()` before touching a model.
- `database/*.model.ts` — use the `models.X || model<IX>('X', Schema)` guard (required under hot reload). Import models via `@/database` (barrel) or directly from the model file; both are used.
- **Event**: slug is auto-generated from `title` in a `pre('save')` hook, which also normalizes `date` → `YYYY-MM-DD` and `time` → 24-hour `HH:MM`. Never set `slug` manually. Note that the hook only runs on `.save()`/`.create()` — `updateOne`/`findOneAndUpdate` bypass it.
- **Booking**: `pre('save')` verifies the referenced Event exists; unique compound index `(eventId, email)` enforces one booking per email per event. The schema has no `slug` field, so the `slug` that `createBooking` passes is silently dropped by Mongoose.
- `lib/constants.ts` is leftover static sample data that nothing imports, and one of its image paths (`/images/events-full.png`) points to a file that does not exist (the real file is `event-full.png`). The database is the only source of events.

### Styling

Tailwind v4, CSS-first — there is **no `tailwind.config`**. All theme tokens live in `app/globals.css` under `:root` and `@theme inline`. Components use semantic ids/classes (`#event-card`, `#event`, `.events`, `.pill`, `.glass`) whose rules are defined in `globals.css` with nested `@apply`, rather than long utility strings in JSX. Match that convention: add the class to `globals.css`, not a wall of utilities in the component.

`components.json` configures shadcn/ui (new-york, lucide, `@/components/ui`), but no `components/ui` directory exists yet — adding a shadcn component will create it.

### Analytics

PostHog initializes in `instrumentation-client.ts` and is proxied: `next.config.ts` rewrites `/ingest/*` to PostHog's hosts, and `skipTrailingSlashRedirect: true` is required for that proxy to work. Client components capture directly (`posthog.capture` / `captureException`, see `components/BookEvent.tsx`).

**Currently broken:** both PostHog keys are commented out in `.env`, but `instrumentation-client.ts` calls `posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!)`. The `!` satisfies TypeScript while the token is `undefined` at runtime, on every page load. Guard the init or fill in the keys. Note also that the rewrites hardcode PostHog's **US** hosts while the README instructs setting an **EU** host, and `NEXT_PUBLIC_POSTHOG_HOST` is never read by any code.

### Images

`next/image` with `res.cloudinary.com` allowlisted in `next.config.ts`. Uploads go through `POST /api/events` as `multipart/form-data`, streamed to the Cloudinary `DevEvent` folder; the resulting `secure_url` is stored as the event's `image`. That route also expects `tags` and `agenda` as JSON-encoded strings inside the form data.

`app/events/new/page.tsx` (a Client Component, linked from the Navbar as "Create Event") builds that form data. Its client validation mirrors the Event schema's required fields. A duplicate title makes the route return 409, because the slug is unique.

## Agent skills

Workflow skills from `JavaScript-Mastery-Pro/skills`, installed in `.claude/skills/`:

- [architect](.claude/skills/architect/): decides load bearing technical choices, writes specs to `docs/specs/`
- [audit](.claude/skills/audit/): bootstraps and gap fills these `AGENTS.md` files
- [check](.claude/skills/check/): verifies behavior against a spec, or runs a fresh code review
- [debug](.claude/skills/debug/): root cause bug fixing with a minimal fix
- [develop](.claude/skills/develop/): builds a feature from an approved spec
- [document](.claude/skills/document/): writes PR text, changelogs, release notes, postmortems
- [scope](.claude/skills/scope/): keeps the product scope in `docs/scope/`
- [sync](.claude/skills/sync/): keeps `AGENTS.md`, scope, and specs current after a change
- [test](.claude/skills/test/): writes tests for changed code (no test framework is set up yet)
