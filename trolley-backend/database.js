const Database = require("better-sqlite3");
const path = require("path");

// Create/open database
const dbPath = path.join(__dirname, "trolley.db");
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

// Add new sync columns to existing database
console.log("🔄 Checking for sync columns...");

try {
  db.exec("ALTER TABLE products ADD COLUMN lastModified TEXT");
  console.log("✅ Added lastModified column");
} catch (error) {
  // Column already exists, that's fine
  console.log("⏭️ lastModified column already exists");
}

try {
  db.exec("ALTER TABLE products ADD COLUMN deviceSource TEXT");
  console.log("✅ Added deviceSource column");
} catch (error) {
  // Column already exists, that's fine
  console.log("⏭️ deviceSource column already exists");
}

// Update existing records with new sync fields
try {
  const updateLastModified = db.prepare(
    "UPDATE products SET lastModified = dateAdded WHERE lastModified IS NULL"
  );
  const result1 = updateLastModified.run();

  const updateDeviceSource = db.prepare(
    "UPDATE products SET deviceSource = ? WHERE deviceSource IS NULL"
  );
  const result2 = updateDeviceSource.run("unknown");

  console.log(`✅ Updated ${result1.changes} records with lastModified`);
  console.log(`✅ Updated ${result2.changes} records with deviceSource`);
} catch (error) {
  console.log("⚠️ Could not update existing records:", error.message);
}

// Prepared statements for better performance
const statements = {
  getAllProducts: db.prepare("SELECT * FROM products ORDER BY dateAdded DESC"),
  getProductById: db.prepare("SELECT * FROM products WHERE id = ?"),
  getProductByUrl: db.prepare("SELECT * FROM products WHERE url = ?"),
  insertProduct: db.prepare(`
  INSERT INTO products (id, url, title, price, originalPrice, image, site, displaySite, category, variants, dateAdded, lastModified, deviceSource)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`),
  updateProduct: db.prepare(`
    UPDATE products 
    SET title = ?, price = ?, originalPrice = ?, image = ?, site = ?, displaySite = ?, category = ?, variants = ?, lastModified = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  deleteProduct: db.prepare("DELETE FROM products WHERE id = ?"),
  getProductsByCategory: db.prepare(
    "SELECT * FROM products WHERE category = ? ORDER BY dateAdded DESC"
  ),
  getProductsByStore: db.prepare(
    "SELECT * FROM products WHERE displaySite = ? ORDER BY dateAdded DESC"
  ),
};

module.exports = {
  db,
  statements,
};
