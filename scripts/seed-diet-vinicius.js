require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seedDiet() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find user vinicius
    const userResult = await client.query(
      `SELECT id FROM "User" WHERE username = $1`,
      ['vinicius']
    );

    if (userResult.rows.length === 0) {
      throw new Error('Usuário "vinicius" não encontrado no banco de dados.');
    }

    const userId = userResult.rows[0].id;
    console.log(`Usuário encontrado: id=${userId}`);

    // Deactivate any existing active plan for this user
    await client.query(
      `UPDATE "MealPlan" SET "isActive" = false WHERE "userId" = $1`,
      [userId]
    );

    // Create meal plan
    const planResult = await client.query(
      `INSERT INTO "MealPlan" (name, "isActive", "userId") VALUES ($1, true, $2) RETURNING id`,
      ['Plano Ganho de Massa - Vinicius', userId]
    );
    const planId = planResult.rows[0].id;
    console.log(`Plano criado: id=${planId}`);

    // Define meals with their foods
    const meals = [
      {
        name: 'Refeição 1',
        time: '',
        order: 1,
        foods: [
          { name: 'Ovo inteiro',            quantity: '2 uni',     calories: 172, protein: 14.0, carbs: 1.2,  fat: 12.0 },
          { name: 'Pão de forma integral',  quantity: '50g',       calories: 130, protein: 5.0,  carbs: 23.0, fat: 2.0  },
          { name: 'Banana',                 quantity: '100g',      calories: 89,  protein: 1.1,  carbs: 23.0, fat: 0.3  },
          { name: 'Mamão',                  quantity: '100g',      calories: 39,  protein: 0.6,  carbs: 10.0, fat: 0.1  },
          { name: 'Aveia',                  quantity: '40g',       calories: 152, protein: 5.6,  carbs: 26.0, fat: 2.7  },
        ],
      },
      {
        name: 'Refeição 2',
        time: '',
        order: 2,
        foods: [
          { name: 'Arroz branco',           quantity: '250g',      calories: 325, protein: 6.0,  carbs: 70.0, fat: 0.5  },
          { name: 'Feijão',                 quantity: '80g',       calories: 77,  protein: 5.3,  carbs: 14.0, fat: 0.4  },
          { name: 'Cenoura',                quantity: '100g',      calories: 41,  protein: 0.9,  carbs: 10.0, fat: 0.2  },
          { name: 'Frango/Patinho/Filé suíno/Tilápia', quantity: '120g/115g/150g/170g', calories: 185, protein: 28.0, carbs: 0.0, fat: 7.0 },
          { name: 'Salada',                 quantity: 'À vontade', calories: 0,   protein: 0.0,  carbs: 0.0,  fat: 0.0  },
        ],
      },
      {
        name: 'Refeição 3',
        time: '',
        order: 3,
        foods: [
          { name: 'Tapioca',                quantity: '70g',       calories: 243, protein: 0.1,  carbs: 59.0, fat: 0.2  },
          { name: 'Frango desfiado/Patinho', quantity: '40g/35g',  calories: 62,  protein: 9.3,  carbs: 0.0,  fat: 2.3  },
          { name: 'Queijo muçarela',        quantity: '1 fatia',   calories: 60,  protein: 5.0,  carbs: 0.7,  fat: 4.0  },
          { name: 'Tomate',                 quantity: 'À vontade', calories: 0,   protein: 0.0,  carbs: 0.0,  fat: 0.0  },
          { name: 'Alface',                 quantity: 'À vontade', calories: 0,   protein: 0.0,  carbs: 0.0,  fat: 0.0  },
        ],
      },
      {
        name: 'Refeição 4',
        time: '',
        order: 4,
        foods: [
          { name: 'Arroz branco',           quantity: '200g',      calories: 260, protein: 4.8,  carbs: 56.0, fat: 0.4  },
          { name: 'Cenoura',                quantity: '100g',      calories: 41,  protein: 0.9,  carbs: 10.0, fat: 0.2  },
          { name: 'Frango/Patinho/Filé suíno/Tilápia', quantity: '120g/115g/150g/170g', calories: 185, protein: 28.0, carbs: 0.0, fat: 7.0 },
        ],
      },
    ];

    for (const meal of meals) {
      const mealResult = await client.query(
        `INSERT INTO "Meal" ("mealPlanId", name, time, "order") VALUES ($1, $2, $3, $4) RETURNING id`,
        [planId, meal.name, meal.time, meal.order]
      );
      const mealId = mealResult.rows[0].id;
      console.log(`  Refeição criada: ${meal.name} (id=${mealId})`);

      for (let i = 0; i < meal.foods.length; i++) {
        const f = meal.foods[i];
        await client.query(
          `INSERT INTO "MealFood" ("mealId", name, quantity, calories, protein, carbs, fat, "order")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [mealId, f.name, f.quantity, f.calories, f.protein, f.carbs, f.fat, i]
        );
        console.log(`    Alimento: ${f.name} (${f.quantity})`);
      }
    }

    await client.query('COMMIT');
    console.log('\nPlano de dieta inserido com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDiet();
