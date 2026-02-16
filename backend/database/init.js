const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function initializeDatabase() {
    console.log('🗄️  Initializing Route Optimizer Database...\n');

    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: 'postgres' // Connect to default database first
    });

    try {
        await client.connect();
        console.log('✓ Connected to PostgreSQL server');

        // Create database if it doesn't exist
        const dbName = process.env.DB_NAME || 'route_optimizer';
        const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`;
        const result = await client.query(checkDbQuery);

        if (result.rows.length === 0) {
            await client.query(`CREATE DATABASE ${dbName}`);
            console.log(`✓ Created database: ${dbName}`);
        } else {
            console.log(`✓ Database already exists: ${dbName}`);
        }

        await client.end();

        // Connect to the new database
        const dbClient = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
            database: dbName
        });

        await dbClient.connect();
        console.log(`✓ Connected to database: ${dbName}\n`);

        // Execute schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await dbClient.query(schemaSql);
        console.log('✓ Database schema created successfully');

        // Verify tables
        const tablesQuery = `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        `;
        const tables = await dbClient.query(tablesQuery);

        console.log('\n📊 Created tables:');
        tables.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

        await dbClient.end();

        console.log('\n✅ Database initialization completed successfully!\n');
        console.log('Next steps:');
        console.log('1. Update .env with your API keys');
        console.log('2. Run: npm run dev');
        console.log('3. Visit: http://localhost:3000\n');

    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Make sure PostgreSQL is running');
        console.error('2. Check your .env database credentials');
        console.error('3. Ensure the user has CREATE DATABASE permissions\n');
        process.exit(1);
    }
}

// Run initialization
initializeDatabase();
