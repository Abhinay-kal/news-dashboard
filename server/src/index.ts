import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import articleRoutes from './routes/articleRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows our React frontend to talk to this API
app.use(express.json()); // Allows us to read JSON bodies in POST/PATCH requests

// Routes
app.use('/api/articles', articleRoutes);

// Database Connection (We will set this up later)
// mongoose.connect(process.env.MONGO_URI)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
