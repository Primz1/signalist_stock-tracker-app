// test-db-connection.js
require('dotenv').config(); // Load environment variables
const { connectToDatabase } = require('./database/mongoose');

async function testConnection() {
    try {
        console.log('Attempting to connect to MongoDB...');
        await connectToDatabase();
        console.log('✅ Database connection successful!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
}

testConnection();