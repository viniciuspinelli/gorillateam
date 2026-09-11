require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seedWorkouts() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find user vinicius
    const userResult = await client.query(
      `SELECT id FROM "User" WHERE username = $1`,
      ['vinicius']
    );

    if (userResult.rows.length === 0) {
      throw new Error('Usuário "vinicius" não encontrado.');
    }

    const userId = userResult.rows[0].id;
    console.log(`Usuário encontrado: id=${userId}`);

    const workouts = [
      {
        name: 'Peito e Bíceps',
        description: 'Abdominal + 20min aeróbico ao final',
        dayOfWeek: '',
        order: 1,
        exercises: [
          { name: 'Supino inclinado com halter + Crucifixo inclinado', sets: 4, reps: '10',     weight: '', notes: 'Biset' },
          { name: 'Supino Reto',                                        sets: 4, reps: '12/10/10/8', weight: '', notes: 'Progressão de carga' },
          { name: 'Peck Deck',                                          sets: 4, reps: '15/10/10/10', weight: '', notes: '' },
          { name: 'Pullover',                                           sets: 3, reps: '15',    weight: '', notes: '' },
          { name: 'Crossover',                                          sets: 4, reps: '10',    weight: '', notes: '' },
          { name: 'Circuito: Rosca simultânea + Rosca martelo + Rosca no banco', sets: 3, reps: '10', weight: '', notes: 'Circuito sem descanso' },
        ],
      },
      {
        name: 'Costas e Tríceps',
        description: 'Abdominal + 20min aeróbico ao final',
        dayOfWeek: '',
        order: 2,
        exercises: [
          { name: 'Flexão na barra fixa ou Graviton',           sets: 4, reps: 'RM',    weight: '', notes: '' },
          { name: 'Remada curvada com barra pegada pronada',    sets: 4, reps: '10',    weight: '', notes: '' },
          { name: 'Puxador articulado',                         sets: 4, reps: '10',    weight: '', notes: '' },
          { name: 'Remada unilateral',                          sets: 4, reps: '10',    weight: '', notes: '' },
          { name: 'Puxador frente pegada supinada largura dos ombros', sets: 4, reps: '10', weight: '', notes: '' },
          { name: 'Circuito: Testa com barra + Coice com halter + Francês', sets: 3, reps: '10', weight: '', notes: 'Circuito sem descanso' },
        ],
      },
      {
        name: 'Ombro e Perna',
        description: '',
        dayOfWeek: '',
        order: 3,
        exercises: [
          { name: 'Desenvolvimento com halter',                  sets: 4, reps: '15/12/10/drop', weight: '', notes: 'Progressão de carga, última série com drop' },
          { name: 'Elevação frontal com halteres pegada supinada', sets: 4, reps: '10', weight: '', notes: '' },
          { name: 'Elevação lateral com halteres',               sets: 4, reps: 'RM + 10 parciais', weight: '', notes: '' },
          { name: 'Remada alta no cross com corda',              sets: 4, reps: '10',   weight: '', notes: '' },
          { name: 'Cadeira extensora',                           sets: 3, reps: '20',   weight: '', notes: '' },
          { name: 'Agachamento Smith',                           sets: 4, reps: '12',   weight: '', notes: '' },
          { name: 'Leg 45 + Agachamento livre',                  sets: 4, reps: '10',   weight: '', notes: 'Biset' },
          { name: 'Cadeira flexora',                             sets: 4, reps: '12',   weight: '', notes: '' },
          { name: 'Stiff',                                       sets: 4, reps: '10',   weight: '', notes: '' },
          { name: 'Cadeira adutora + Abdutora',                  sets: 4, reps: '15',   weight: '', notes: 'Biset' },
        ],
      },
    ];

    for (const w of workouts) {
      const planResult = await client.query(
        `INSERT INTO "WorkoutPlan" (name, description, "dayOfWeek", "order", "isActive", "userId")
         VALUES ($1, $2, $3, $4, true, $5) RETURNING id`,
        [w.name, w.description, w.dayOfWeek, w.order, userId]
      );
      const planId = planResult.rows[0].id;
      console.log(`Treino criado: ${w.name} (id=${planId})`);

      for (let i = 0; i < w.exercises.length; i++) {
        const e = w.exercises[i];
        await client.query(
          `INSERT INTO "Exercise" ("workoutPlanId", name, sets, reps, weight, notes, "order")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [planId, e.name, e.sets, e.reps, e.weight, e.notes, i]
        );
        console.log(`  Exercício: ${e.name} (${e.sets}x${e.reps})`);
      }
    }

    await client.query('COMMIT');
    console.log('\nTreinos inseridos com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedWorkouts();
