-- All timestamps are UTC TEXT in "%Y-%m-%d %H:%M:%S" format (SQLite datetime('now'));
-- comparisons rely on lexicographic ordering of that format. BINARY collation everywhere:
-- short keys, orig URLs, and dict words are case-sensitive by design.

CREATE TABLE dict (
    word TEXT PRIMARY KEY,
    used INTEGER DEFAULT 0
);

CREATE TABLE urls (
    orig       TEXT,
    short      TEXT UNIQUE,                     -- UNIQUE index doubles as the concurrency guard
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT                             -- NULL = never expires
);

CREATE TABLE login (
    username TEXT PRIMARY KEY,
    password TEXT                               -- pbkdf2$<iterations>$<salt b64>$<hash b64>
);

CREATE INDEX idx_urls_orig ON urls(orig);
CREATE INDEX idx_urls_expires ON urls(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_dict_free ON dict(word) WHERE used = 0;

-- Default credentials: admin / password (change after first login)
INSERT INTO login (username, password) VALUES
('admin', 'pbkdf2$100000$I/3PIRTUbXeLEOYhShbQrw==$gT/GEuB1CrPa7URCcXVcOa8Pis48gWlA5yeq94SoLjQ=');
