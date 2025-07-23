const express = require("express");
const { scrapeProduct } = require("../services/scraper");
const { optionalAuth } = require("../middleware/auth");
const router = express.Router();

// Apply optional authentication - scraping can work without auth
router.use(optionalAuth);

// Main extraction endpoint - Pure Scraping Only
router.post("/extract-product", async (req, res) => {
  const { url } = req.body;
  const userInfo = req.user
    ? `${req.user.email} (${req.user.uid})`
    : "Anonymous";

  if (!url) {
    return res.status(400).json({
      error: "URL is required",
      extractionMethod: "error",
    });
  }

  console.log(`🔍 Starting universal extraction for: ${url}`);
  console.log(`👤 Request from: ${userInfo}`);

  try {
    const scrapingResult = await scrapeProduct(url);

    if (scrapingResult.success) {
      console.log("✅ Universal scraping successful");

      return res.json({
        title: scrapingResult.data.title,
        image: scrapingResult.data.image,
        price: scrapingResult.data.price,
        originalPrice: scrapingResult.data.originalPrice,
        site: scrapingResult.data.site,
        url: scrapingResult.data.url,
        extractionMethod: "universal-scraping",
        confidence: 0.9,
        timestamp: scrapingResult.data.timestamp,
        ...(req.user && { userId: req.user.uid }), // Include user ID if authenticated
      });
    }

    // Scraping failed - return best effort result
    console.log("⚠️ Scraping failed, returning fallback data");

    return res.json({
      title:
        scrapingResult.data?.title || `Product from ${new URL(url).hostname}`,
      image: scrapingResult.data?.image || null,
      price: scrapingResult.data?.price || "N/A",
      originalPrice: scrapingResult.data?.originalPrice || null,
      site: new URL(url).hostname,
      url: url,
      extractionMethod: "fallback",
      confidence: 0.3,
      error: scrapingResult.error,
      ...(req.user && { userId: req.user.uid }), // Include user ID if authenticated
    });
  } catch (error) {
    console.error("❌ Universal extraction failed:", error.message);

    return res.status(500).json({
      title: `Product from ${new URL(url).hostname}`,
      price: "N/A",
      error: error.message,
      url: url,
      extractionMethod: "error",
      ...(req.user && { userId: req.user.uid }), // Include user ID if authenticated
    });
  }
});

module.exports = router;
