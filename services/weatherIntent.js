'use strict';
// Narrow read-only recovery used only if semantic planning is unavailable.
module.exports = function weatherIntent(message) {
  const text = String(message).trim();
  if (!/\b(weather|mausam|temperature|forecast)\b|मौसम|तापमान/i.test(text)) return null;
  let city = '';
  const before = text.match(/^(.{2,80}?)\s+(?:(?:का|में|में आज|का आज|ka|mein|me|ki|ke)\s+)?(?:मौसम|तापमान|mausam|weather)/iu);
  const after = text.match(/(?:weather|temperature|forecast)\s+(?:in|for|at)\s+([\p{L} .'-]{2,80}?)(?:[?!।]|\s+(?:today|tomorrow|please)|$)/iu);
  if (after) city=after[1].trim();
  else if (before) city=before[1].replace(/\s+(का|में|ka|mein|me|ki|ke|आज|aaj|today)$/iu,'').trim();
  if (/^(आज|कल|यहाँ|यहां|मेरे यहाँ|मेरे यहां|aaj|kal|today|tomorrow|what is the|tell me|current|यहाँ का)$/iu.test(city)) city='';
  if (/प्रयागराज|prayagraj/i.test(city)) city='Prayagraj';
  const type=/कल|tomorrow|forecast|अगले/i.test(text)?'daily':'current';
  return {mode:'tool',tool:'weather',target:'self',location_mode:city?'named_place':'current_user',weather_type:type,tool_args:{locationName:city || null,type}};
};
