import sqlite3 from 'sqlite3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

// Import User model from main backend (adjust path if needed)
import { User } from './models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlitePath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(sqlitePath);

async function migrateUsers() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/perfume');
  db.all('SELECT * FROM users', async (err, rows) => {
    if (err) {
      console.error('Error reading users from SQLite:', err);
      process.exit(1);
    }
    for (const row of rows) {
      try {
        await User.create({
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          passwordHash: row.passwordHash,
          role: row.role || 'user',
        });
        console.log('Migrated user:', row.email);
      } catch (e) {
        console.error('Error migrating user:', row.email, e.message);
      }
    }
    console.log('User migration complete!');
    process.exit(0);
  });
}

migrateUsers(); 