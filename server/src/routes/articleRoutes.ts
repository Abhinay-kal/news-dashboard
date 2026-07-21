import express from 'express';
import Article from '../models/Article';

const router = express.Router();

/**
 * GET /api/articles?runDate=YYYY-MM-DD
 * Fetches all articles for a specific daily run.
 */
router.get('/', async (req, res) => {
  try {
    const { runDate } = req.query;
    
    if (!runDate) {
      return res.status(400).json({ error: 'runDate query parameter is required' });
    }

    // This uses that index we created to instantly find the articles!
    const articles = await Article.find({ runDate });
    res.json(articles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching articles' });
  }
});

/**
 * PATCH /api/articles/:id/status
 * Updates the review status of a specific article.
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Security check: Ensure they are only sending valid enum states
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedArticle = await Article.findByIdAndUpdate(
      id, 
      { status }, 
      { new: true } // This tells Mongoose to return the updated document, not the old one
    );
    
    if (!updatedArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(updatedArticle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error updating status' });
  }
});

export default router;
