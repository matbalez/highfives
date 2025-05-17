import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the current file's URL and convert it to a path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This file runs database migrations
async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Runs migrations in the "migrations" folder
    // Use the absolute path to the migrations folder
    const migrationsFolder = path.join(__dirname, '..', 'migrations');
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully');
  } catch (error) {
    // Check if it's just a "column already exists" error, which we can safely ignore
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('column "qr_code_path" of relation "high_fives" already exists')) {
      console.log('Column qr_code_path already exists, continuing...');
    } else {
      console.error('Error running migrations:', error);
      throw error;
    }
  }
}

// Only run migrations immediately if this file is executed directly
// Don't exit the process if this is imported by another module
if (import.meta.url === import.meta.main) {
  runMigrations().then(() => {
    console.log('Migration script completed');
    process.exit(0);
  }).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

// Export for use in other files
export { runMigrations };