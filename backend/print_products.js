import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new sqlite3.Database(path.join(__dirname, 'users.db'));
db.all('SELECT * FROM products', (err, rows) => {
  if (err) {
    console.error('Error reading products:', err.message);
  } else {
    console.log('Products in DB:', rows);
  }
  db.close();
}); 