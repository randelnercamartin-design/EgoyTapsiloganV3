// api/_db.js — Shared Supabase/PostgreSQL connection
// Used by all serverless API functions

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Required for Supabase
      max: 3,           // Keep small for serverless
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
    });
  }
  return pool;
}

module.exports = { getPool };
