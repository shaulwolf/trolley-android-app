const Database = require('better-sqlite3');
const path = require('path');

// Create/open database
const dbPath = path.join(__dirname, 'trolley.db');
const db = new Database(dbPath);

// Create products table
const createProductsTable = `
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    price TEXT,
    originalPrice TEXT,
    image TEXT,
    site TEXT,
    displaySite TEXT,
    category TEXT DEFAULT 'general',
    variants TEXT,
    dateAdded TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

db.exec(createProductsTable);

// Prepared statements for better performance
const statements = {
  getAllProducts: db.prepare('SELECT * FROM products ORDER BY dateAdded DESC'),
  getProductById: db.prepare('SELECT * FROM products WHERE id = ?'),
  getProductByUrl: db.prepare('SELECT * FROM products WHERE url = ?'),
  insertProduct: db.prepare(`
    INSERT INTO products (id, url, title, price, originalPrice, image, site, displaySite, category, variants, dateAdded)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateProduct: db.prepare(`
    UPDATE products 
    SET title = ?, price = ?, originalPrice = ?, image = ?, site = ?, displaySite = ?, category = ?, variants = ?
    WHERE id = ?
  `),
  deleteProduct: db.prepare('DELETE FROM products WHERE id = ?'),
  getProductsByCategory: db.prepare('SELECT * FROM products WHERE category = ? ORDER BY dateAdded DESC'),
  getProductsByStore: db.prepare('SELECT * FROM products WHERE displaySite = ? ORDER BY dateAdded DESC')
};

module.exports = {
  db,
  statements
};