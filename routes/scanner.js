const express = require("express");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
};

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
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }
}

router.get("/", (req, res) => {
  res.json({
    status: "success",
    module: "scanner",
    message: "Scanner module running"
  });
});

router.post("/analyze", authenticate, async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        error: "Image required"
      });
    }

    const base64Data = image.includes(",")
      ? image.split(",")[1]
      : image;

    const mimeMatch = image.match(/^data:(.*?);base64,/);
    const mimeType = mimeMatch?.[1] || "image/png";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "इस image को ध्यान से analyze करके simple Hindi में बताओ कि इसमें क्या है। जो दिखाई दे रहा है केवल उसी के आधार पर जवाब दो।"
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("Gemini scanner error:", JSON.stringify(data));

      return res.status(502).json({
        error: "Image analysis failed"
      });
    }

    const result =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Image ko samajh nahi paaya.";

    await supabase
      .from("images")
      .insert([{
        user_id: req.user.id,
        image_url: null
      }])
      .then(({ error }) => {
        if (error) {
          console.error("Scanner image save error:", error);
        }
      });

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
