<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Keep the Help Center current

The in-app Help Center content lives in `src/lib/help-content.ts` (rendered under
`/help`). Whenever you ship a user-facing feature or change a user-facing flow:

1. **Update Help in the same change** — add or edit the relevant article (steps,
   tips, links, keywords) so the docs never drift from the product.
2. **Ask the user for a screenshot** of the new/changed screen, then embed it
   into the matching article as an `{ kind: "image", src: "/help/<name>.png" }`
   block. Screenshots go in `public/help/`; optimize them to ~1500px wide.

Product Help is shared across all customers and is maintained in code (not
per-org). The per-organization "Team playbook" (`playbook_articles`) is separate
and user-authored — don't put product docs there.

# Keep the sales playbook current

When you ship a new user-facing feature (a new section, a meaningful capability),
also update the **Sales Training** playbook in `src/lib/sales-playbook.ts`
(rendered at `/admin/sales-training`) in the same change — at minimum add the
feature to `PRODUCT_TOUR` (what it does + the problem it solves), and update the
demo movements, question bank, or reframes if the feature changes how a demo
should be run. This keeps the demo staff's playbook in lockstep with the product.

So, for every user-facing feature, keep these three in sync in the same change:
1. **Help Center** — `src/lib/help-content.ts` (customer-facing docs).
2. **AI doctrine** — `src/lib/ai-doctrine.ts` (the `HOSPITALITY_DOCTRINE` grounding
   the AI), when the feature adds product knowledge the AI should reason from.
3. **Sales playbook** — `src/lib/sales-playbook.ts` (internal demo enablement).
