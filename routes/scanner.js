const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODEL =
  process.env.GEMINI_VISION_MODEL ||
  process.env.GEMINI_MODEL ||
  "gemini-3.8-flash";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

// =====================================================
// AUTHENTICATION
// =====================================================

function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded?.id) {
      return res.status(401).json({
        error: "Invalid token"
      });
    }

    req.user = decoded;
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
    const { image } = req.body || {};

    // -------------------------------------------------
    // BASIC VALIDATION
    // -------------------------------------------------

    if (!image || typeof image !== "string") {
      return res.status(400).json({
        error: "Image required"
      });
    }

    // -------------------------------------------------
    // DATA URL / MIME VALIDATION
    // -------------------------------------------------

    const mimeMatch =
      image.match(/^data:([^;,]+);base64,/i);

    const mimeType =
      (mimeMatch?.[1] || "image/png").toLowerCase();

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({
        error:
          "Only JPG, PNG and WebP images are allowed"
      });
    }

    // -------------------------------------------------
    // EXTRACT BASE64 DATA
    // -------------------------------------------------

    const base64Data = image.includes(",")
      ? image.slice(image.indexOf(",") + 1)
      : image;

    if (
      !base64Data ||
      base64Data.length < 100
    ) {
      return res.status(400).json({
        error: "Invalid image"
      });
    }

    // -------------------------------------------------
    // BASE64 CHARACTER VALIDATION
    // -------------------------------------------------

    if (
      !/^[A-Za-z0-9+/=]+$/.test(base64Data)
    ) {
      return res.status(400).json({
        error: "Invalid image data"
      });
    }

    // -------------------------------------------------
    // IMAGE SIZE PROTECTION
    //
    // Base64 is approximately 4/3 the binary size.
    // This prevents oversized requests from reaching
    // Gemini and consuming server/API resources.
    // -------------------------------------------------

    const estimatedBytes =
      Math.floor(
        (base64Data.length * 3) / 4
      );

    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return res.status(413).json({
        error: "Image must be 6MB or smaller"
      });
    }

    // -------------------------------------------------
    // GEMINI REQUEST
    // -------------------------------------------------

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        GEMINI_MODEL
      )}:generateContent`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                },
                {
                  text:
                    "इस image को ध्यान से analyze करो। केवल image में दिखाई देने वाली जानकारी के आधार पर simple Hindi में accurate और concise जवाब दो। अगर image में कोई text है तो उसे पढ़कर बताओ। वस्तु, व्यक्ति, document, जगह या अन्य दिखाई देने वाली चीजों का स्पष्ट वर्णन करो। जो दिखाई नहीं देता उसके बारे में अनुमान मत लगाओ।"
                }
              ]
            }
          ],

          generationConfig: {
            maxOutputTokens: 1000
          }
        })
      }
    );

    // -------------------------------------------------
    // GEMINI RESPONSE
    // -------------------------------------------------

    let data;

    try {
      data = await geminiResponse.json();
    } catch (error) {
      console.error(
        "Gemini scanner returned invalid JSON"
      );

      return res.status(502).json({
        error: "Image analysis service unavailable"
      });
    }

    if (!geminiResponse.ok || data?.error) {
      console.error(
        "Gemini scanner error:",
        JSON.stringify({
          status: geminiResponse.status,
          message: data?.error?.message || "Unknown error"
        })
      );

      return res.status(502).json({
        error: "Image analysis failed"
      });
    }

    // -------------------------------------------------
    // EXTRACT RESULT
    // -------------------------------------------------

    const result =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part?.text || "")
        .filter(Boolean)
        .join("\n")
        .trim();

    if (!result) {
      return res.status(502).json({
        error: "Image analysis returned no result"
      });
    }

    // -------------------------------------------------
    // FINAL RESPONSE
    // -------------------------------------------------

    return res.json({
      success: true,
      response: result
    });

  } catch (error) {

    console.error(
      "Scanner error:",
      error?.message || "Unknown error"
    );

    return res.status(500).json({
      error: "Scanner failed"
    });
  }
});

module.exports = router;
