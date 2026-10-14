-- Sanika handles the full Digital Services group, including Website Development.
UPDATE "Users" AS staff
SET "justdialProducts" = (
  SELECT jsonb_agg(product ORDER BY product)
  FROM (
    SELECT DISTINCT value AS product
    FROM jsonb_array_elements_text(staff."justdialProducts")
    UNION
    SELECT unnest(ARRAY[
      'SMS', 'WhatsApp WABA', 'RCS', 'Voice Call',
      'Website Development', 'Software Development', 'Digital Marketing'
    ])
  ) AS products
)
WHERE lower(btrim(staff."name")) = 'sanika'
  AND staff."role"::text = 'sales_executive';

-- Assign only previously unassigned Justdial leads. Explicit assignments,
-- other sources, GPS, and unclear products are left intact.
UPDATE "Leads" AS lead
SET "exec" = staff."name"
FROM "Users" AS staff
WHERE lead."source"::text = 'Justdial'
  AND (lead."exec" IS NULL OR btrim(lead."exec") = '')
  AND lead."justdialProduct" = 'CCTV'
  AND lower(btrim(staff."name")) = 'shubhangi'
  AND staff."role"::text = 'sales_executive'
  AND staff."justdialProducts" @> jsonb_build_array(lead."justdialProduct")
  AND (SELECT count(*) FROM "Users" AS candidate
       WHERE lower(btrim(candidate."name")) = 'shubhangi'
         AND candidate."role"::text = 'sales_executive'
         AND candidate."justdialProducts" @> jsonb_build_array(lead."justdialProduct")) = 1;

UPDATE "Leads" AS lead
SET "exec" = staff."name"
FROM "Users" AS staff
WHERE lead."source"::text = 'Justdial'
  AND (lead."exec" IS NULL OR btrim(lead."exec") = '')
  AND lead."justdialProduct" IN (
    'SMS', 'WhatsApp WABA', 'RCS', 'Voice Call',
    'Website Development', 'Software Development', 'Digital Marketing'
  )
  AND lower(btrim(staff."name")) = 'sanika'
  AND staff."role"::text = 'sales_executive'
  AND staff."justdialProducts" @> jsonb_build_array(lead."justdialProduct")
  AND (SELECT count(*) FROM "Users" AS candidate
       WHERE lower(btrim(candidate."name")) = 'sanika'
         AND candidate."role"::text = 'sales_executive'
         AND candidate."justdialProducts" @> jsonb_build_array(lead."justdialProduct")) = 1;
