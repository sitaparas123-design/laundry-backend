require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Start the Server
const startServer = async () => {
  // Connect to Database
  await connectDB();

  // Seed Default Areas if needed
  const seedAreas = require('./utils/seedAreas');
  await seedAreas();

  // Listen
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
};

// Start the application server
startServer();
