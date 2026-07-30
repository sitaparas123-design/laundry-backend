const mongoose = require('mongoose');
const dns = require('dns');

// Fallback to public DNS to prevent querySrv ECONNREFUSED on routers that fail to resolve SRV records
if (dns.setServers) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spinclean-laundry', {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    console.log('Ensure MongoDB service is running locally or check MONGODB_URI in your .env file.');
    process.exit(1);
  }
};

module.exports = connectDB;
