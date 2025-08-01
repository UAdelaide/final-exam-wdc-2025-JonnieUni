var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql = require('mysql2/promise');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', indexRouter);
app.use('/users', usersRouter);

let db;

(async function () {
    try{
        // Creating a database if it does not exist
        var connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: ''
        });

        await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
        await connection.end();

        // Connecting to the DogWalkService Database
        db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'DogWalkService'
        });

        // Create tables if they don't exist
        await db.execute(`
            CREATE TABLE IF NOT EXISTS Users (
            user_id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('owner', 'walker') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS Dogs (
            dog_id INT AUTO_INCREMENT PRIMARY KEY,
            owner_id INT NOT NULL,
            name VARCHAR(50) NOT NULL,
            size ENUM('small', 'medium', 'large') NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES Users(user_id)
        )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS WalkRequests (
            request_id INT AUTO_INCREMENT PRIMARY KEY,
            dog_id INT NOT NULL,
            requested_time DATETIME NOT NULL,
            duration_minutes INT NOT NULL,
            location VARCHAR(255) NOT NULL,
            status ENUM('open', 'accepted', 'completed', 'cancelled') DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (dog_id) REFERENCES Dogs(dog_id)
        )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS WalkApplications (
            application_id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            walker_id INT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
            FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
            FOREIGN KEY (walker_id) REFERENCES Users(user_id),
            CONSTRAINT unique_application UNIQUE (request_id, walker_id)
        )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS WalkRatings (
            rating_id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            walker_id INT NOT NULL,
            owner_id INT NOT NULL,
            rating INT CHECK (rating BETWEEN 1 AND 5),
            comments TEXT,
            rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (request_id) REFERENCES WalkRequests(request_id),
            FOREIGN KEY (walker_id) REFERENCES Users(user_id),
            FOREIGN KEY (owner_id) REFERENCES Users(user_id),
            CONSTRAINT unique_rating_per_walk UNIQUE (request_id)
        )
        `);

        // Inserting data onily if Users table is empty
        var [userRows] = await db.execute('SELECT COUNT(*) AS count FROM Users');
        if (userRows[0].count === 0) {
            await db.query(`
                INSERT INTO Users (username, email, password_hash, role)
                VALUES
                ('alice123', 'alice@example.com', 'hashed123', 'owner'),
                ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
                ('carol123', 'carol@example.com', 'hashed789', 'owner'),
                ('davidsmith', 'david@example.com', 'hashed999', 'walker'),
                ('jon123', 'jon@example.com', 'hashed000', 'owner');
            `);

            await db.query(`
                INSERT INTO Dogs (owner_id, name, size)
                VALUES
                ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Max', 'medium'),
                ((SELECT user_id FROM Users WHERE username = 'carol123'), 'Bella', 'small'),
                ((SELECT user_id FROM Users WHERE username = 'alice123'), 'Rocky', 'large'),
                ((SELECT user_id FROM Users WHERE username = 'jon123'), 'Luna', 'medium'),
                ((SELECT user_id FROM Users WHERE username = 'jon123'), 'Coco', 'small');
            `);

            await db.query(`
                INSERT INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status)
                VALUES
                ((SELECT dog_id FROM Dogs WHERE name = 'Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
                ((SELECT dog_id FROM Dogs WHERE name = 'Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
                ((SELECT dog_id FROM Dogs WHERE name = 'Rocky'), '2025-06-11 07:00:00', 60, 'City Trail', 'open'),
                ((SELECT dog_id FROM Dogs WHERE name = 'Luna'), '2025-06-11 10:00:00', 20, 'Riverside Park', 'completed'),
                ((SELECT dog_id FROM Dogs WHERE name = 'Coco'), '2025-06-12 09:00:00', 40, 'Hillside Path', 'cancelled');
            `);

            await db.query(`
                INSERT INTO WalkRatings (request_id, walker_id, owner_id, rating)
                VALUES
                (1, (SELECT user_id FROM Users WHERE username = 'bobwalker'), (SELECT user_id FROM Users WHERE username = 'alice123'), 5),
                (2, (SELECT user_id FROM Users WHERE username = 'bobwalker'), (SELECT user_id FROM Users WHERE username = 'carol123'), 4)
            `);
        }
    } catch (err) {
        console.error('Error setting up database', err);
    }

}());

// ROUTES
// GET /api/dogs

app.get('/api/dogs', async function (req, res) {
    try {
        var[rows] = await db.query(`
            SELECT Dogs.name AS dog_name, Dogs.size, Users.username AS owner_username
            FROM Dogs
            JOIN Users ON Dogs.owner_id = Users.user_id
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch dogs', details: err.message });
    }
});

// GET /api/walkrequests/open
app.get('/api/walkrequests/open', async function (req, res) {
    try {
        var [rows] = await db.query(`
            SELECT
                WalkRequests.request_id,
                Dogs.name AS dog_name,
                WalkRequests.requested_time,
                WalkRequests.duration_minutes,
                WalkRequests.location,
                Users.username AS owner_username
            FROM WalkRequests
            JOIN Dogs ON WalkRequests.dog_id = Dogs.dog_id
            JOIN Users ON Dogs.owner_id = Users.user_id
            WHERE WalkRequests.status = 'open'
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch walk requests', details: err.message });
    }
});

// GET /api/walkers/summary
app.get('/api/walkers/summary', async function (req, res) {
    try {
        var [rows] = await db.query(`
            SELECT
                u.username AS walker_username,
                COUNT(r.rating_id) AS total_ratings,
                ROUND(AVG(r.rating), 1) AS average_rating,
                (
                SELECT COUNT(*)
                FROM WalkRequests wr
                JOIN WalkApplications wa ON wr.request_id = wa.request_id
                WHERE wa.walker_id = u.user_id AND wr.status = 'completed'
                ) AS compelted_walks
            FROM Users u
            LEFT JOIN WalkRatings r ON u.user_id = r.walker_id
            WHERE u.role = 'walker'
            GROUP BY u.username
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch walker summary', details: err.message });
    }
});

app.use(express.static(path.join(__dirname, 'public')));


module.exports = app;
