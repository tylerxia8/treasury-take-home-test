# TTB Label Verifier

An AI-powered prototype that helps TTB compliance agents verify alcohol beverage
labels against their application submissions. Upload a label image (and the
expected application data), and the tool reads the label with Claude's vision
model, compares each required field, and flags anything that needs a human look —
in a few seconds per label.

Built for the take-home brief in this repo. The interview notes drove every design
decision (see [Design decisions](#design-decisions)).

---

## What it does

- **Reads the label** — extracts brand name, class/type, alcohol content (ABV),
  net contents, bottler/producer name & address, country of origin, and the
  government warning from a photo or scan.
- **Compares to the application** — checks each field the agent entered against
  what's actually on the label, with smart matching (see below).
- **Enforces the Government Warning Statement** — verifies the mandatory federal
  warning is present, worded exactly, with the `GOVERNMENT WARNING:` heading in
  all caps. This is the most-gamed element, so the check is strict.
- **Batch mode** — upload hundreds of labels at once (plus an optional CSV of
  application data), and watch results stream in. Download a results CSV.
- **Clear verdicts** — every label gets **Pass**, **Needs review**, or **Fail**,
  with plain-language explanations of *why*.

## How it maps to the requirements

| Requirement (from the brief) | How it's met |
|---|---|
| **Results in ~5 seconds** (vendor failed at 30–40s) | One vision call per label; tuned for low latency (`effort: low`, no extended thinking, small structured output). Batch runs calls concurrently. |
| **Dead-simple UI** ("my 73-year-old mother could use it") | Large text and buttons, one obvious primary action, plain-language results, color **and** icons **and** text (not color alone). |
| **Batch uploads** (importers dump 200–300 at once) | Dedicated batch tab; bounded-concurrency processing with a live results table and CSV export. |
| **Government warning must be exact** | Compared word-for-word against the federal text (27 CFR 16.21); heading must be all caps. |
| **Judgment, not dumb matching** ("STONE'S THROW" = "Stone's Throw") | Comparison is case-, punctuation-, accent-, and whitespace-insensitive; ABV is parsed numerically; net contents are unit-normalized (750 mL = 750ml = 0.75 L). |
| **Imperfect images** (glare, angle) | Claude's vision tolerates skew/glare; the model reports an image-quality note, and low-confidence reads are routed to **Needs review** rather than passed silently. |
| **Deployed URL + source + docs** | Deploys to Vercel in one click (below); this README documents approach, tools, and assumptions. |

---

## Quick start (local)

Requires Node.js 18+.

```bash
npm install
cp .env.example .env.local      # then add your key (see below)
npm run dev                     # http://localhost:3000
```

Open http://localhost:3000.

### Configuration

Set these in `.env.local` (only `ANTHROPIC_API_KEY` is needed to start):

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | _(none)_ | Your Anthropic API key from [console.anthropic.com](https://console.anthropic.com). **If unset, the app runs in demo/mock mode** and returns sample results so you can click through the UI without a key. |
| `ANTHROPIC_MODEL` | `claude-opus-4-8` | Vision model. Use `claude-sonnet-4-6` or `claude-haiku-4-5` for lower latency/cost. |
| `EXTRACTION_EFFORT` | `low` | Reasoning effort (`low`/`medium`/`high`/`max`). `low` keeps latency near the 5s target; raise for hard or skewed images. |
| `BATCH_CONCURRENCY` | `6` | Reserved for server-side tuning. |

> **Security:** the key is read server-side only (in API routes) and is never sent
> to the browser. Don't commit `.env.local` — it's gitignored.

---

## Deploy (Vercel)

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), **New Project → Import** the repo. It auto-detects Next.js.
3. Under **Environment Variables**, add `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`).
4. **Deploy.** You get a public URL.

No other configuration is required. (Any Node host works — `npm run build && npm start`.)

---

## How to test it

Don't have label images handy? Two options:

1. **Use the included sample labels.** Open [`samples/sample-labels.html`](samples/sample-labels.html)
   in a browser and screenshot each label (or use your OS's "capture region"). One
   label is fully compliant; one has a tampered government warning so you can see a
   **Fail**. Pair them with [`samples/applications.csv`](samples/applications.csv) in batch mode.
2. **Generate labels with AI image tools** (as the brief suggests) and enter the
   matching fields by hand in single mode.

Without an API key, the app runs in **demo mode** and returns a sample result for
the example bourbon label, so you can still exercise the whole UI.

---

## Design decisions

**Extraction by the model, comparison in code.** Claude reads the label fields
*verbatim*; the match/mismatch decision is made by deterministic, auditable rules
in [`src/lib/compare.ts`](src/lib/compare.ts). For a compliance tool this matters:
an agent (or an auditor) can see exactly *why* two values were treated as equal,
the rules are unit-testable, and it avoids a second model round-trip — which helps
the 5-second budget. Dave's "STONE'S THROW vs Stone's Throw" example is handled by
normalization, not by asking the model to "use judgment."

**The government warning is checked separately and strictly.** It's the one element
people deliberately tamper with (Jenny's interview). It's compared against the
canonical federal text in [`src/lib/warning.ts`](src/lib/warning.ts), and a problem
there is a hard **Fail**, not a soft review.

**Three verdicts, not pass/fail.** Compliance is judgment work (Dave again). A
mismatch or an unreadable image becomes **Needs review** so an agent makes the call;
only a clean match is an auto-**Pass**, and only a mandatory-element violation is a
hard **Fail**.

**Batch is client-driven.** The browser calls the single-label endpoint once per
image with bounded concurrency. Each serverless call stays short (well under
platform timeouts even for a 300-label batch), results stream in as they finish,
and one slow/oversized image can't block the rest.

**Model choice.** Default is Claude Opus 4.8 for the best vision and edge-case
judgment, configurable down to Sonnet/Haiku for latency. Effort is set to `low`
and extended thinking is off to stay near the 5-second target; both are easy to
raise for harder image sets.

## Architecture

```
src/
  app/
    page.tsx               # UI shell: tabs, mock-mode banner
    api/verify/route.ts    # POST: verify one label (image + expected fields)
    api/config/route.ts    # GET: reports mock mode + model to the UI
  lib/
    extract.ts             # Claude vision call → structured fields (+ mock mode)
    compare.ts             # deterministic field comparison & normalization
    warning.ts             # canonical TTB warning + strict exact-match check
    verify.ts              # orchestrates extract → compare → verdict
    csv.ts                 # parse application CSV, match rows to images
    pool.ts                # bounded-concurrency helper for batch
    types.ts               # shared domain types
  components/               # SingleForm, BatchPanel, ResultDetails, ImagePicker, ui
```

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · `@anthropic-ai/sdk`
with structured outputs (JSON schema) · Zod for response validation.

## Assumptions & limitations

- **Standalone prototype.** No COLA integration (per Marcus's interview); the agent
  supplies the application data via the form or a CSV. No data is persisted.
- **Network egress.** Marcus noted TTB's firewall blocks many outbound endpoints.
  This prototype calls the Anthropic API and assumes the deployment host can reach
  it; a production deployment inside TTB would need that egress allow-listed (or a
  FedRAMP-authorized model endpoint). Documented as a known constraint.
- **Warning check is text-based.** It verifies wording and heading capitalization,
  which it can read from the image. It does **not** measure font size or true bold
  rendering (TTB also requires those) — those would need pixel-level layout
  analysis and are out of scope for the prototype; flagged for follow-up.
- **Beverage-type-specific rules** (e.g. ABV optional for some wines/beers) are not
  yet enforced; the tool checks whatever fields the application provides plus the
  universally-mandatory warning.
- **Image limits:** up to 12 MB per image, JPEG/PNG/WEBP/GIF. Extremely large
  images may need downsizing.
- **Mock mode** returns a fixed sample result and does not analyze the uploaded
  image — it exists only so the UI is testable without a key.
