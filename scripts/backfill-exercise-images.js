require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// One-off repair: exercises copied from a template via assignWorkout (before the
// fix) never inherited the template's reference photos. This finds exercises
// that belong to an assigned (non-template) plan, have zero images, and match
// (by plan name + group name + exercise name + order) exactly one template
// exercise that does have images — then copies those images over.
async function backfill() {
  const client = await pool.connect();
  try {
    const orphans = await client.query(`
      SELECT e.id AS "exerciseId", e.name AS "exerciseName", e."order" AS "exerciseOrder",
             wg.name AS "groupName", wp.name AS "planName", wp.id AS "planId"
      FROM "Exercise" e
      JOIN "WorkoutGroup" wg ON wg.id = e."workoutGroupId"
      JOIN "WorkoutPlan" wp ON wp.id = wg."workoutPlanId"
      WHERE wp."isTemplate" = false
        AND NOT EXISTS (SELECT 1 FROM "WorkoutExerciseImage" wei WHERE wei."exerciseId" = e.id)
    `);

    console.log(`Exercícios sem foto em planos atribuídos: ${orphans.rows.length}`);

    let fixed = 0;
    let ambiguous = 0;
    let noMatch = 0;

    for (const ex of orphans.rows) {
      const candidates = await client.query(`
        SELECT te.id AS "templateExerciseId", COUNT(wei.id) AS "imageCount"
        FROM "Exercise" te
        JOIN "WorkoutGroup" twg ON twg.id = te."workoutGroupId"
        JOIN "WorkoutPlan" twp ON twp.id = twg."workoutPlanId"
        LEFT JOIN "WorkoutExerciseImage" wei ON wei."exerciseId" = te.id
        WHERE twp."isTemplate" = true
          AND twp.name = $1 AND twg.name = $2 AND te.name = $3 AND te."order" = $4
        GROUP BY te.id
        HAVING COUNT(wei.id) > 0
      `, [ex.planName, ex.groupName, ex.exerciseName, ex.exerciseOrder]);

      if (candidates.rows.length === 0) {
        noMatch++;
        continue;
      }
      if (candidates.rows.length > 1) {
        ambiguous++;
        console.log(`AMBÍGUO — pulado: "${ex.planName}" > "${ex.groupName}" > "${ex.exerciseName}" (exercício #${ex.exerciseId}) casa com ${candidates.rows.length} exercícios de template.`);
        continue;
      }

      const templateExerciseId = candidates.rows[0].templateExerciseId;
      const result = await client.query(`
        INSERT INTO "WorkoutExerciseImage"
          ("exerciseId", "createdBy", "storageProvider", "storageKey", "publicUrl", "fileName", "mimeType", "sizeBytes", "sortOrder")
        SELECT $1, "createdBy", "storageProvider", "storageKey", "publicUrl", "fileName", "mimeType", "sizeBytes", "sortOrder"
        FROM "WorkoutExerciseImage" WHERE "exerciseId" = $2
        RETURNING id
      `, [ex.exerciseId, templateExerciseId]);

      fixed++;
      console.log(`OK — "${ex.planName}" > "${ex.groupName}" > "${ex.exerciseName}" (exercício #${ex.exerciseId}): ${result.rows.length} foto(s) recuperada(s) do template (exercício #${templateExerciseId}).`);
    }

    console.log('\n--- Resumo ---');
    console.log(`Corrigidos:      ${fixed}`);
    console.log(`Ambíguos (pulados): ${ambiguous}`);
    console.log(`Sem correspondência: ${noMatch}`);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch((err) => {
  console.error('Erro no backfill:', err);
  process.exit(1);
});
