const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

// =====================================================
// AUTH
// =====================================================
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }
}

// =====================================================
// SCANNER STATUS
// =====================================================
router.get("/", (req, res) => {
  res.json({
    success: true,
    module: "scanner",
    status: "running"
  });
});

// =====================================================
// IMAGE ANALYSIS
// =====================================================
router.post("/analyze", authenticate, async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        error: "Image required"
      });
    }

    const base64Data = image.includes(",")
      ? image.split(",")[1]
      : image;

    if (!base64Data || base64Data.length < 100) {
      return res.status(400).json({
        error: "Invalid image"
      });
    }

    const mimeMatch = image.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch?.[1] || "image/png";

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "इस image को ध्यान से analyze करो। जो दिखाई दे रहा है केवल उसी के आधार पर simple Hindi में accurate और concise जवाब दो। अगर कोई text दिखाई दे रहा है तो उसे भी पढ़कर बताओ।"
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok || data.error) {
      console.error(
        "Gemini scanner error:",
        JSON.stringify(data)
      );

      return res.status(502).json({
        error: "Image analysis failed"
      });
    }

    const result =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Image ko samajh nahi paaya.";

    return res.json({
      success: true,
      response: result
    });

  } catch (error) {
    console.error("Scanner error:", error);

    return res.status(500).json({
      error: "Scanner failed"
    });
  }
});

module.exports = router;
