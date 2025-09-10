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
                // ## পরিবর্তন: trx_id এখন থেকে খালি থাকতে পারবে (nullable)
                table.string('trx_id').nullable();
                table.string('status').defaultTo('pending');
                // ## নতুন কলাম: পেমেন্টের ধরণ চিহ্নিত করার জন্য
                table.string('method').notNullable().defaultTo('manual');
                table.timestamp('created_at').defaultTo(db.fn.now());
            });
            console.log('✅ "deposits" table created with new schema.');
        } else {
            // ## নতুন কোড: যদি টেবিল আগে থেকেই থাকে, তাহলে এটি আপডেট করবে
            console.log('ℹ️ "deposits" table already exists. Checking for updates...');
            
            // 'method' কলামটি যোগ করা
            if (!(await db.schema.hasColumn('deposits', 'method'))) {
                await db.schema.alterTable('deposits', table => {
                    table.string('method').notNullable().defaultTo('manual');
                });
                console.log('✅ "deposits" table updated with "method" column.');
            }

            // 'trx_id' কলামটিকে nullable করা
            // এই কোডটি নিশ্চিত করবে যে কলামটি পরিবর্তন করা হয়েছে
            await db.schema.alterTable('deposits', table => {
                table.string('trx_id').nullable().alter();
            });
            // এই বার্তাটি দেখানোর জন্য একটি ফ্ল্যাগ ব্যবহার করা যেতে পারে, তবে আপাতত এটি ঠিক আছে
            console.log('✅ "deposits" table "trx_id" column verified to be nullable.');
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
