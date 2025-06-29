import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Create data directory if it doesn't exist
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'research-reader.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
const createTables = () => {
  // Documents table - stores PDF metadata and extracted text
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      extracted_text TEXT NOT NULL,
      page_count INTEGER NOT NULL,
      extracted_pages INTEGER NOT NULL,
      processing_status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Transcreations table - stores transcreated content
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcreations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      target_language TEXT NOT NULL,
      transcreated_text TEXT NOT NULL,
      original_length INTEGER NOT NULL,
      transcreated_length INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    )
  `);

  // Audio files table - stores generated audio metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transcreation_id INTEGER NOT NULL,
      language TEXT NOT NULL,
      voice_id TEXT,
      audio_size INTEGER,
      audio_data TEXT, -- Base64 encoded audio
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transcreation_id) REFERENCES transcreations (id) ON DELETE CASCADE
    )
  `);

  // Cache table - for storing frequently accessed data
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Highlights table - for future highlighting functionality
  db.exec(`
    CREATE TABLE IF NOT EXISTS highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      start_position INTEGER NOT NULL,
      end_position INTEGER NOT NULL,
      highlighted_text TEXT NOT NULL,
      note TEXT,
      color TEXT DEFAULT '#ffeb3b',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    )
  `);
};

// Initialize tables
createTables();

// Document operations
export const documentQueries = {
  insert: db.prepare(`
    INSERT INTO documents (filename, original_filename, file_size, extracted_text, page_count, extracted_pages)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  
  findById: db.prepare(`
    SELECT * FROM documents WHERE id = ?
  `),
  
  findByFilename: db.prepare(`
    SELECT * FROM documents WHERE filename = ?
  `),
  
  updateStatus: db.prepare(`
    UPDATE documents SET processing_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `),
  
  getAll: db.prepare(`
    SELECT id, filename, original_filename, file_size, page_count, processing_status, created_at 
    FROM documents 
    ORDER BY created_at DESC 
    LIMIT ?
  `),
  
  delete: db.prepare(`
    DELETE FROM documents WHERE id = ?
  `)
};

// Transcreation operations
export const transcreationQueries = {
  insert: db.prepare(`
    INSERT INTO transcreations (document_id, target_language, transcreated_text, original_length, transcreated_length)
    VALUES (?, ?, ?, ?, ?)
  `),
  
  findByDocumentAndLanguage: db.prepare(`
    SELECT * FROM transcreations 
    WHERE document_id = ? AND target_language = ?
    ORDER BY created_at DESC 
    LIMIT 1
  `),
  
  findByDocument: db.prepare(`
    SELECT * FROM transcreations WHERE document_id = ? ORDER BY created_at DESC
  `),
  
  delete: db.prepare(`
    DELETE FROM transcreations WHERE id = ?
  `)
};

// Audio operations
export const audioQueries = {
  insert: db.prepare(`
    INSERT INTO audio_files (transcreation_id, language, voice_id, audio_size, audio_data)
    VALUES (?, ?, ?, ?, ?)
  `),
  
  findByTranscreation: db.prepare(`
    SELECT * FROM audio_files WHERE transcreation_id = ? ORDER BY created_at DESC LIMIT 1
  `),
  
  delete: db.prepare(`
    DELETE FROM audio_files WHERE id = ?
  `)
};

// Cache operations
export const cacheQueries = {
  set: db.prepare(`
    INSERT OR REPLACE INTO cache (key, value, expires_at)
    VALUES (?, ?, ?)
  `),
  
  get: db.prepare(`
    SELECT value FROM cache 
    WHERE key = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `),
  
  delete: db.prepare(`
    DELETE FROM cache WHERE key = ?
  `),
  
  cleanup: db.prepare(`
    DELETE FROM cache WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
  `)
};

// Highlight operations (for future use)
export const highlightQueries = {
  insert: db.prepare(`
    INSERT INTO highlights (document_id, start_position, end_position, highlighted_text, note, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  
  findByDocument: db.prepare(`
    SELECT * FROM highlights WHERE document_id = ? ORDER BY start_position
  `),
  
  delete: db.prepare(`
    DELETE FROM highlights WHERE id = ?
  `)
};

// Utility functions
export const dbUtils = {
  // Clean up expired cache entries
  cleanupCache: () => {
    const result = cacheQueries.cleanup.run();
    console.log(`Cleaned up ${result.changes} expired cache entries`);
  },
  
  // Get database stats
  getStats: () => {
    const stats = {
      documents: db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number },
      transcreations: db.prepare('SELECT COUNT(*) as count FROM transcreations').get() as { count: number },
      audioFiles: db.prepare('SELECT COUNT(*) as count FROM audio_files').get() as { count: number },
      highlights: db.prepare('SELECT COUNT(*) as count FROM highlights').get() as { count: number },
      cacheEntries: db.prepare('SELECT COUNT(*) as count FROM cache').get() as { count: number }
    };
    return stats;
  },
  
  // Close database connection
  close: () => {
    db.close();
  }
};

export default db; 