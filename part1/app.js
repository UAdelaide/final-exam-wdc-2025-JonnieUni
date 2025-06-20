var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mysql require('mysql2/promise')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

let db;

(async function () {
    try{
        // Creating a database if it does not exist
        var connection = await mysql.createConnection({
            host:'localhost',
            user: 'root',
            password: ''
        });

        await connection.query('CREATE DATABASE IF NOT EXISTS DogWalkService');
        await connection.end();

        // Connecting to the DogWalkService Database
        db = await mysql.createConnection({
            host: 'localhost',
            user: 'root'
            password: '',
            database: DogWalkService
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
                INSERT INTO Users (username, email, password_hash, role)
                VALUES
                ('alice123', 'alice@example.com', 'hashed123', 'owner'),
                ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
                ('carol123', 'carol@example.com', 'hashed789', 'owner'),
                ('davidsmith', 'david@example.com', 'hashed999', 'walker'),
                ('jon123', 'jon@example.com', 'hashed000', 'owner');
            `);
        }
    }
})

module.exports = app;
