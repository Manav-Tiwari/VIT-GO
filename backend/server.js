const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Suppress deprecation warnings
process.removeAllListeners('warning');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// CORS Configuration
const corsOptions = {
    origin: [
        'https://vitravel.vercel.app',
        'http://127.0.0.1:3002',
        'http://localhost:3002',
        'http://localhost:5000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Apply CORS middleware before other middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// Other middleware
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cab-sharing';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  phone: String,
  createdAt: { type: Date, default: Date.now }
});

// Ride Schema
const rideSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  seats: { type: Number, required: true },
  cost: { type: Number, required: true },
  vehicle: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  scheduledDateTime: { type: Date, required: true }
});

const User = mongoose.model('User', userSchema);
const Ride = mongoose.model('Ride', rideSchema);

// Function to delete expired rides
async function deleteExpiredRides() {
  try {
    const currentDateTime = new Date();
    const result = await Ride.deleteMany({
      scheduledDateTime: { $lt: currentDateTime }
    });
    if (result.deletedCount > 0) {
      console.log(`Deleted ${result.deletedCount} expired rides`);
    }
  } catch (error) {
    console.error('Error deleting expired rides:', error);
  }
}

// JWT Authentication Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: verified.userId };
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
};

// Get all rides (For search.html)
app.get('/api/rides', async (req, res) => {
  try {
    // Delete expired rides before fetching
    await deleteExpiredRides();
    
    const rides = await Ride.find()
      .populate({
        path: 'userId',
        select: 'name email phone',
        options: { lean: true }
      })
      .sort({ scheduledDateTime: 1 }); // Sort by date ascending
    
    if (!rides || rides.length === 0) {
      return res.status(404).json({ error: 'No rides found' });
    }
    
    // Filter out any rides with invalid user data
    const validRides = rides.filter(ride => ride.userId);
    
    res.json(validRides);
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ 
      error: 'Failed to fetch rides', 
      details: error.message 
    });
  }
});

// Get rides of the logged-in user (For post.html)
app.get('/api/rides/user', authenticate, async (req, res) => {
  try {
    // Delete expired rides before fetching
    await deleteExpiredRides();
    
    const userRides = await Ride.find({ userId: req.user.id });
    res.json(userRides);
  } catch (error) {
    console.error('Error fetching user rides:', error);
    res.status(500).json({ error: 'Failed to fetch user rides' });
  }
});

// Create a new ride
app.post('/api/rides', authenticate, async (req, res) => {
  try {
    const { from, to, date, time, seats, cost, vehicle } = req.body;

    // Validate required fields
    if (!from || !to || !date || !time || !seats || !cost || !vehicle) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate date format (dd-mm-yyyy or yyyy-mm-dd)
    const dateRegex1 = /^(\d{2})-(\d{2})-(\d{4})$/; // dd-mm-yyyy
    const dateRegex2 = /^(\d{4})-(\d{2})-(\d{2})$/; // yyyy-mm-dd
    
    let day, month, year;
    
    if (dateRegex1.test(date)) {
      // dd-mm-yyyy format
      [day, month, year] = date.split('-');
    } else if (dateRegex2.test(date)) {
      // yyyy-mm-dd format
      [year, month, day] = date.split('-');
    } else {
      return res.status(400).json({ error: 'Invalid date format. Please use dd-mm-yyyy or yyyy-mm-dd' });
    }
    
    // Create a valid date object (month is 0-based in JavaScript Date)
    const scheduledDateTime = new Date(year, month - 1, day, ...time.split(':'));
    
    // Validate that the date is valid
    if (isNaN(scheduledDateTime.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }
    
    // Validate that the scheduled time is in the future
    if (scheduledDateTime <= new Date()) {
      return res.status(400).json({ error: 'Cannot schedule rides in the past' });
    }

    // Create new ride
    const ride = new Ride({
      from,
      to,
      date, // Store the original date format
      time,
      seats: parseInt(seats),
      cost: parseInt(cost),
      vehicle,
      userId: req.user.id,
      scheduledDateTime
    });

    await ride.save();
    res.status(201).json(ride);
  } catch (error) {
    console.error('Error creating ride:', error);
    res.status(500).json({ error: 'Failed to create ride' });
  }
});

// Delete a ride
app.delete('/api/rides/:id', authenticate, async (req, res) => {
  try {
    const ride = await Ride.findOne({ _id: req.params.id, userId: req.user.id });
    
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found or unauthorized' });
    }

    await ride.deleteOne();
    res.json({ message: 'Ride deleted successfully' });
  } catch (error) {
    console.error('Error deleting ride:', error);
    res.status(500).json({ error: 'Failed to delete ride' });
  }
});

// Google OAuth endpoint
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    console.log('Received credential:', credential ? 'Present' : 'Missing');

    if (!credential) {
      return res.status(400).json({ error: 'No credential provided' });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    console.log('Verified payload:', { email: payload.email, name: payload.name });

    // Check if user exists
    let user = await User.findOne({ email: payload.email });
    console.log('User found:', user ? 'Yes' : 'No');

    if (!user) {
      // Validate email domain for new users
      if (!payload.email.endsWith('@vitbhopal.ac.in')) {
        console.log('Invalid email domain:', payload.email);
        return res.status(400).json({ 
          error: 'Only @vitbhopal.ac.in email addresses are allowed' 
        });
      }
      
      // Create new user
      user = new User({
        name: payload.name,
        email: payload.email
      });
      await user.save();
      console.log('Created new user:', user.email);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return success response
    console.log('Authentication successful for user:', user.email);
    res.json({
      token,
      user: {
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Detailed Google auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message 
    });
  }
});

// Get user profile
app.get('/api/user/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
app.put('/api/user/profile', authenticate, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile by ID
app.get('/api/user/:userId', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('name email phone');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

// Update the port configuration
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});