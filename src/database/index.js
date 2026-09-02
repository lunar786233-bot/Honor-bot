const MongoDBManager = require('./mongoDb');

async function getDatabaseInstance() {
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri && mongoUri.startsWith('mongodb')) {
    console.log('⚡ MONGODB_URI detected. Initializing MongoDB Cloud connection...');
    const mongoDb = new MongoDBManager(mongoUri);
    await mongoDb.connect();
    return mongoDb;
  } else {
    console.log('📦 Using local persistent SQLite database (data/bot_data.db)...');
    const SQLiteDBManager = require('./db');
    return new SQLiteDBManager();
  }
}

module.exports = {
  getDatabaseInstance,
  MongoDBManager
};
