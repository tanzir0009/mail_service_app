const knex = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL
});

async function setupDatabase() {
    try {
        if (!(await db.schema.hasTable('users'))) {
            await db.schema.createTable('users', table => {
                table.increments('id').primary();
                table.string('username').unique().notNullable();
                table.string('password').notNullable();
                table.decimal('balance', 14, 2).defaultTo(0.00);
            });
            console.log('✅ "users" table created.');
        }

        if (!(await db.schema.hasTable('orders'))) {
            await db.schema.createTable('orders', table => {
                table.increments('id').primary();
                table.integer('user_id').unsigned().references('id').inTable('users');
                table.string('mailType');
                table.integer('quantity');
                table.decimal('totalCost', 14, 2);
                table.text('purchasedEmails');
                table.timestamp('created_at').defaultTo(db.fn.now());
            });
            console.log('✅ "orders" table created.');
        }

        if (!(await db.schema.hasTable('deposits'))) {
            await db.schema.createTable('deposits', table => {
                table.increments('id').primary();
                table.integer('user_id').unsigned().references('id').inTable('users');
                table.string('username').notNullable();
                table.decimal('amount', 14, 2).notNullable();
                table.string('trx_id').notNullable();
                table.string('status').defaultTo('pending'); // pending, approved, rejected
                table.timestamp('created_at').defaultTo(db.fn.now());
            });
            console.log('✅ "deposits" table created.');
        }

        if (!(await db.schema.hasTable('settings'))) {
            await db.schema.createTable('settings', table => {
                table.string('key').primary();
                table.text('value'); 
            });
            console.log('✅ "settings" table created.');
            
            const existingSettings = await db('settings').where({ key: 'payment_methods' }).first();
            if (!existingSettings) {
                await db('settings').insert({
                    key: 'payment_methods',
                    value: JSON.stringify([
                        { id: Date.now(), method: 'bKash Personal', number: '01700000000' }
                    ])
                });
                console.log('✅ Default payment methods inserted.');
            }
        }
    } catch (error) {
        console.error("❌ Database setup failed:", error);
    }
}

module.exports = { knex: db, setupDatabase };

