const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ PostgreSQL Connection Error:', err.message);
    } else {
        console.log('✅ PostgreSQL Connected Successfully');
        createTables();
    }
    release();
});

// Create tables if not exists
async function createTables() {
    try {
        // Clients table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                email VARCHAR(200),
                phone VARCHAR(50),
                company VARCHAR(200),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Clients table ready');

        // Projects table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id),
                name VARCHAR(200) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                start_date DATE,
                end_date DATE,
                budget DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Projects table ready');

        // Invoices table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                client_id INTEGER REFERENCES clients(id),
                invoice_number VARCHAR(50) UNIQUE,
                amount DECIMAL(10,2),
                status VARCHAR(50) DEFAULT 'unpaid',
                due_date DATE,
                paid_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Invoices table ready');

        // Tasks table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id),
                title VARCHAR(200) NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                priority VARCHAR(20) DEFAULT 'medium',
                due_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tasks table ready');

    } catch (error) {
        console.error('Table creation error:', error);
    }
}

// ==================== CLIENTS API ====================

// Get all clients
app.get('/api/clients', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single client
app.get('/api/clients/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create client
app.post('/api/clients', async (req, res) => {
    const { name, email, phone, company, address } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO clients (name, email, phone, company, address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, email, phone, company, address]
        );
        res.json({ success: true, client: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update client
app.put('/api/clients/:id', async (req, res) => {
    const { name, email, phone, company, address } = req.body;
    try {
        const result = await pool.query(
            'UPDATE clients SET name = $1, email = $2, phone = $3, company = $4, address = $5 WHERE id = $6 RETURNING *',
            [name, email, phone, company, address, req.params.id]
        );
        res.json({ success: true, client: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete client
app.delete('/api/clients/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== PROJECTS API ====================

app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, c.name as client_name 
            FROM projects p 
            LEFT JOIN clients c ON p.client_id = c.id 
            ORDER BY p.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/projects', async (req, res) => {
    const { client_id, name, description, status, start_date, end_date, budget } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO projects (client_id, name, description, status, start_date, end_date, budget) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [client_id, name, description, status, start_date, end_date, budget]
        );
        res.json({ success: true, project: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    const { name, description, status, end_date } = req.body;
    try {
        const result = await pool.query(
            'UPDATE projects SET name = $1, description = $2, status = $3, end_date = $4 WHERE id = $5 RETURNING *',
            [name, description, status, end_date, req.params.id]
        );
        res.json({ success: true, project: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== INVOICES API ====================

app.get('/api/invoices', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT i.*, c.name as client_name 
            FROM invoices i 
            LEFT JOIN clients c ON i.client_id = c.id 
            ORDER BY i.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/invoices', async (req, res) => {
    const { client_id, invoice_number, amount, status, due_date } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO invoices (client_id, invoice_number, amount, status, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [client_id, invoice_number, amount, status, due_date]
        );
        res.json({ success: true, invoice: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/invoices/:id', async (req, res) => {
    const { status, paid_date } = req.body;
    try {
        const result = await pool.query(
            'UPDATE invoices SET status = $1, paid_date = $2 WHERE id = $3 RETURNING *',
            [status, paid_date, req.params.id]
        );
        res.json({ success: true, invoice: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/invoices/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== TASKS API ====================

app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT t.*, p.name as project_name 
            FROM tasks t 
            LEFT JOIN projects p ON t.project_id = p.id 
            ORDER BY t.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks', async (req, res) => {
    const { project_id, title, description, status, priority, due_date } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO tasks (project_id, title, description, status, priority, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [project_id, title, description, status, priority, due_date]
        );
        res.json({ success: true, task: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    const { status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );
        res.json({ success: true, task: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== DASHBOARD STATS ====================

app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const clients = await pool.query('SELECT COUNT(*) FROM clients');
        const projects = await pool.query('SELECT COUNT(*) FROM projects');
        const invoices = await pool.query('SELECT SUM(amount) FROM invoices WHERE status = $1', ['paid']);
        const pendingTasks = await pool.query('SELECT COUNT(*) FROM tasks WHERE status = $1', ['pending']);
        
        res.json({
            totalClients: parseInt(clients.rows[0].count),
            totalProjects: parseInt(projects.rows[0].count),
            totalRevenue: parseFloat(invoices.rows[0].sum) || 0,
            pendingTasks: parseInt(pendingTasks.rows[0].count)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`
========================================
  🏢 SoftSys Solutions Manager
  Server running on port ${PORT}
  http://localhost:${PORT}
========================================
    `);
});