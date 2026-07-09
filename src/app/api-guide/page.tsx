import type { Metadata } from "next";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "Wingman API — Developer Guide",
  description: "Everything a developer needs to integrate a POS or automation with Wingman.",
};

const BASE_URL = "https://www.joinwingman.app";

function Logo() {
  return (
    <span className="inline-flex items-center justify-center w-11 h-11 rounded-[12px] bg-brick shrink-0">
      <svg viewBox="520 767 104 104" width="24" height="24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path
          fill="#ffffff"
          d="M 573.839844 868.464844 L 553.496094 845.175781 C 553.113281 844.792969 552.449219 844.699219 552.070312 845.175781 L 546.460938 850.785156 C 545.222656 852.019531 543.132812 850.972656 543.039062 849.261719 L 545.605469 837.761719 L 545.890625 837.476562 L 547.316406 836.144531 L 568.324219 814.566406 C 569.085938 813.804688 568.132812 812.472656 567.183594 813.136719 L 539.617188 830.25 C 539.234375 830.441406 538.855469 830.441406 538.476562 830.15625 L 522.3125 816.941406 C 519.558594 814.183594 520.128906 809.714844 523.457031 808.289062 L 615.378906 767.984375 C 619.847656 765.988281 624.792969 770.929688 622.890625 775.492188 L 582.585938 867.324219 C 581.0625 870.652344 576.59375 871.222656 573.839844 868.464844 Z M 573.839844 868.464844 "
        />
      </svg>
    </span>
  );
}

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7 break-inside-avoid">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-white bg-charcoal rounded px-2 py-0.5">{method}</span>
        <code className="text-sm font-semibold text-ink">{path}</code>
      </div>
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-paper border border-line rounded-lg p-3 text-xs text-charcoal-2 overflow-x-auto whitespace-pre-wrap break-words my-2">
      <code>{children}</code>
    </pre>
  );
}

