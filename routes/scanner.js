const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.send("Scanner module running!");
});

module.exports = router;
