const Database = require('better-sqlite3');
const path     = require('path');

let db;

function initDB() {
  db = new Database(path.join(__dirname, 'nexvote.db'));

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS votes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT    NOT NULL,
      creator_id TEXT    NOT NULL,
      category   TEXT    NOT NULL,
      voted_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS one_vote_per_category
      ON votes (user_id, category);
  `);

  console.log('Database initialized (nexvote.db)');
}

function getDB() {
  if (!db) throw new Error('DB not initialized. Call initDB() first.');
  return db;
}

module.exports = { initDB, getDB };
