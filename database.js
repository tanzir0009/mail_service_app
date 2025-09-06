const knex = require('knex');

    // Render automatically provides a DATABASE_URL env var
    // for PostgreSQL. If it exists, we use it. Otherwise, we fall back to SQLite.
    const isProduction = process.env.NODE_ENV === 'production';

    const dbConfig = {
        client: 'pg', // Use PostgreSQL client
        connection: {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false } // Required for Render's PostgreSQL
        },
        migrations: {
            tableName: 'knex_migrations'
        }
    };

    const localDbConfig = {
        client: 'sqlite3',
        connection: {
            filename: './database.sqlite'
        },
        useNullAsDefault: true
    };
    
    // Determine which config to use
    const config = isProduction ? dbConfig : localDbConfig;
    
    // Initialize knex with the determined config
    const db = knex(config);

    async function setupDatabase() {
        // ... (এই অংশটি অপরিবর্তিত থাকবে) ...
    }

    module.exports = { knex: db, setupDatabase };