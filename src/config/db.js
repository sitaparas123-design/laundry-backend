const mongoose = require('mongoose');
const dns = require('dns');

// Prioritize IPv4 resolution to prevent DNS timeouts on modern Node.js
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Fallback to Google / Cloudflare public DNS if supported
try {
  if (dns.setServers) {
    dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  }
} catch (e) {
  // Ignore DNS server override errors on restricted environments
}

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spinclean-laundry';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      minPoolSize: 2,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    console.log('Retrying MongoDB connection in 3 seconds...');
    setTimeout(connectDB, 3000);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting reconnection...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully.');
});

module.exports = connectDB;
