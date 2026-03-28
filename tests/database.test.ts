import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, unlinkSync, readFileSync } from 'fs'

describe('Database Schema', () => {
  let db: any
  const testDbPath = '/tmp/unmi-test.db'

  beforeAll(() => {
    if (existsSync(testDbPath)) unlinkSync(testDbPath)

    // Set DB_PATH so that if useDatabase is ever called, it won't touch prod
    process.env.DB_PATH = testDbPath

    db = new Database(testDbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')
    db.pragma('synchronous = NORMAL')

    // Extract and execute the CREATE TABLE SQL from the database module source
    // We inline the schema here to test it independently
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        is_public INTEGER DEFAULT 0,
        contact_email TEXT DEFAULT '',
        contact_wechat TEXT DEFAULT '',
        verify_token TEXT DEFAULT '',
        totp_enabled INTEGER DEFAULT 0,
        device_auth_enabled INTEGER DEFAULT 0,
        passkey_enabled INTEGER DEFAULT 0,
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
        registrant_name TEXT DEFAULT '',
        registrant_org TEXT DEFAULT '',
        registrant_email TEXT DEFAULT '',
        registrant_phone TEXT DEFAULT '',
        registrant_country TEXT DEFAULT '',
        registrant_province TEXT DEFAULT '',
        registrant_city TEXT DEFAULT '',
        registrant_address TEXT DEFAULT '',
        admin_name TEXT DEFAULT '',
        admin_email TEXT DEFAULT '',
        tech_name TEXT DEFAULT '',
        tech_email TEXT DEFAULT '',
        is_verified INTEGER DEFAULT 0,
        verified_at TEXT DEFAULT '',
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

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        domain_id INTEGER,
        domain_name TEXT DEFAULT '',
        is_read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS notification_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT NOT NULL DEFAULT '',
        UNIQUE(account_id, setting_key)
      );

      CREATE TABLE IF NOT EXISTS domain_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_id INTEGER NOT NULL,
        view_date TEXT NOT NULL,
        view_count INTEGER DEFAULT 1,
        UNIQUE(domain_id, view_date),
        FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS drop_domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain_name TEXT NOT NULL COLLATE NOCASE,
        tld TEXT NOT NULL,
        drop_date TEXT,
        status TEXT DEFAULT 'pending_delete',
        source TEXT DEFAULT '',
        registrar TEXT DEFAULT '',
        estimated_value INTEGER DEFAULT 0,
        auction_price INTEGER DEFAULT 0,
        domain_length INTEGER DEFAULT 0,
        has_numbers INTEGER DEFAULT 0,
        has_hyphens INTEGER DEFAULT 0,
        is_pure_letters INTEGER DEFAULT 0,
        is_pure_numbers INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(domain_name)
      );

      CREATE TABLE IF NOT EXISTS domain_watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        domain_name TEXT NOT NULL COLLATE NOCASE,
        tld TEXT NOT NULL,
        note TEXT DEFAULT '',
        status TEXT DEFAULT 'watching',
        expiry_date TEXT,
        last_checked TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(account_id, domain_name)
      );

      CREATE TABLE IF NOT EXISTS device_auth (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT DEFAULT '',
        device_fingerprint TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        last_used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(account_id, device_id),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS totp_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL UNIQUE,
        secret TEXT NOT NULL,
        is_enabled INTEGER DEFAULT 0,
        backup_codes TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS passkey_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        credential_id TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        counter INTEGER DEFAULT 0,
        device_name TEXT DEFAULT '',
        transports TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_used_at TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      -- Indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_account_domain ON domains(account_id, domain_name);
      CREATE INDEX IF NOT EXISTS idx_domains_domain_name ON domains(domain_name);
      CREATE INDEX IF NOT EXISTS idx_domains_tld ON domains(tld);
    `)
  })

  afterAll(() => {
    db?.close()
    if (existsSync(testDbPath)) unlinkSync(testDbPath)
  })

  it('should create all expected tables', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    const tableNames = tables.map((t: any) => t.name)
    expect(tableNames).toContain('accounts')
    expect(tableNames).toContain('domains')
    expect(tableNames).toContain('tags')
    expect(tableNames).toContain('domain_tags')
    expect(tableNames).toContain('renewal_records')
    expect(tableNames).toContain('settings')
    expect(tableNames).toContain('drop_domains')
    expect(tableNames).toContain('device_auth')
    expect(tableNames).toContain('totp_config')
    expect(tableNames).toContain('passkey_credentials')
    expect(tableNames).toContain('notifications')
    expect(tableNames).toContain('notification_settings')
    expect(tableNames).toContain('domain_views')
    expect(tableNames).toContain('inquiries')
    expect(tableNames).toContain('show_categories')
    expect(tableNames).toContain('whois_query_logs')
    expect(tableNames).toContain('sync_backup_logs')
    expect(tableNames).toContain('migrations')
    expect(tableNames).toContain('faqs')
    expect(tableNames).toContain('domain_watchlist')
  })

  it('should have correct domains table columns', () => {
    const cols = db.prepare('PRAGMA table_info(domains)').all()
    const colNames = cols.map((c: any) => c.name)
    expect(colNames).toContain('account_id')
    expect(colNames).toContain('domain_name')
    expect(colNames).toContain('tld')
    expect(colNames).toContain('registrar')
    expect(colNames).toContain('is_verified')
    expect(colNames).toContain('is_public')
    expect(colNames).toContain('encrypted_data')
    expect(colNames).toContain('registrant_name')
    expect(colNames).toContain('registrant_email')
    expect(colNames).toContain('show_price')
    expect(colNames).toContain('price_type')
    expect(colNames).toContain('show_category_id')
    expect(colNames).toContain('is_featured')
    expect(colNames).toContain('view_count')
  })

  it('should have correct accounts table columns', () => {
    const cols = db.prepare('PRAGMA table_info(accounts)').all()
    const colNames = cols.map((c: any) => c.name)
    expect(colNames).toContain('password_hash')
    expect(colNames).toContain('verify_token')
    expect(colNames).toContain('totp_enabled')
    expect(colNames).toContain('device_auth_enabled')
    expect(colNames).toContain('passkey_enabled')
    expect(colNames).toContain('is_public')
    expect(colNames).toContain('contact_email')
    expect(colNames).toContain('contact_wechat')
  })

  it('should insert and query domains', () => {
    db.prepare("INSERT INTO accounts (name, password_hash) VALUES ('test', 'hash')").run()
    db.prepare("INSERT INTO domains (account_id, domain_name, tld, expiry_date) VALUES (1, 'test.com', '.com', '2027-01-01')").run()
    const domain = db.prepare("SELECT * FROM domains WHERE domain_name = 'test.com'").get()
    expect(domain).toBeDefined()
    expect(domain.account_id).toBe(1)
    expect(domain.tld).toBe('.com')
    expect(domain.expiry_date).toBe('2027-01-01')
  })

  it('should enforce unique domain per account', () => {
    expect(() => {
      db.prepare("INSERT INTO domains (account_id, domain_name, tld) VALUES (1, 'test.com', '.com')").run()
    }).toThrow()
  })

  it('should allow same domain in different accounts', () => {
    db.prepare("INSERT INTO accounts (name, password_hash) VALUES ('test2', 'hash2')").run()
    expect(() => {
      db.prepare("INSERT INTO domains (account_id, domain_name, tld) VALUES (2, 'test.com', '.com')").run()
    }).not.toThrow()
  })

  it('should cascade delete renewal records when domain is deleted', () => {
    db.prepare("INSERT INTO domains (account_id, domain_name, tld) VALUES (1, 'cascade-test.com', '.com')").run()
    const domainId = db.prepare("SELECT id FROM domains WHERE domain_name = 'cascade-test.com' AND account_id = 1").get().id
    db.prepare('INSERT INTO renewal_records (domain_id, renewal_date, renewal_price) VALUES (?, ?, ?)')
      .run(domainId, '2025-01-01', 10)
    db.prepare('DELETE FROM domains WHERE id = ?').run(domainId)
    const records = db.prepare('SELECT * FROM renewal_records WHERE domain_id = ?').all(domainId)
    expect(records).toHaveLength(0)
  })

  it('should enforce domain status check constraint', () => {
    expect(() => {
      db.prepare("INSERT INTO domains (account_id, domain_name, tld, status) VALUES (1, 'bad-status.com', '.com', 'invalid_status')").run()
    }).toThrow()
  })

  it('should support tags with unique names', () => {
    db.prepare("INSERT INTO tags (name, color) VALUES ('premium', '#FF0000')").run()
    expect(() => {
      db.prepare("INSERT INTO tags (name, color) VALUES ('premium', '#00FF00')").run()
    }).toThrow()
  })

  it('should insert and query settings', () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('test_key', 'test_value')").run()
    const setting = db.prepare("SELECT * FROM settings WHERE key = 'test_key'").get()
    expect(setting).toBeDefined()
    expect(setting.value).toBe('test_value')
  })

  it('should enforce unique drop domain names', () => {
    db.prepare("INSERT INTO drop_domains (domain_name, tld) VALUES ('drop.com', '.com')").run()
    expect(() => {
      db.prepare("INSERT INTO drop_domains (domain_name, tld) VALUES ('drop.com', '.com')").run()
    }).toThrow()
  })
})
