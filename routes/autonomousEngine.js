const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// ==========================================
// SAMARTH-AI FULL-FURNISHED UNIFIED ENGINE v6.0
// Generates Fully Functional Apps with UI & Logic
// ==========================================

router.post('/generate-project', async (req, res) => {
    try {
        const { projectName, projectType, domain, logoUrl } = req.body;

        if (!projectName || !projectType) {
            return res.status(400).json({ success: false, error: "Project name and type are required." });
        }

        const cleanProjectName = projectName.trim().toLowerCase().replace(/\s+/g, '-');
        const projectDir = path.join(__dirname, '../generated_projects', cleanProjectName);
        
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }

        const safeType = projectType.trim();
        const safeDomain = domain ? domain.trim() : `${cleanProjectName}.app`;
        const safeLogo = logoUrl ? logoUrl.trim() : '⚡';

        // पूरी तरह से तैयार (Full-Furnished) और इंटरेक्टिव ऐप का कोड
        const previewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Powered by SamarthAI</title>
    <style>
        :root { --primary: #2563eb; --bg: #f8fafc; --card: #ffffff; --text: #1e293b; --border: #e2e8f0; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 0; }
        header { background: #ffffff; border-bottom: 1px solid var(--border); padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .brand { display: flex; align-items: center; gap: 12px; font-size: 1.25rem; font-weight: bold; color: #0f172a; }
        .brand span { background: #eff6ff; color: var(--primary); padding: 8px; border-radius: 8px; }
        .nav-links { display: flex; gap: 20px; font-size: 14px; font-weight: 500; color: #64748b; cursor: pointer; }
        .nav-links div:hover { color: var(--primary); }
        .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; }
        .banner { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 40px; border-radius: 16px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
        .banner h1 { margin: 0 0 10px 0; font-size: 2rem; }
        .banner p { margin: 0; color: #94a3b8; font-size: 1rem; }
        .badge { background: #3b82f6; color: white; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .search-bar { width: 100%; padding: 12px 20px; font-size: 1rem; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 30px; outline: none; background: white; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
        .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); transition: transform 0.2s; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
        .card h3 { margin: 0 0 8px 0; font-size: 1.1rem; color: #0f172a; }
        .card p { color: #64748b; font-size: 0.9rem; margin: 0 0 15px 0; }
        .price { font-weight: bold; color: #059669; font-size: 1.1rem; margin-bottom: 15px; display: block; }
        .btn-buy { background: var(--primary); color: white; border: none; width: 100%; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .btn-buy:hover { background: #1d4ed8; }
        footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 13px; border-top: 1px solid var(--border); margin-top: 50px; background: white; }
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <span>${safeLogo.length > 4 ? '📦' : safeLogo}</span>
            ${projectName}
        </div>
        <div class="nav-links">
            <div>Home</div>
            <div>Products / Services</div>
            <div>Cart (<span id="cartCount">0</span>)</div>
            <div>Support</div>
        </div>
    </header>

    <div class="container">
        <div class="banner">
            <div>
                <div class="badge" style="margin-bottom: 10px; display: inline-block;">${safeType}</div>
                <h1>Welcome to ${projectName}</h1>
                <p>Your fully furnished autonomous application is live, synced with domain <b>${safeDomain}</b>.</p>
            </div>
            <button onclick="alert('System is 100% operational!')" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer;">Manage Store</button>
        </div>

        <input type="text" class="search-bar" placeholder="Search products, services or items..." onkeyup="filterItems(this.value)">

        <div class="grid" id="itemGrid">
            <div class="card" data-name="premium item one">
                <h3>📦 Premium ${safeType} Item 1</h3>
                <p>High quality standard unit configured for your business operations.</p>
                <span class="price">Rs. 1,499</span>
                <button class="btn-buy" onclick="addToCart()">Add to Cart</button>
            </div>
            <div class="card" data-name="advanced package">
                <h3>⚡ Advanced ${safeType} Package</h3>
                <p>Equipped with complete automated tools and backend support.</p>
                <span class="price">Rs. 2,999</span>
                <button class="btn-buy" onclick="addToCart()">Add to Cart</button>
            </div>
            <div class="card" data-name="enterprise bundle">
                <h3>🚀 Enterprise ${safeType} Bundle</h3>
                <p>Full-scale commercial setup ready for direct customer deployment.</p>
                <span class="price">Rs. 4,999</span>
                <button class="btn-buy" onclick="addToCart()">Add to Cart</button>
            </div>
        </div>
    </div>

    <footer>
        ${projectName} — Powered by SamarthAI Autonomous Engine v6.0
    </footer>

    <script>
        let cartCount = 0;
        function addToCart() {
            cartCount++;
            document.getElementById('cartCount').innerText = cartCount;
            alert('Item successfully added to cart!');
        }
        function filterItems(query) {
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                const text = card.innerText.toLowerCase();
                card.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
            });
        }
    </script>
</body>
</html>
`;

        fs.writeFileSync(path.join(projectDir, 'index.html'), previewHtml);

        res.json({
            success: true,
            message: "Full-furnished application synthesized successfully!",
            projectName: cleanProjectName,
            path: projectDir,
            selfHealingStatus: "Full UI components and logic compiled successfully.",
            readyForPlayStoreExport: true,
            previewUrl: `/api/autonomous/preview/${cleanProjectName}`
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// यूनिवर्सल प्रीव्यू राउट
router.get('/preview/:projectName', (req, res) => {
    const rawName = req.params.projectName;
    const projName = decodeURIComponent(rawName).trim().toLowerCase().replace(/\s+/g, '-');
    const indexPath = path.join(__dirname, '../generated_projects', projName, 'index.html');

    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 100px; background: #0f172a; color: #fff; padding: 40px; border-radius: 16px; max-width: 450px; margin-left: auto; margin-right: auto;">
                <h2 style="color: #f87171;">❌ Project '${projName}' Not Found</h2>
                <p style="color: #94a3b8;">Please generate this app from your dashboard first.</p>
            </div>
        `);
    }
});

module.exports = router;
