import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("rankify.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    base_fee REAL DEFAULT 10.0
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    plate_number TEXT PRIMARY KEY,
    driver_name TEXT NOT NULL,
    phone_number TEXT,
    capacity INTEGER DEFAULT 15,
    owner_id INTEGER,
    route_id INTEGER,
    FOREIGN KEY(owner_id) REFERENCES users(id),
    FOREIGN KEY(route_id) REFERENCES routes(id)
  );

  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id TEXT NOT NULL,
    check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Waiting',
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(plate_number)
  );

  CREATE TABLE IF NOT EXISTS trip_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id TEXT NOT NULL,
    departure_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    marshal_id TEXT,
    fee_paid BOOLEAN DEFAULT 0,
    route_id INTEGER,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(plate_number),
    FOREIGN KEY (route_id) REFERENCES routes(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    content TEXT,
    type TEXT, -- 'SMS', 'Push', 'Internal'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id)
  );

  INSERT OR IGNORE INTO users (email, password, role, name) VALUES 
  ('admin@rankify.com', 'admin123', 'Admin', 'Association Admin'),
  ('marshal@rankify.com', 'marshal123', 'Marshal', 'John Marshal'),
  ('owner@rankify.com', 'owner123', 'Owner', 'Kombi Owner Joe');

  INSERT OR IGNORE INTO routes (name, base_fee) VALUES 
  ('City - Mbare', 10.0),
  ('City - Chitungwiza', 15.0),
  ('City - Epworth', 8.0);
