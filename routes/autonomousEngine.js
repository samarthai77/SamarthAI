const express = require("express");
const router = express.Router();

const chatRoutes = require("./chat");
const gpsRoutes = require("./gps");
const sosRoutes = require("./sos");
const scannerRoutes = require("./scanner");
const familyRoutes = require("./family");

router.use("/chat", chatRoutes);
router.use("/gps", gpsRoutes);
router.use("/sos", sosRoutes);
router.use("/scanner", scannerRoutes);
router.use("/family", familyRoutes);

module.exports = router;
