-- Replace stale hardcoded prices in CRM automation steps with the live-pricing
-- merge tokens, so every automation always quotes the current configured price
-- (resolved at send time by applyPriceTokens). Scoped to crm_sequence_steps
-- (platform automation copy, not tenant data); UPDATE only, non-destructive and
-- reversible. Old first-location price $199 → {{firstPrice}}, old additional
-- price $100 → {{addlPrice}}.

update crm_sequence_steps
set body = replace(replace(body, '$199', '{{firstPrice}}'), '$100', '{{addlPrice}}')
where body like '%$199%' or body like '%$100%';

update crm_sequence_steps
set subject = replace(replace(subject, '$199', '{{firstPrice}}'), '$100', '{{addlPrice}}')
where subject like '%$199%' or subject like '%$100%';