`);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Auth
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT id, email, role, name FROM users WHERE email = ? AND password = ?").get(email, password) as any;
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // API Routes
  
  // Vehicles
  app.get("/api/vehicles", (req, res) => {
    const { owner_id } = req.query;
    let query = "SELECT v.*, r.name as route_name FROM vehicles v LEFT JOIN routes r ON v.route_id = r.id";
    let params = [];
    if (owner_id) {
      query += " WHERE v.owner_id = ?";
      params.push(owner_id);
    }
    const vehicles = db.prepare(query).all(...params);
    res.json(vehicles);
  });

  app.post("/api/vehicles", (req, res) => {
    const { plate_number, driver_name, phone_number, capacity, owner_id, route_id } = req.body;
    try {
      db.prepare("INSERT INTO vehicles (plate_number, driver_name, phone_number, capacity, owner_id, route_id) VALUES (?, ?, ?, ?, ?, ?)")
        .run(plate_number, driver_name, phone_number, capacity, owner_id || null, route_id || null);
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/vehicles/:plate", (req, res) => {
    db.prepare("DELETE FROM vehicles WHERE plate_number = ?").run(req.params.plate);
    res.json({ success: true });
  });

  // Routes
  app.get("/api/routes", (req, res) => {
    res.json(db.prepare("SELECT * FROM routes").all());
  });

  app.post("/api/routes", (req, res) => {
    const { name, base_fee } = req.body;
    try {
      db.prepare("INSERT INTO routes (name, base_fee) VALUES (?, ?)").run(name, base_fee);
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/routes/:id", (req, res) => {
    db.prepare("DELETE FROM routes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Users
  app.get("/api/users", (req, res) => {
    res.json(db.prepare("SELECT id, email, role, name FROM users").all());
  });

  app.post("/api/users", (req, res) => {
    const { email, password, role, name } = req.body;
    try {
      db.prepare("INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)").run(email, password, role, name);
      res.status(201).json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Messages / Notifications
  app.get("/api/messages", (req, res) => {
    const messages = db.prepare(`
      SELECT m.*, u.name as sender_name 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      ORDER BY m.timestamp DESC 
      LIMIT 50
    `).all();
    res.json(messages);
  });

  app.post("/api/messages", (req, res) => {
    const { sender_id, content, type } = req.body;
    db.prepare("INSERT INTO messages (sender_id, content, type) VALUES (?, ?, ?)")
      .run(sender_id, content, type || 'Internal');
    res.status(201).json({ success: true });
  });

  // Queue
  app.get("/api/queue", (req, res) => {
    const queue = db.prepare(`
      SELECT q.*, v.driver_name, v.capacity, r.name as route_name
      FROM queue q 
      JOIN vehicles v ON q.vehicle_id = v.plate_number 
      LEFT JOIN routes r ON v.route_id = r.id
      WHERE q.status = 'Waiting' OR q.status = 'Loading'
      ORDER BY q.check_in_time ASC
    `).all();
    res.json(queue);
  });

  app.post("/api/queue/check-in", (req, res) => {
    const { plate_number } = req.body;
    
    // Check if vehicle exists
    const vehicle = db.prepare("SELECT * FROM vehicles WHERE plate_number = ?").get(plate_number);
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not registered" });
    }

    // Check if already in queue
    const inQueue = db.prepare("SELECT * FROM queue WHERE vehicle_id = ? AND (status = 'Waiting' OR status = 'Loading')").get(plate_number);
    if (inQueue) {
      return res.status(400).json({ error: "Vehicle already in queue" });
    }

    db.prepare("INSERT INTO queue (vehicle_id) VALUES (?)").run(plate_number);
    res.status(201).json({ success: true });
  });

  app.post("/api/queue/dispatch", (req, res) => {
    const { queue_id, marshal_id, fee_paid } = req.body;
    
    const entry = db.prepare("SELECT q.*, v.route_id FROM queue q JOIN vehicles v ON q.vehicle_id = v.plate_number WHERE q.id = ?").get(queue_id) as any;
    if (!entry) return res.status(404).json({ error: "Queue entry not found" });

    const transaction = db.transaction(() => {
      db.prepare("UPDATE queue SET status = 'Departed' WHERE id = ?").run(queue_id);
      db.prepare("INSERT INTO trip_logs (vehicle_id, marshal_id, fee_paid, route_id) VALUES (?, ?, ?, ?)")
        .run(entry.vehicle_id, marshal_id, fee_paid ? 1 : 0, entry.route_id);
    });

    transaction();
    res.json({ success: true });
  });

  // Trip Logs
  app.get("/api/trip-logs", (req, res) => {
    const { owner_id } = req.query;
    let query = `
      SELECT t.*, v.driver_name, r.name as route_name 
      FROM trip_logs t 
      JOIN vehicles v ON t.vehicle_id = v.plate_number 
      LEFT JOIN routes r ON t.route_id = r.id
    `;
    let params = [];
    if (owner_id) {
      query += " WHERE v.owner_id = ?";
      params.push(owner_id);
    }
    query += " ORDER BY t.departure_time DESC";
    
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  });

  app.get("/api/stats/admin", (req, res) => {
    const todayTrips = db.prepare(`
      SELECT COUNT(*) as total_trips, SUM(CASE WHEN fee_paid = 1 THEN 10 ELSE 0 END) as revenue
      FROM trip_logs 
      WHERE date(departure_time) = date('now')
    `).get() as any;

    const peakHours = db.prepare(`
      SELECT strftime('%H', departure_time) as hour, COUNT(*) as count
      FROM trip_logs
      WHERE departure_time >= datetime('now', '-7 days')
      GROUP BY hour
      ORDER BY hour ASC
    `).all();

    const activeMarshals = db.prepare(`
      SELECT COUNT(DISTINCT marshal_id) as count FROM trip_logs WHERE date(departure_time) = date('now')
    `).get() as any;

    const routeStats = db.prepare(`
      SELECT r.name as route_name, COUNT(t.id) as trip_count
      FROM routes r
      LEFT JOIN trip_logs t ON r.id = t.route_id AND date(t.departure_time) = date('now')
      GROUP BY r.name
    `).all();

    res.json({
      total_trips: todayTrips.total_trips || 0,
      revenue: todayTrips.revenue || 0,
      active_marshals: activeMarshals.count || 0,
      peak_hours: peakHours,
      route_stats: routeStats
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
