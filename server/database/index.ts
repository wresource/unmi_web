import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'fs'
import { dirname } from 'path'

let _db: Database.Database | null = null

export function useDatabase(): Database.Database {
  if (_db) return _db

  const dbPath = process.env.DB_PATH || './data/domain-manager.db'
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  _db = new Database(dbPath)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  initDatabase(_db)
  return _db
}

function initDatabase(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      is_public INTEGER DEFAULT 0,
      contact_email TEXT DEFAULT '',
      contact_wechat TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL DEFAULT 0,
      domain_name TEXT NOT NULL COLLATE NOCASE,
      tld TEXT NOT NULL,
      registrar TEXT DEFAULT '',
      registration_date TEXT,
      expiry_date TEXT,
      purchase_price REAL DEFAULT 0,
      renewal_price REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','expired','transferring','pending_delete','redemption','reserved')),
      dns_servers TEXT DEFAULT '',
      auto_renew INTEGER DEFAULT 0,
      is_held INTEGER DEFAULT 0,
      hold_cost REAL DEFAULT 0,
      memo TEXT DEFAULT '',
      encrypted_data TEXT DEFAULT '',
      is_public INTEGER DEFAULT 0,
      show_price REAL DEFAULT 0,
      price_type TEXT DEFAULT 'inquiry',
      show_description TEXT DEFAULT '',
      show_category_id INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS renewal_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id INTEGER NOT NULL,
      renewal_date TEXT NOT NULL,
      renewal_years INTEGER NOT NULL DEFAULT 1,
      renewal_price REAL NOT NULL DEFAULT 0,
      registrar TEXT DEFAULT '',
      memo TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_backup_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('export','import','sync')),
      status TEXT NOT NULL CHECK(status IN ('success','failed')),
      file_name TEXT DEFAULT '',
      record_count INTEGER DEFAULT 0,
      details TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#3B82F6',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS domain_tags (
      domain_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (domain_id, tag_id),
      FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS whois_query_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_name TEXT NOT NULL,
      query_result TEXT DEFAULT '',
      raw_data TEXT DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('success','failed')),
      error_message TEXT DEFAULT '',
      queried_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS show_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id INTEGER,
      domain_name TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      wechat TEXT DEFAULT '',
      company TEXT DEFAULT '',
      budget TEXT DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','contacted','closed','invalid')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_domains_account_id ON domains(account_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_account_domain ON domains(account_id, domain_name);
    CREATE INDEX IF NOT EXISTS idx_domains_domain_name ON domains(domain_name);
    CREATE INDEX IF NOT EXISTS idx_domains_tld ON domains(tld);
    CREATE INDEX IF NOT EXISTS idx_domains_registrar ON domains(registrar);
    CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
    CREATE INDEX IF NOT EXISTS idx_domains_expiry_date ON domains(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_renewal_records_domain_id ON renewal_records(domain_id);
    CREATE INDEX IF NOT EXISTS idx_renewal_records_renewal_date ON renewal_records(renewal_date);
    CREATE INDEX IF NOT EXISTS idx_domain_tags_domain_id ON domain_tags(domain_id);
    CREATE INDEX IF NOT EXISTS idx_domain_tags_tag_id ON domain_tags(tag_id);
    CREATE INDEX IF NOT EXISTS idx_whois_query_logs_domain_name ON whois_query_logs(domain_name);
    CREATE INDEX IF NOT EXISTS idx_sync_backup_logs_type ON sync_backup_logs(type);
    CREATE INDEX IF NOT EXISTS idx_domains_is_public ON domains(is_public);
    CREATE INDEX IF NOT EXISTS idx_domains_is_featured ON domains(is_featured);
    CREATE INDEX IF NOT EXISTS idx_domains_show_category_id ON domains(show_category_id);
  `)

  // Migration: add account_id column if missing
  const domainCols = db.prepare("PRAGMA table_info(domains)").all() as { name: string }[]
  if (!domainCols.some(c => c.name === 'account_id')) {
    db.exec(`ALTER TABLE domains ADD COLUMN account_id INTEGER NOT NULL DEFAULT 0`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_domains_account_id ON domains(account_id)`)
  }

  // Migration: add showcase columns to accounts table
  const accountCols = db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[]
  if (!accountCols.some(c => c.name === 'is_public')) {
    db.exec(`ALTER TABLE accounts ADD COLUMN is_public INTEGER DEFAULT 0`)
  }
  if (!accountCols.some(c => c.name === 'contact_email')) {
    db.exec(`ALTER TABLE accounts ADD COLUMN contact_email TEXT DEFAULT ''`)
  }
  if (!accountCols.some(c => c.name === 'contact_wechat')) {
    db.exec(`ALTER TABLE accounts ADD COLUMN contact_wechat TEXT DEFAULT ''`)
  }

  // Migration: add showcase columns to domains table
  if (!domainCols.some(c => c.name === 'is_public')) {
    db.exec(`ALTER TABLE domains ADD COLUMN is_public INTEGER DEFAULT 0`)
  }
  if (!domainCols.some(c => c.name === 'show_price')) {
    db.exec(`ALTER TABLE domains ADD COLUMN show_price REAL DEFAULT 0`)
  }
  if (!domainCols.some(c => c.name === 'price_type')) {
    db.exec(`ALTER TABLE domains ADD COLUMN price_type TEXT DEFAULT 'inquiry'`)
  }
  if (!domainCols.some(c => c.name === 'show_description')) {
    db.exec(`ALTER TABLE domains ADD COLUMN show_description TEXT DEFAULT ''`)
  }
  if (!domainCols.some(c => c.name === 'show_category_id')) {
    db.exec(`ALTER TABLE domains ADD COLUMN show_category_id INTEGER DEFAULT 0`)
  }
  if (!domainCols.some(c => c.name === 'is_featured')) {
    db.exec(`ALTER TABLE domains ADD COLUMN is_featured INTEGER DEFAULT 0`)
  }
  if (!domainCols.some(c => c.name === 'view_count')) {
    db.exec(`ALTER TABLE domains ADD COLUMN view_count INTEGER DEFAULT 0`)
  }

  // Drop old unique constraint on domain_name if it exists (from original schema)
  try {
    db.exec(`DROP INDEX IF EXISTS idx_domains_domain_name`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_domains_domain_name ON domains(domain_name)`)
  } catch { /* ignore */ }

  // Insert default settings if empty
  const count = db.prepare('SELECT COUNT(*) as cnt FROM settings').get() as { cnt: number }
  if (count.cnt === 0) {
    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
    const defaults: [string, string][] = [
      ['expire_reminder_days', '30'],
      ['theme', 'light'],
      ['language', 'zh-CN'],
      ['page_size', '20'],
    ]
    const insertMany = db.transaction((items: [string, string][]) => {
      for (const [key, value] of items) {
        insertSetting.run(key, value)
      }
    })
    insertMany(defaults)
  }
}
