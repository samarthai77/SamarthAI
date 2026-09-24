const weatherTool = require('./weatherTool');
const familyTool = require('./familyTool');
const gpsTool = require('./gpsTool');
const servicesTool = require('./servicesTool');

const toolRegistry = {
  weather: weatherTool,
  family: familyTool,
  gps: gpsTool,
  services: servicesTool
};

function getTool(name) {
  return toolRegistry[name] || null;
}

function listTools() {
  return Object.keys(toolRegistry);
}

module.exports = {
  toolRegistry,
  getTool,
  listTools
};
