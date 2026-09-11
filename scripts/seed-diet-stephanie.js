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

    // Find user stephanie
    const userResult = await client.query(
      `SELECT id FROM "User" WHERE username = $1`,
      ['stephanie']
    );

    if (userResult.rows.length === 0) {
      throw new Error('Usuária "stephanie" não encontrada no banco de dados.');
    }

    const userId = userResult.rows[0].id;
    console.log(`Usuária encontrada: id=${userId}`);

    // Deactivate any existing active plan for this user
    await client.query(
      `UPDATE "MealPlan" SET "isActive" = false WHERE "userId" = $1`,
      [userId]
    );

    // Create meal plan
    const planResult = await client.query(
      `INSERT INTO "MealPlan" (name, "isActive", "userId") VALUES ($1, true, $2) RETURNING id`,
      ['Plano Definição - Stephanie', userId]
    );
    const planId = planResult.rows[0].id;
    console.log(`Plano criado: id=${planId}`);

    const meals = [
      {
        name: 'Refeição 1',
        time: '',
        order: 1,
        foods: [
          { name: 'Ovo inteiro',           quantity: '1 uni',     calories: 86,  protein: 7.0,  carbs: 0.6,  fat: 6.0  },
          { name: 'Pão de forma integral', quantity: '25g',       calories: 65,  protein: 2.5,  carbs: 11.5, fat: 1.0  },
          { name: 'Queijo muçarela',       quantity: '1 fatia',   calories: 60,  protein: 5.0,  carbs: 0.7,  fat: 4.0  },
          { name: 'Mamão',                 quantity: '100g',      calories: 39,  protein: 0.6,  carbs: 10.0, fat: 0.1  },
          { name: 'Aveia',                 quantity: '20g',       calories: 76,  protein: 2.8,  carbs: 13.0, fat: 1.4  },
        ],
      },
      {
        name: 'Refeição 2',
        time: '',
        order: 2,
        foods: [
          { name: 'Arroz branco',          quantity: '150g',      calories: 195, protein: 3.6,  carbs: 42.0, fat: 0.3  },
          { name: 'Feijão',                quantity: '50g',       calories: 48,  protein: 3.3,  carbs: 8.8,  fat: 0.2  },
          { name: 'Cenoura',               quantity: '50g',       calories: 21,  protein: 0.5,  carbs: 5.0,  fat: 0.1  },
          { name: 'Frango/Patinho/Filé suíno/Tilápia', quantity: '100g/95g/130g/150g', calories: 155, protein: 23.0, carbs: 0.0, fat: 6.0 },
          { name: 'Salada',                quantity: 'À vontade', calories: 0,   protein: 0.0,  carbs: 0.0,  fat: 0.0  },
        ],
      },
      {
        name: 'Refeição 3',
        time: '',
        order: 3,
        foods: [
          { name: 'Frutas variadas (sua preferência)', quantity: '200g', calories: 100, protein: 1.0, carbs: 25.0, fat: 0.4 },
          { name: 'Iogurte integral',      quantity: '150g',      calories: 90,  protein: 5.3,  carbs: 7.0,  fat: 4.5  },
          { name: 'Whey',                  quantity: '15g',       calories: 57,  protein: 11.3, carbs: 1.5,  fat: 0.8  },
          { name: 'Aveia',                 quantity: '20g',       calories: 76,  protein: 2.8,  carbs: 13.0, fat: 1.4  },
        ],
      },
      {
        name: 'Refeição 4',
        time: '',
        order: 4,
        foods: [
          { name: 'Arroz branco',          quantity: '100g',      calories: 130, protein: 2.4,  carbs: 28.0, fat: 0.2  },
          { name: 'Batata inglesa ou cenoura', quantity: '100g',  calories: 77,  protein: 2.0,  carbs: 17.0, fat: 0.1  },
          { name: 'Frango/Patinho/Filé suíno/Tilápia', quantity: '100g/95g/130g/150g', calories: 155, protein: 23.0, carbs: 0.0, fat: 6.0 },
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
