require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://Ijazsandhu:Ijaz%40Laundary2026%21%21@laundarysurru.wrutv3j.mongodb.net/laundry_management?retryWrites=true&w=majority&appName=LaundarySurru";
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_access_key_123!@#";

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    // Find Dana Lee
    const user = await User.findOne({ email: 'dana@tuhama.com' });
    if (!user) {
      console.log("User dana@tuhama.com not found");
      return;
    }
    
    // Generate token
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });
    console.log("JWT_SECRET used:", JWT_SECRET);
    console.log("Generated token:", token);
    
    // Send PUT request
    const orderId = "6a3d088b57d84aa6272c93d0";
    const url = `http://localhost:5000/api/orders/${orderId}/status`;
    
    console.log("Sending PUT request to", url);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'Ready' })
    });
    
    console.log("Response status:", response.status);
    const text = await response.text();
    console.log("Response body:", text);
    
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
