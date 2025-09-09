const knex = require('knex');

const db = knex({
    client: 'pg', // PostgreSQL ক্লায়েন্ট
    connection: process.env.DATABASE_URL, // Render থেকে সংযোগ স্ট্রিং
});

async function setupDatabase() {
    try {
        // Create 'users' table if it doesn't exist
        if (!(await db.schema.hasTable('users'))) {
            await db.schema.createTable('users', table => {
                table.increments('id').primary();
                table.string('username').unique().notNullable();
                table.string('password').notNullable();
                table.decimal('balance', 14, 2).defaultTo(0.00);
            });
            console.log('✅ "users" table created.');
        }

        // Create 'orders' table if it doesn't exist
        if (!(await db.schema.hasTable('orders'))) {
            await db.schema.createTable('orders', table => {
                table.increments('id').primary();
                // --- অপটিমাইজেশন যোগ করা হয়েছে ---
                // যদি কোনো ইউজার ডিলেট হয়, তার সব অর্ডারও ডিলেট হয়ে যাবে
                table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
                table.string('mailType');
                table.integer('quantity');
                table.decimal('totalCost', 14, 2);
                table.text('purchasedEmails');
                table.timestamp('created_at').defaultTo(db.fn.now());
            });
            console.log('✅ "orders" table created.');
        }

        // Create 'deposits' table if it doesn't exist
        if (!(await db.schema.hasTable('deposits'))) {
            await db.schema.createTable('deposits', table => {
                table.increments('id').primary();
                table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
                table.string('username').notNullable();
                table.decimal('amount', 14, 2).notNullable();
                table.string('trx_id').notNullable();
                table.string('status').defaultTo('pending');
                table.timestamp('created_at').defaultTo(db.fn.now());
            });
            console.log('✅ "deposits" table created.');
        }

        // Create 'settings' table if it doesn't exist
        if (!(await db.schema.hasTable('settings'))) {
            await db.schema.createTable('settings', table => {
                table.string('key').primary();
                table.text('value');
            });
            console.log('✅ "settings" table created.');
        }
        
        // Insert default settings if not present
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

    } catch (error) {
        console.error("❌ Database setup failed:", error);
    }
}

module.exports = { knex: db, setupDatabase };
