const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

// ✅ Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ✅ Get all family members
router.get("/", async (req, res) => {
  try {
  const { data, error } = await supabase.from("family_members").select("*");

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Family fetch error:", err);
    res.status(500).send("Error: Could not fetch family members");
  }
});

// ✅ Add new family member
router.post("/", async (req, res) => {
  try {
    const { name, phone } = req.body;
    const { data, error } = await supabase
      .from("family")
      .insert([{ name, phone }]);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Family insert error:", err);
    res.status(500).send("Error: Could not add family member");
  }
});

// ✅ GPS location for specific family member
router.get("/:memberId/gps", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const { data, error } = await supabase
      .from("family")
      .select("id, name, location")
      .eq("id", memberId)
      .single();
    if (error) throw error;
    res.json({ message: `GPS location for ${data.name}`, location: data.location });
  } catch (err) {
    console.error("Family GPS error:", err);
    res.status(500).send("Error: Could not fetch GPS location");
  }
});

// ✅ SOS alert for specific family member
router.post("/:memberId/sos", async (req, res) => {
  try {
    const memberId = req.params.memberId;
    const { data, error } = await supabase
      .from("alerts")
      .insert([{ member_id: memberId, timestamp: new Date() }]);
    if (error) throw error;
    res.json({ message: `SOS alert triggered for family member ${memberId}` });
  } catch (err) {
    console.error("Family SOS error:", err);
    res.status(500).send("Error: Could not trigger SOS alert");
  }
});

module.exports = router;
