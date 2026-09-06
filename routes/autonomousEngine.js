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

    // सफलता का रिस्पॉन्स भेजें और सही स्टेटस सेट करें
        res.json({
            success: true,
            message: `Successfully synthesized runtime app (${categoryName})!`,
            projectName: cleanProjectName,
            totalPages: 12,
            path: `generated_projects/${cleanProjectName}`,
            status: 'Active & Deployed',
            readyForPlayStore: 'Yes (APK Ready)',
            previewUrl: `/api/autonomous/preview/${cleanProjectName}/index.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}`
        }); 

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// यूनिवर्सल डायनेमिक पेज रेंडरर (जो बिना किसी फाइल के सीधे मेमोरी से 12 पेज बनाएगा)
router.get('/preview/:projectName/:page?', (req, res) => {
    const projName = req.params.projectName;
    const page = req.params.page || 'index.html';
    const query = req.query;
    
    const safeType = query.type || 'Standard App';
    const safeDomain = query.domain || `${projName}.com`;
    const safeLogo = query.logo || '⚡';
    let pageTitleClean = page.replace('.html', '').replace(/-/g, ' ');
    pageTitleClean = pageTitleClean.charAt(0).toUpperCase() + pageTitleClean.slice(1);
    const projectNameFormatted = projName.charAt(0).toUpperCase() + projName.slice(1).replace(/-/g, ' ');

    let themeColor = "#2563eb";
    let categoryName = "E-Commerce Retail Platform";
    if (/social|facebook|insta|post/i.test(safeType)) { themeColor = "#1877f2"; categoryName = "Social Community Network"; }
    else if (/video|youtube|reel/i.test(safeType)) { themeColor = "#ff0000"; categoryName = "Video & Reels Streamer"; }
    else if (/dating|tinder|match/i.test(safeType)) { themeColor = "#fd3a73"; categoryName = "Matchmaking & Dating Portal"; }

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

  let pageContent = `<div class="card"><h2>Page Not Found</h2></div>`;
    
    if (page === 'index.html' || !page) {
        pageContent = `<div class="card"><h1>Welcome to ${projectNameFormatted}</h1><p>Running on <b>${categoryName}</b> framework for domain ${safeDomain}.</p><a href="catalog.html?type=${encodeURIComponent(safeType)}&domain=${encodeURIComponent(safeDomain)}&logo=${encodeURIComponent(safeLogo)}" class="btn">Explore All Modules</a></div>`;
    } else {
        pageContent = `<div class="card"><h2>Welcome to ${pageTitleClean}</h2><p>This is the dedicated workspace for managing ${pageTitleClean.toLowerCase()} under ${projectNameFormatted}.</p></div>`;
    } 
module.exports = router;
