import fs from "fs";

const p = "./src/skills/osint/ingest-workers.ts";
let content = fs.readFileSync(p, "utf8");

content = content.replace(
  /const dbPath = path\.join\(DB_DIR, "osint-cache\.sqlite"\);\nconst db = new Database\(dbPath\);([\s\S]*?)CREATE INDEX IF NOT EXISTS idx_ships_fetched ON ships_cache\(fetched_at\);\n`\);/m,
  `const dbPath = path.join(DB_DIR, "osint-cache.sqlite");
let _db = null;

function getDb() {
  if (_db) return _db;
  _db = new Database(dbPath);
  _db.exec(\`
    CREATE TABLE IF NOT EXISTS flights_cache (
      icao24 TEXT PRIMARY KEY,
      callsign TEXT,
      origin_country TEXT,
      time_position INTEGER,
      last_contact INTEGER,
      longitude REAL,
      latitude REAL,
      baro_altitude REAL,
      on_ground INTEGER,
      velocity REAL,
      true_track REAL,
      vertical_rate REAL,
      geo_altitude REAL,
      fetched_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS ships_cache (
      mmsi TEXT PRIMARY KEY,
      time_utc TEXT,
      latitude REAL,
      longitude REAL,
      cog REAL,
      sog REAL,
      heading INTEGER,
      nav_status INTEGER,
      fetched_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_flights_geo ON flights_cache(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_flights_fetched ON flights_cache(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_ships_geo ON ships_cache(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_ships_fetched ON ships_cache(fetched_at);
  \`);
  return _db;
}`,
);

content = content.replace(/\bdb\./g, "getDb().");
fs.writeFileSync(p, content, "utf8");
