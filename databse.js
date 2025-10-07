const knex = require('knex');

// ## মূল পরিবর্তনটি এখানেই করা হয়েছে ##
// SSL কানেকশন চালু করার জন্য connection অবজেক্টটি পরিবর্তন করা হলো
const db = knex({
    client: 'pg',
    connection: {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    }
});
// #####################################

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
                table.string('trx_id').nullable();
                table.string('status').defaultTo('pending');
                table.string('method').notNullable().defaultTo('manual');
                table.timestamp('created_at').defaultTo(db.fn.now());
            });
            console.log('✅ "deposits" table created with new schema.');
        } else {
            console.log('ℹ️ "deposits" table already exists. Checking for updates...');
            
            if (!(await db.schema.hasColumn('deposits', 'method'))) {
                await db.schema.alterTable('deposits', table => {
                    table.string('method').notNullable().defaultTo('manual');
                });
                console.log('✅ "deposits" table updated with "method" column.');
            }

            await db.schema.alterTable('deposits', table => {
                table.string('trx_id').nullable().alter();
            });
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