function FieldTable({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <table className="w-full text-sm border-collapse my-2">
      <thead>
        <tr className="text-left">
          {["Field", "Type", "Req", "Notes"].map((h) => (
            <th key={h} className="border-b border-line px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([f, t, r, n]) => (
          <tr key={f}>
            <td className="border-b border-[#F1F1F1] px-2 py-1.5"><code className="text-xs">{f}</code></td>
            <td className="border-b border-[#F1F1F1] px-2 py-1.5 text-charcoal-2 text-xs">{t}</td>
            <td className="border-b border-[#F1F1F1] px-2 py-1.5 text-xs">{r}</td>
            <td className="border-b border-[#F1F1F1] px-2 py-1.5 text-charcoal-2 text-xs">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ApiGuidePage() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <div className="mx-auto max-w-3xl px-8 py-10 print:px-0 print:py-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line pb-6 mb-8">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.02em]">Wingman API</h1>
              <p className="text-sm text-muted">Developer Integration Guide · v1</p>
            </div>
          </div>
          <PrintButton />
        </div>

        <p className="text-[15px] leading-relaxed text-charcoal-2 mb-6">
          A small REST API for syncing data between a restaurant&apos;s POS or automation tools and Wingman — for
          example, auto-populating the Revenue Growth Planner and the dashboard&apos;s Business Health metrics each
          week. This guide has everything a developer needs to build an integration.
        </p>

        {/* Auth */}
        <h2 className="text-lg font-semibold tracking-[-0.01em] mb-2 mt-8">Authentication</h2>
        <p className="text-sm text-charcoal-2 mb-2">
          Every request needs an API key in the <code className="text-xs">Authorization</code> header:
        </p>
        <Code>{`Authorization: Bearer wm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</Code>
        <ul className="text-sm text-charcoal-2 list-disc pl-5 space-y-1 mb-2">
          <li>A <strong>Super Admin</strong> creates keys in <strong>Settings → API access</strong>. The full key is shown <strong>once</strong> — copy it then.</li>
          <li><strong>Hashed at rest</strong> — Wingman stores only a SHA-256 hash, never the key.</li>
          <li><strong>Scoped to one organization</strong> — the org is derived from the key, so a key can only ever read/write that organization&apos;s data.</li>
          <li><strong>Revocable</strong> — revoking a key in Settings stops it working immediately.</li>
        </ul>
        <p className="text-sm text-charcoal-2">
          Base URL: <code className="text-xs">{BASE_URL}</code>. All requests must be HTTPS. <code className="text-xs">401</code> means
          the key is missing, malformed, or revoked. <strong>Rate limit:</strong> 120 requests per key per minute
          (<code className="text-xs">429</code> when exceeded).
        </p>

        {/* Endpoints */}
        <h2 className="text-lg font-semibold tracking-[-0.01em] mb-4 mt-9">Endpoints</h2>

        <Endpoint method="POST" path="/api/v1/business-health">
          <p className="text-sm text-charcoal-2 mb-1">
            Push a week&apos;s raw POS numbers; Wingman derives the dashboard Business Health ratios (revenue/seat,
            revenue/labor hr, labor %, avg check, comp cost, retention $ impact). Re-posting the same
            <code className="text-xs"> period_date</code> updates it.
          </p>
          <FieldTable
            rows={[
              ["period_date", "YYYY-MM-DD", "✓", "Any day in the week covered"],
              ["net_sales", "number", "✓", "Gross/net sales for the period"],
              ["labor_cost", "number", "✓", "Total labor dollars"],
              ["labor_hours", "number", "✓", "Total labor hours worked"],
              ["comp_cost", "number", "✓", "Comps / voids / discounts ($)"],
              ["covers", "number", "✓", "Guests served"],
              ["checks", "number", "✓", "Number of checks / transactions"],
              ["seats", "number", "—", "Physical seats (falls back to covers)"],
              ["location_id", "uuid", "—", "A location in your org; omit for all-locations"],
            ]}
          />
          <Code>{`curl -X POST ${BASE_URL}/api/v1/business-health \\
  -H "Authorization: Bearer $WINGMAN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"period_date":"2026-07-06","net_sales":48200,"labor_cost":13100,
       "labor_hours":540,"comp_cost":820,"covers":1240,"checks":610,"seats":90}'`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/growth">
          <p className="text-sm text-charcoal-2 mb-1">
            Record one period&apos;s Revenue Growth Planner metrics. Omit <code className="text-xs">location_id</code> for
            an org-wide entry; re-posting the same <code className="text-xs">period_date</code> updates it.
          </p>
          <FieldTable
            rows={[
              ["period_date", "YYYY-MM-DD", "✓", "The week/period the numbers are for"],
              ["customers", "number", "✓", "Number of customers"],
              ["avg_sale", "number", "✓", "Average spend per customer"],
              ["repurchase_frequency", "number", "✓", "Repeat visits per period"],
              ["location_id", "uuid", "—", "A location in your org; omit for all-locations"],
            ]}
          />
          <Code>{`curl -X POST ${BASE_URL}/api/v1/growth \\
  -H "Authorization: Bearer $WINGMAN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"period_date":"2026-07-06","customers":820,"avg_sale":38.50,
       "repurchase_frequency":1.4}'`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/guests">
          <p className="text-sm text-charcoal-2 mb-1">
            Create a guest, optionally with a first visit — feeds Guest Bounce Back and the dashboard&apos;s retention
            widgets.
          </p>
          <FieldTable
            rows={[
              ["name", "string", "✓", "Guest name"],
              ["phone", "string", "—", "Guest phone"],
              ["email", "string", "—", "Guest email"],
              ["visit", "object", "—", "Optional first visit (below)"],
            ]}
          />
          <p className="text-xs text-muted mb-1">
            <code>visit</code>: <code className="text-xs">visit_number</code> (1–4),{" "}
            <code className="text-xs">visit_date</code> (YYYY-MM-DD), <code className="text-xs">location_id</code>,{" "}
            <code className="text-xs">incentive</code>, <code className="text-xs">notes</code>.
          </p>
          <Code>{`curl -X POST ${BASE_URL}/api/v1/guests \\
  -H "Authorization: Bearer $WINGMAN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Jane Diner","email":"jane@example.com",
       "visit":{"visit_number":1,"visit_date":"2026-07-06"}}'`}</Code>
        </Endpoint>

        <Endpoint method="POST" path="/api/v1/menu">
          <p className="text-sm text-charcoal-2 mb-1">
            Sync the Menu Engineering matrix. Non-destructive: items are matched by name and updated, new ones
            inserted, others left alone. Send <code className="text-xs">units_sold</code> and Wingman ranks popularity
            into terciles (bottom third = 1, middle = 2, top = 3); or send <code className="text-xs">popularity</code>{" "}
            (1–3) directly.
          </p>
          <FieldTable
            rows={[
              ["items", "array", "✓", "One object per menu item (below)"],
              ["items[].name", "string", "✓", "Item name (match key)"],
              ["items[].price", "number", "—", "Menu price"],
              ["items[].food_cost", "number", "—", "Item food cost"],
              ["items[].popularity", "1–3", "—", "Explicit popularity"],
              ["items[].units_sold", "number", "—", "Units sold (used to rank popularity)"],
            ]}
          />
          <Code>{`curl -X POST ${BASE_URL}/api/v1/menu \\
  -H "Authorization: Bearer $WINGMAN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"items":[
        {"name":"Margherita Pizza","price":16,"food_cost":4.2,"units_sold":420},
        {"name":"Caesar Salad","price":12,"food_cost":3.1,"units_sold":180}
      ]}'`}</Code>
        </Endpoint>

        <p className="text-sm text-charcoal-2 mb-6">
          Each <code className="text-xs">POST</code> above has a matching <code className="text-xs">GET</code> that lists
          recent records (e.g. <code className="text-xs">GET /api/v1/growth</code>).
        </p>

        {/* Zapier */}
        <h2 className="text-lg font-semibold tracking-[-0.01em] mb-2 mt-8 break-inside-avoid">Using it with Zapier</h2>
        <ol className="text-sm text-charcoal-2 list-decimal pl-5 space-y-1 mb-6">
          <li>In Wingman: <strong>Settings → API access → Create key</strong> (copy it).</li>
          <li>In Zapier: add a <strong>&quot;Webhooks by Zapier&quot;</strong> action, method <strong>POST</strong>, URL the endpoint above.</li>
          <li>Add the header <code className="text-xs">Authorization: Bearer &lt;your key&gt;</code> and map your POS fields into the JSON body.</li>
          <li>Set the Zap&apos;s schedule (e.g. weekly) to push each period&apos;s numbers.</li>
        </ol>

        {/* Security */}
        <h2 className="text-lg font-semibold tracking-[-0.01em] mb-2 mt-8 break-inside-avoid">Keeping keys safe</h2>
        <p className="text-sm text-charcoal-2 mb-8">
          A key can read and write your organization&apos;s data. Share it only with developers you trust, never expose
          it in client-side code or public repositories, and revoke it immediately if it may have been exposed.
        </p>

        {/* Footer */}
        <div className="border-t border-line pt-5 mt-10 flex items-center justify-between text-xs text-muted-2">
          <span>
            Wingman is a product of <strong className="text-muted">The Maverick Agency</strong>.
          </span>
          <span>{BASE_URL}</span>
        </div>
      </div>
    </div>
  );
}
