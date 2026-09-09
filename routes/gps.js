const express = require("express");
const router = express.Router();

// ✅ Basic GPS active route
router.get("/", (req, res) => {
    try {
        res.send("GPS tracking active!");
    } catch (err) {
        console.error("GPS error:", err);
        res.status(500).send("Error: GPS service failed");
    }
});

// ✅ GPS linked with family member
router.get("/:memberId", (req, res) => {
    try {
        const memberId = req.params.memberId;

        // 👉 यहाँ आप Supabase से family table verify कर सकते हो
        // Example: SELECT * FROM family WHERE id = memberId
        // अभी demo response दे रहा हूँ
        res.send(`GPS location for family member ${memberId}`);
    } catch (err) {
        console.error("GPS family error:", err);
        res.status(500).send("Error: Family GPS service failed");
    }
});

// ✅ SOS alert linked with family
router.post("/:memberId/sos", (req, res) => {
    try {
        const memberId = req.params.memberId;

        // 👉 यहाँ आप Supabase से उस member को alert भेज सकते हो
        // Example: Insert into alerts table (memberId, timestamp)
        res.send(`SOS alert triggered for family member ${memberId}`);
    } catch (err) {
        console.error("SOS error:", err);
        res.status(500).send("Error: SOS service failed");
    }
});

module.exports = router;
