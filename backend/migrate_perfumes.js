import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Product } from './models.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const perfumes = JSON.parse(fs.readFileSync(path.join(__dirname, 'perfumes.json'), 'utf-8'));

async function migratePerfumes() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/perfume';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Remove all existing products
    await Product.deleteMany({});
    console.log('Cleared products collection');

    // Insert new perfumes
    const inserted = await Product.insertMany(perfumes.map(p => ({
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice || null,
      image: p.image,
      description: p.description,
      category: p.category || '',
      rating: p.rating || null,
      isRecent: p.isNew ? true : false, // Map isNew to isRecent
      isBestseller: p.isBestseller ? true : false
    })));
    console.log(`Inserted ${inserted.length} perfumes into MongoDB.`);
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
      }
}

migratePerfumes(); 