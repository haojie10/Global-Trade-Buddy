import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

export async function setup() {
  const connectionString = 'postgresql://postgres:postgres@localhost:5432/postgres_test';
  
  const client = new Client({
    connectionString
  });
  await client.connect();

  try {
    console.log('Initializing test database schema...');
    
    // Drop existing tables in test database to ensure clean schema setup
    await client.query(`
      DROP TABLE IF EXISTS notes CASCADE;
      DROP TABLE IF EXISTS favorites CASCADE;
      DROP TABLE IF EXISTS unlocks CASCADE;
      DROP TABLE IF EXISTS relations CASCADE;
      DROP TABLE IF EXISTS reports CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS entities CASCADE;
      DROP TABLE IF EXISTS entity_aliases CASCADE;
      DROP TABLE IF EXISTS report_entities CASCADE;
    `);

    // Get all migration files, sort them by name, and apply in sequence
    const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Applying test migration: ${file}`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await client.query(sql);
    }

    console.log('Test database schema initialized successfully!');
  } catch (err) {
    console.error('Failed to initialize test database schema:', err);
    throw err;
  } finally {
    await client.end();
  }
}
