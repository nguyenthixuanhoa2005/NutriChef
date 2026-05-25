const db = require('../src/config/db');

const BACKFILL_SQL = `
WITH extracted AS (
  SELECT
    r.recipe_id,
    CASE
      WHEN NULLIF(elem->>'id', '') ~ '^\\d+$' THEN NULLIF(elem->>'id', '')::int
      ELSE NULL
    END AS id_from_id,
    CASE
      WHEN NULLIF(elem->>'ingredient_id', '') ~ '^\\d+$' THEN NULLIF(elem->>'ingredient_id', '')::int
      ELSE NULL
    END AS id_from_ingredient_id,
    LOWER(TRIM(COALESCE(elem->>'name', elem->>'ingredient_name', ''))) AS ingredient_name_key
  FROM recipe r
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(r.ingredients_json) = 'array' THEN r.ingredients_json
      ELSE '[]'::jsonb
    END
  ) AS elem
),
resolved AS (
  SELECT
    e.recipe_id,
    -- ƯU TIÊN: Khớp theo tên nguyên liệu trước (vì tên trong JSON thường chính xác hơn ID gán cứng)
    -- Nếu không khớp tên mới dùng ID từ JSON làm fallback
    COALESCE(i.ingredient_id, e.id_from_id, e.id_from_ingredient_id) AS ingredient_id
  FROM extracted e
  LEFT JOIN ingredient i
    ON LOWER(TRIM(i.name)) = e.ingredient_name_key
),
inserted AS (
  INSERT INTO recipe_ingredient_map (recipe_id, ingredient_id)
  SELECT DISTINCT recipe_id, ingredient_id
  FROM resolved
  WHERE ingredient_id IS NOT NULL
    AND ingredient_id > 0
  ON CONFLICT (recipe_id, ingredient_id) DO NOTHING
  RETURNING recipe_id, ingredient_id
),
unresolved AS (
  SELECT COUNT(*)::int AS unresolved_count
  FROM resolved
  WHERE ingredient_id IS NULL
)
SELECT
  (SELECT COUNT(*)::int FROM inserted) AS inserted_count,
  (SELECT unresolved_count FROM unresolved) AS unresolved_count;
`;

async function main() {
  const client = await db.getClient();

  try {
    await client.query('BEGIN');
    const result = await client.query(BACKFILL_SQL);
    await client.query('COMMIT');

    const insertedCount = Number(result.rows?.[0]?.inserted_count || 0);
    const unresolvedCount = Number(result.rows?.[0]?.unresolved_count || 0);

    console.log('Backfill recipe_ingredient_map completed.');
    console.log(`- Inserted mappings: ${insertedCount}`);
    console.log(`- Unresolved ingredient references: ${unresolvedCount}`);

    if (unresolvedCount > 0) {
      console.log('Tip: unresolved rows often come from ingredient names not matching the ingredient table exactly.');
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    console.error('Backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main();
