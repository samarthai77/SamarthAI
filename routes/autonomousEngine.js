const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// ==========================================
// SAMARTH-AI 12-PAGE MULTI-ROUTER ENGINE v15.0
// Dynamically builds 12+ interconnected production pages
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
        const safeDomain = domain ? domain.trim() : `${cleanProjectName}.com`;
        const safeLogo = logoUrl ? logoUrl.trim() : '🚀';

        const isSocial = /social|facebook|insta|post|community|chat/i.test(safeType);
        const isVideo = /video|youtube|reel|tiktok|stream|player/i.test(safeType);
        const isDating = /dating|tinder|match|relationship|couple/i.test(safeType);
        const isStore = /shop|store|mart|ecommerce|retail|cloth|fashion/i.test(safeType) || (!isSocial && !isVideo && !isDating);

        let themeColor = "#2563eb";
        let categoryName = "E-Commerce Retail Platform";
        if (isSocial) { themeColor = "#1877f2"; categoryName = "Social Community Network"; }
        else if (isVideo) { themeColor = "#ff0000"; categoryName = "Video & Reels Streamer"; }
        else if (isDating) { themeColor = "#fd3a73"; categoryName = "Matchmaking & Dating Portal"; }

        // कॉमन नेविगेशन बार (सभी 12 पेजों के बीच स्विच करने के लिए)
        const commonNavbar = `
            <header style="background: rgba(19, 27, 46, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid #1e293b; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; flex-wrap: wrap; gap: 15px;">
                <a href="index.html" style="display: flex; align-items: center; gap: 10px; font-size: 1.3rem; font-weight: bold; color: #60a5fa; text-decoration: none;"><span>${safeLogo.length > 5 ? '⚡' : safeLogo}</span> ${projectName}</a>
                <nav style="display: flex; gap: 15px; font-size: 13px; font-weight: 600; flex-wrap: wrap;">
                    <a href="index.html" style="color: #94a3b8; text-decoration: none;">Home</a>
                    <a href="explore.html" style="color: #94a3b8; text-decoration: none;">Explore</a>
                    <a href="catalog.html" style="color: #94a3b8; text-decoration: none;">Catalog</a>
                    <a href="product-detail.html" style="color: #94a3b8; text-decoration: none;">Item Detail</a>
                    <a href="search.html" style="color: #94a3b8; text-decoration: none;">Search</a>
                    <a href="cart.html" style="color: #94a3b8; text-decoration: none;">Cart</a>
                    <a href="checkout.html" style="color: #94a3b8; text-decoration: none;">Checkout</a>
                    <a href="success.html" style="color: #94a3b8; text-decoration: none;">Success</a>
                    <a href="orders.html" style="color: #94a3b8; text-decoration: none;">Orders</a>
                    <a href="profile.html" style="color: #94a3b8; text-decoration: none;">Profile</a>
                    <a href="settings.html" style="color: #94a3b8; text-decoration: none;">Settings</a>
                    <a href="terms.html" style="color: #94a3b8; text-decoration: none;">Legal</a>
                </nav>
            </header>
        `;

        const commonHead = (title) => `
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${projectName} - ${title}</title>
            <style>
                :root { --bg: #0b0f19; --card: #131b2e; --text: #f3f4f6; --accent: ${themeColor}; --border: #1e293b; }
                body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 0; }
                .container { max-width: 1000px; margin: 40px auto; padding: 0 20px; }
                .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 25px; margin-bottom: 20px; }
                .btn { background: var(--accent); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; }
                .btn:hover { opacity: 0.9; }
                footer { text-align: center; padding: 30px; border-top: 1px solid var(--border); color: #64748b; font-size: 13px; margin-top: 60px; }
            </style>
        </head>
        `;

        // 12 अलग-अलग पेजों का डेटा तैयार करना
        const pages = {
            'index.html': `<!DOCTYPE html><html>` + commonHead('Home Dashboard') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h1>Welcome to ${projectName}</h1><p>Running on <b>${categoryName}</b> framework for domain ${safeDomain}.</p><a href="catalog.html" class="btn">Explore All Modules</a></div></div><footer>${projectName}</footer></body></html>`,
            
            'explore.html': `<!DOCTYPE html><html>` + commonHead('Explore') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>Explore Trending Categories</h2><p>Discover real-time feeds, items, and specialized ${safeType} utilities.</p></div></div><footer>${projectName}</footer></body></html>`,
            
            'catalog.html': `<!DOCTYPE html><html>` + commonHead('Catalog') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>Product / Service Catalog</h2><p>Browse through fully synthesized items ready for deployment.</p><a href="product-detail.html" class="btn">View Product Details</a></div></div><footer>${projectName}</footer></body></html>`,
            
            'product-detail.html': `<!DOCTYPE html><html>` + commonHead('Product Detail') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>Flagship ${safeType} Item Specification</h2><p>High-grade commercial item configured with zero human intervention.</p><a href="cart.html" class="btn" style="background:#16a34a;">Add to Cart & Proceed</a></div></div><footer>${projectName}</footer></body></html>`,
            
            'search.html': `<!DOCTYPE html><html>` + commonHead('Search') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>Advanced Search Engine</h2><input type="text" placeholder="Type to search items, profiles or tags..." style="width:100%; padding:12px; background:#0b0f19; border:1px solid var(--border); border-radius:8px; color:white; box-sizing:border-box; margin-top:15px;"></div></div><footer>${projectName}</footer></body></html>`,
            
            'cart.html': `<!DOCTYPE html><html>` + commonHead('Cart') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>Your Active Shopping Cart</h2><p>1x Flagship Item — Rs. 1,499</p><a href="checkout.html" class="btn" style="background:#ea580c;">Proceed to Checkout</a></div></div><footer>${projectName}</footer></body></html>`,
            
            'checkout.html': `<!DOCTYPE html><html>` + commonHead('Checkout') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>Secure Payment & Checkout Gateway</h2><p>Enter delivery address and select payment mode (UPI / Card / NetBanking).</p><a href="success.html" class="btn" style="background:#16a34a;">Confirm & Pay Rs. 1,499</a></div></div><footer>${projectName}</footer></body></html>`,
            
            'success.html': `<!DOCTYPE html><html>` + commonHead('Order Success') + `<body>` + commonNavbar + `<div class="container"><div class="card" style="text-align:center;"><h2>🎉 Order Successfully Placed!</h2><p>Your transaction has been verified by SamarthAI Engine.</p><a href="orders.html" class="btn">View Order History</a></div></div><footer>${projectName}</footer></body></html>`,
            
            'orders.html': `<!DOCTYPE html><html>` + commonHead('Order History') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>Your Past Orders & Tracking</h2><p><b>Order #SAM-8942:</b> Flagship Item (Delivered / Active Session)</p></div></div><footer>${projectName}</footer></body></html>`,
            
            'profile.html': `<!DOCTYPE html><html>` + commonHead('User Profile') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>User Profile & Account</h2><p><b>Domain:</b> ${safeDomain}</p><p><b>Account Type:</b> ${categoryName}</p></div></div><footer>${projectName}</footer></body></html>`,
            
            'settings.html': `<!DOCTYPE html><html>` + commonHead('Settings') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>Application Preferences & Security</h2><p>Manage notifications, API keys, and autonomous runtime permissions.</p></div></div><footer>${projectName}</footer></body></html>`,
            
            'terms.html': `<!DOCTYPE html><html>` + commonHead('Legal & Terms') + `<body>` + commonNavbar + `<div class="container"><div class="card"><h2>Terms of Service & Privacy Policy</h2><p>All operations under ${projectName} are governed autonomously.</p></div></div><footer>${projectName}</footer></body></html>`
        };

        // सभी 12 फाइलों को एक साथ फोल्डर में लिखना
        for (const [filename, content] of Object.entries(pages)) {
            fs.writeFileSync(path.join(projectDir, filename), content);
        }

        res.json({
            success: true,
            message: `Successfully synthesized full 12-Page Multi-Router app (${categoryName})!`,
            projectName: cleanProjectName,
            totalPages: Object.keys(pages).length,
            previewUrl: `/api/autonomous/preview/${cleanProjectName}/index.html`
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// किसी भी पेज को लोड करने के लिए मल्टी-पेज राउटिंग सपोर्ट
router.get('/preview/:projectName/:page?', (req, res) => {
    const rawName = req.params.projectName;
    const page = req.params.page || 'index.html';
    const projName = decodeURIComponent(rawName).trim().toLowerCase().replace(/\s+/g, '-');
    const targetPath = path.join(__dirname, '../generated_projects', projName, page);

    if (fs.existsSync(targetPath)) {
        res.sendFile(targetPath);
    } else {
        const indexPath = path.join(__dirname, '../generated_projects', projName, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send(`<h2 style="text-align:center; margin-top:100px; font-family:sans-serif; color:white; background:#0b0f19; padding:50px;">Project not found.</h2>`);
        }
    }
});

module.exports = router;
