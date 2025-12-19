require('dotenv').config();
const path = require('path');

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

// Temporary route to initialize database
const fs = require('fs');
app.get('/setup-db', async (req, res) => {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        res.send('Database initialized successfully! You can now login.');
    } catch (err) {
        res.status(500).send('Error initializing database: ' + err.message);
    }
});

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error acquiring client', err.stack);
        console.log('Please ensure PostgreSQL is running and you have created the database using schema.sql');
    } else {
        console.log('Connected to PostgreSQL database');
        release();
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// API Routes

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = $1 AND password = $2';
    try {
        const { rows } = await pool.query(query, [username, password]);
        if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

        const user = rows[0];
        res.json({
            id: user.id,
            username: user.username,
            role: user.role,
            vacation_balance: user.vacation_balance,
            sick_leave_balance: user.sick_leave_balance
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all leaves (Manager) or User leaves
app.get('/api/leaves', async (req, res) => {
    const { user_id, role } = req.query;

    let query = 'SELECT leave_requests.*, users.username FROM leave_requests JOIN users ON leave_requests.user_id = users.id';
    let params = [];

    if (role !== 'manager') {
        query += ' WHERE user_id = $1';
        params.push(user_id);
    }

    query += ' ORDER BY created_at DESC';

    try {
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit Leave Request
app.post('/api/leaves', async (req, res) => {
    const { user_id, start_date, end_date, leave_type, reason } = req.body;
    const query = 'INSERT INTO leave_requests (user_id, start_date, end_date, leave_type, reason) VALUES ($1, $2, $3, $4, $5) RETURNING id';

    try {
        const { rows } = await pool.query(query, [user_id, start_date, end_date, leave_type, reason]);
        res.json({ message: 'Leave request submitted', id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Leave Status (Manager)
app.put('/api/leaves/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, manager_comment } = req.body;

    const query = 'UPDATE leave_requests SET status = $1, manager_comment = $2 WHERE id = $3';

    try {
        await pool.query(query, [status, manager_comment, id]);
        res.json({ message: 'Leave status updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User Balance
app.get('/api/users/:id/balance', async (req, res) => {
    const { id } = req.params;
    const query = 'SELECT vacation_balance, sick_leave_balance FROM users WHERE id = $1';
    try {
        const { rows } = await pool.query(query, [id]);
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
