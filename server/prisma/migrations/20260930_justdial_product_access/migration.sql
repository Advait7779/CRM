ALTER TABLE "Users" ADD COLUMN "justdialProducts" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "Leads" ADD COLUMN "justdialProduct" VARCHAR(50);
CREATE INDEX "leads_justdial_product" ON "Leads"("source", "justdialProduct");

-- Backfill existing Justdial leads using the same conservative, single-category rule
-- as the receiver. Unclear or mixed categories remain with administrators.
WITH flags AS (
  SELECT "id",
    ("service" ~* '(cctv|closed circuit|surveillance camera|security camera|ip camera)')::int AS cctv,
    ("service" ~* '(gps|vehicle track|fleet track|fuel sens|fuel monitor|telematics)')::int AS gps,
    ("service" ~* '(sms|text messag)')::int AS sms,
    ("service" ~* '(whatsapp|waba)')::int AS waba,
    ("service" ~* '(^|[^a-z])rcs([^a-z]|$)')::int AS rcs,
    ("service" ~* '(voice call|voice sms|ivr|automated call)')::int AS voice,
    ("service" ~* '(website|web design|web develop)')::int AS website,
    ("service" ~* '(software|app develop|application develop)')::int AS software,
    ("service" ~* '(digital marketing|seo|search engine optimization)')::int AS marketing
  FROM "Leads" WHERE "source" = 'Justdial'
)
UPDATE "Leads" AS lead SET "justdialProduct" = CASE
  WHEN flags.cctv + flags.gps + flags.sms + flags.waba + flags.rcs + flags.voice + flags.website + flags.software + flags.marketing <> 1 THEN 'Unclassified'
  WHEN flags.cctv = 1 THEN 'CCTV'
  WHEN flags.gps = 1 THEN 'GPS & Fuel Sensor'
  WHEN flags.sms = 1 THEN 'SMS'
  WHEN flags.waba = 1 THEN 'WhatsApp WABA'
  WHEN flags.rcs = 1 THEN 'RCS'
  WHEN flags.voice = 1 THEN 'Voice Call'
  WHEN flags.website = 1 THEN 'Website Development'
  WHEN flags.software = 1 THEN 'Software Development'
  ELSE 'Digital Marketing'
END
FROM flags WHERE lead."id" = flags."id";
