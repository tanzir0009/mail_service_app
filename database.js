// Knex.js এবং এর কনফিগারেশন
const knex = require('knex')({
    client: 'sqlite3', // আমরা কোন ডাটাবেস ব্যবহার করছি
    connection: {
        filename: './database.sqlite' // ডাটাবেস ফাইলের নাম এবং অবস্থান
    },
    useNullAsDefault: true // SQLite-এর জন্য এটি জরুরি
});

// ডাটাবেস টেবিল তৈরির ফাংশন
async function setupDatabase() {
    try {
        // 'users' টেবিল আছে কিনা তা চেক করা
        const hasUsersTable = await knex.schema.hasTable('users');
        if (!hasUsersTable) {
            await knex.schema.createTable('users', (table) => {
                table.increments('id').primary(); // অটো-ইনক্রিমেন্টিং প্রাইমারি কী
                table.string('username').unique().notNullable(); // ইউনিক ইউজারনেম
                table.string('password').notNullable(); // পাসওয়ার্ড (আমরা পরে হ্যাশ করে রাখব)
                table.decimal('balance', 14, 2).defaultTo(0.00); // ব্যবহারকারীর ব্যালেন্স
            });
            console.log("✅ 'users' টেবিল সফলভাবে তৈরি হয়েছে।");
            
            // একটি ডেমো ইউজার তৈরি করা
            await knex('users').insert({
                username: 'demo_user',
                password: 'demo_password', // বাস্তবে আমরা পাসওয়ার্ড হ্যাশ করব
                balance: 500.00
            });
            console.log("👤 ডেমো ব্যবহারকারী তৈরি হয়েছে।");
        }

        // 'orders' টেবিল আছে কিনা তা চেক করা
        const hasOrdersTable = await knex.schema.hasTable('orders');
        if (!hasOrdersTable) {
            await knex.schema.createTable('orders', (table) => {
                table.increments('id').primary();
                table.integer('user_id').unsigned().references('id').inTable('users'); // users টেবিলের সাথে সম্পর্ক
                table.string('mailType').notNullable();
                table.integer('quantity').notNullable();
                table.decimal('totalCost', 14, 2).notNullable();
                table.json('purchasedEmails'); // কেনা ইমেলগুলো JSON হিসেবে রাখা হবে
                table.timestamps(true, true); // createdAt এবং updatedAt সময় স্বয়ংক্রিয়ভাবে যোগ হবে
            });
            console.log("✅ 'orders' টেবিল সফলভাবে তৈরি হয়েছে।");
        }

    } catch (error) {
        console.error("ডাটাবেস সেটআপ করতে সমস্যা:", error);
    }
}

// knex ইনস্ট্যান্স এবং সেটআপ ফাংশন এক্সপোর্ট করা হচ্ছে
module.exports = { knex, setupDatabase };
