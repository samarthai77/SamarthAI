const express = require('express');
const router = express.Router();

// ==========================================
// SAMARTH-AI IN-MEMORY RUNTIME ENGINE v16.0
// Zero-Disk Dependency (Never Loses Sessions)
// ==========================================

router.post('/generate-project', async (req, res) => {
    try {
        const { projectName, projectType, domain, logoUrl } = req.body;

        if (!projectName || !projectType) {
            return res.status(400).json({ success: false, error: "Project name and type are required." });
        }

        const cleanProjectName = projectName.trim().toLowerCase().replace(/\s+/g, '-');
        const safeType = projectType.trim();
        const safeDomain = domain ? domain.trim() : `${cleanProjectName}.com`;
        const safeLogo = logoUrl ? logoUrl.trim() : '🚀';

        const isSocial = /social|facebook|insta|post|community|chat/i.test(safeType);
        const isVideo = /video|youtube|reel|tiktok|stream|player/i.test(safeType);
        const isDating = /dating|tinder|match|relationship|couple/i.test(safeType);

        let themeColor = "#2563eb";
        let categoryName = "E-Commerce Retail Platform";
        if (isSocial) { themeColor = "#1877f2"; categoryName = "Social Community Network"; }
        else if (isVideo) { themeColor = "#ff0000"; categoryName = "Video & Reels Streamer"; }
        else if (isDating) { themeColor = "#fd3a73"; categoryName = "Matchmaking & Dating Portal"; }

        // सफलता का रिस्पॉन्स भेजें जो सीधे हमारे डायनेमिक व्यूअर पर रीडायरेक्ट करेगा
        res.json({
            success: true,
            message: `Successfully synthesized runtime app (${categoryName})!`,
            projectName: cleanProjectName,
            totalPages: 12,
            previewUrl: `/api/autonomous/view/${cleanProjectName}/index.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}`
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// यूनिवर्सल डायनेमिक पेज रेंडरर (जो बिना किसी फाइल के सीधे मेमोरी से पेज बनाएगा)
router.get('/view/:projectName/:page', (req, res) => {
    const projName = req.params.projectName;
    const page = req.params.page || 'index.html';
    const query = req.query;
    
    const safeType = query.type || 'Standard App';
    const safeDomain = query.domain || `${projName}.com`;
    const safeLogo = query.logo || '⚡';
    const projectNameFormatted = projName.charAt(0).toUpperCase() + projName.slice(1).replace(/-/g, ' ');

    let themeColor = "#2563eb";
    let categoryName = "E-Commerce Retail Platform";
    if (/social|facebook|insta|post/i.test(safeType)) { themeColor = "#1877f2"; categoryName = "Social Community Network"; }
    else if (/video|youtube|reel/i.test(safeType)) { themeColor = "#ff0000"; categoryName = "Video & Reels Streamer"; }
    else if (/dating|tinder|match/i.test(safeType)) { themeColor = "#fd3a73"; categoryName = "Matchmaking & Dating Portal"; }

    // नेविगेशन बार जो डायनेमिक पैरामीटर को आगे पास करेगा
    const makeLink = (targetPage, label) => `<a href="${targetPage}?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}" style="color: ${page === targetPage ? '#60a5fa' : '#94a3b8'}; text-decoration: none; font-weight: ${page === targetPage ? 'bold' : '600'};">${label}</a>`;

    const commonNavbar = `
        <header style="background: rgba(19, 27, 46, 0.95); backdrop-filter: blur(10px); border-bottom: 1px solid #1e293b; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 1000; flex-wrap: wrap; gap: 15px;">
            <a href="index.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}" style="display: flex; align-items: center; gap: 10px; font-size: 1.3rem; font-weight: bold; color: #60a5fa; text-decoration: none;"><span>${safeLogo}</span> ${projectNameFormatted}</a>
            <nav style="display: flex; gap: 15px; font-size: 13px; flex-wrap: wrap;">
                ${makeLink('index.html', 'Home')}
                ${makeLink('explore.html', 'Explore')}
                ${makeLink('catalog.html', 'Catalog')}
                ${makeLink('product-detail.html', 'Item Detail')}
                ${makeLink('search.html', 'Search')}
                ${makeLink('cart.html', 'Cart')}
                ${makeLink('checkout.html', 'Checkout')}
                ${makeLink('success.html', 'Success')}
                ${makeLink('orders.html', 'Orders')}
                ${makeLink('profile.html', 'Profile')}
                ${makeLink('settings.html', 'Settings')}
                ${makeLink('terms.html', 'Legal')}
            </nav>
        </header>
    `;

    const commonHead = (title) => `
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${projectNameFormatted} - ${title}</title>
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

    // अलग-अलग पेजों का कंटेंट
    let pageContent = `<div class="card"><h2>Page Not Found</h2></div>`;
    
    if (page === 'index.html') {
        pageContent = `<div class="card"><h1>Welcome to ${projectNameFormatted}</h1><p>Running on <b>${categoryName}</b> framework for domain ${safeDomain}.</p><a href="catalog.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}" class="btn">Explore All Modules</a></div>`;
    } else if (page === 'explore.html') {
        pageContent = `<div class="card"><h2>Explore Trending Categories</h2><p>Discover real-time feeds, items, and specialized ${safeType} utilities.</p></div>`;
    } else if (page === 'catalog.html') {
        pageContent = `<div class="card"><h2>Product / Service Catalog</h2><p>Browse through fully synthesized items ready for deployment.</p><a href="product-detail.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}" class="btn">View Product Details</a></div>`;
    } else if (page === 'product-detail.html') {
        pageContent = `<div class="card"><h2>Flagship ${safeType} Item Specification</h2><p>High-grade commercial item configured with zero human intervention.</p><a href="cart.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}" class="btn" style="background:#16a34a;">Add to Cart & Proceed</a></div>`;
    } else if (page === 'search.html') {
        pageContent = `<div class="card"><h2>Advanced Search Engine</h2><input type="text" placeholder="Type to search items, profiles or tags..." style="width:100%; padding:12px; background:#0b0f19; border:1px solid var(--border); border-radius:8px; color:white; box-sizing:border-box; margin-top:15px;"></div>`;
    } else if (page === 'cart.html') {
        pageContent = `<div class="card"><h2>Your Active Shopping Cart</h2><p>1x Flagship Item — Active Session</p><a href="checkout.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}" class="btn" style="background:#ea580c;">Proceed to Checkout</a></div>`;
    } else if (page === 'checkout.html') {
        pageContent = `<div class="card"><h2>Secure Payment & Checkout Gateway</h2><p>Enter delivery address and select payment mode.</p><a href="success.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}" class="btn" style="background:#16a34a;">Confirm & Pay</a></div>`;
    } else if (page === 'success.html') {
        pageContent = `<div class="card" style="text-align:center;"><h2>🎉 Order Successfully Placed!</h2><p>Your transaction has been verified by SamarthAI Engine.</p><a href="orders.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}" class="btn">View Order History</a></div>`;
    } else if (page === 'orders.html') {
        pageContent = `<div class="card"><h2>Your Past Orders & Tracking</h2><p><b>Order #SAM-8942:</b> Active Session Verified</p></div>`;
    } else if (page === 'profile.html') {
        pageContent = `<div class="card"><h2>User Profile & Account</h2><p><b>Domain:</b> ${safeDomain}</p><p><b>Account Type:</b> ${categoryName}</p></div>`;
    } else if (page === 'settings.html') {
        pageContent = `<div class="card"><h2>Application Preferences & Security</h2><p>Manage notifications, API keys, and autonomous runtime permissions.</p></div>`;
    } else if (page === 'terms.html') {
        pageContent = `<div class="card"><h2>Terms of Service & Privacy Policy</h2><p>All operations under ${projectNameFormatted} are governed autonomously.</p></div>`;
    }

    const finalHtml = `<!DOCTYPE html><html>${commonHead(page)}<body>${commonNavbar}<div class="container">${pageContent}</div><footer>${projectNameFormatted}</footer></body></html>`;
    
    res.send(finalHtml);
});

module.exports = router;
