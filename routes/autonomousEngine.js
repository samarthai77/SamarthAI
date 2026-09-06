const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// ==========================================
// SAMARTH-AI ULTIMATE AUTONOMOUS ENGINE v8.0
// Zero Human Intervention | Fully Functional Apps with Payments & Legal Pages
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
        const safeDomain = domain ? domain.trim() : `${cleanProjectName}.in`;
        const safeLogo = logoUrl ? logoUrl.trim() : '⚡';

        // यूजर के टाइप के आधार पर ऑटोमैटिक प्रोडक्ट्स और कैटेगरीज जनरेट करना
        const isInterior = /interior|design|decor|home|furniture/i.test(safeType);
        const isFood = /food|restaurant|cafe|eat|tiffin/i.test(safeType);
        
        const catalogName = isInterior ? "Design Portfolios & Packages" : (isFood ? "Menu & Special Combos" : "Available Product Catalog");
        
        // ऑटोनॉमस डायनेमिक आइटम्स
        const items = isInterior ? [
            { name: "Modular Kitchen Setup", price: "45,000", desc: "Ergonomic designs with premium acrylic finish." },
            { name: "Living Room 3D Makeover", price: "25,000", desc: "Complete false ceiling, lighting & wall panels." },
            { name: "Office Workstations", price: "60,000", desc: "Acoustic panels, executive desks & ergonomic seating." }
        ] : (isFood ? [
            { name: "Deluxe Thali Combo", price: "299", desc: "Pure desi ghee meals with fresh starters & sweets." },
            { name: "Special Family Pizza", price: "499", desc: "Loaded with extra cheese, corn and exotic toppings." },
            { name: "Fresh Beverages Pack", price: "199", desc: "Assorted cooling shakes and organic juices." }
        ] : [
            { name: `Flagship ${safeType} Unit A`, price: "1,499", desc: "High quality standard configuration built for scale." },
            { name: `Advanced ${safeType} Kit`, price: "2,999", desc: "Equipped with automated utility and live tracking." },
            { name: `Enterprise ${safeType} Bundle`, price: "5,999", desc: "Full-scale commercial package ready for direct deployment." }
        ]);

        // पूरी तरह से तैयार, पेमेंट गेटवे और लीगल पेजों से लैस फ्रंटएंड कोड
        const previewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Autonomous Live Platform</title>
    <style>
        :root { --primary: #0f172a; --accent: #2563eb; --bg: #f8fafc; --card: #ffffff; --text: #334155; --success: #16a34a; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 0; display: flex; flex-direction: column; min-height: 100vh; }
        header { background: #ffffff; border-bottom: 1px solid #e2e8f0; padding: 18px 40px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .brand { display: flex; align-items: center; gap: 12px; font-size: 1.3rem; font-weight: bold; color: var(--primary); }
        .nav { display: flex; gap: 20px; font-size: 14px; font-weight: 600; color: #64748b; }
        .nav a { color: inherit; text-decoration: none; cursor: pointer; }
        .nav a:hover { color: var(--accent); }
        .container { max-width: 1200px; margin: 30px auto; padding: 0 20px; flex: 1; width: 100%; box-sizing: border-box; }
        .hero { background: linear-gradient(135deg, #0f172a 100%, #1e293b 0%); color: white; padding: 50px; border-radius: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
        .hero h1 { margin: 0 0 10px 0; font-size: 2.2rem; }
        .hero p { color: #94a3b8; font-size: 1rem; margin: 0; max-width: 600px; }
        .tag { background: #3b82f6; color: white; padding: 5px 14px; border-radius: 20px; font-size: 11px; text-transform: uppercase; font-weight: bold; display: inline-block; margin-bottom: 12px; }
        .section-title { font-size: 1.4rem; color: var(--primary); margin-bottom: 20px; font-weight: 700; border-left: 4px solid var(--accent); padding-left: 12px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .card { background: var(--card); border: 1px solid #e2e8f0; border-radius: 14px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between; }
        .card h3 { color: var(--primary); margin-top: 0; font-size: 1.15rem; }
        .card p { color: #64748b; font-size: 0.9rem; margin-bottom: 20px; }
        .price-row { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
        .price { font-size: 1.2rem; font-weight: bold; color: var(--success); }
        .btn-pay { background: var(--accent); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
        .btn-pay:hover { background: #1d4ed8; }
        
        /* कार्ट और चेकआउट बॉक्स */
        .checkout-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 25px; margin-top: 30px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
        .checkout-box h3 { margin-top: 0; color: var(--primary); }
        .input-field { width: 100%; padding: 10px 15px; margin: 8px 0 15px 0; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; }
        
        /* लीगल और फुटर सेक्शन */
        footer { background: #ffffff; border-top: 1px solid #e2e8f0; padding: 30px 40px; margin-top: auto; color: #64748b; font-size: 13px; }
        .footer-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        .footer-links a { color: #64748b; text-decoration: none; display: block; margin-bottom: 6px; }
        .footer-links a:hover { color: var(--accent); }
        
        /* मॉडल्स (Terms & Conditions / Privacy Policy) */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; }
        .close-btn { background: #ef4444; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; float: right; font-weight: bold; }
    </style>
</head>
<body>
    <header>
        <div class="brand">
            <span>${safeLogo.length > 4 ? '🚀' : safeLogo}</span>
            ${projectName}
        </div>
        <div class="nav">
            <a onclick="window.scrollTo(0,0)">Home</a>
            <a onclick="document.getElementById('catalog').scrollIntoView({behavior: 'smooth'})">Catalog</a>
            <a onclick="document.getElementById('checkoutSection').scrollIntoView({behavior: 'smooth'})">Checkout (<span id="cartCount">0</span>)</a>
            <a onclick="openModal('termsModal')">Terms & Policy</a>
        </div>
    </header>

    <div class="container">
        <div class="hero">
            <div>
                <div class="tag">${safeType}</div>
                <h1>Welcome to ${projectName}</h1>
                <p>Fully autonomous platform synthesized with live product inventory, secure checkout gateway, and standard compliance policies.</p>
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; text-align: right; border: 1px solid rgba(255,255,255,0.2);">
                <div style="font-size: 12px; color: #94a3b8;">DOMAIN TARGET</div>
                <div style="font-size: 1.1rem; font-weight: bold; color: #38bdf8;">${safeDomain}</div>
                <div style="font-size: 11px; color: #4ade80; margin-top: 5px;">● Gateway Active</div>
            </div>
        </div>

        <div id="catalog" class="section-title">${catalogName}</div>
        
        <div class="grid">
            ${items.map((item, index) => `
                <div class="card">
                    <div>
                        <h3>✨ ${item.name}</h3>
                        <p>${item.desc}</p>
                    </div>
                    <div class="price-row">
                        <span class="price">Rs. ${item.price}</span>
                        <button class="btn-pay" onclick="addToCart('${item.name}', '${item.price}')">Select & Buy</button>
                    </div>
                </div>
            `).join('')}
        </div>

        <div id="checkoutSection" class="checkout-box">
            <h3>💳 Integrated Autonomous Payment & Checkout Gateway</h3>
            <p style="font-size: 0.9rem; color: #64748b;">Secure UPI / Card / NetBanking simulation powered by SamarthAI Engine.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <label style="font-size: 13px; font-weight: 600;">Selected Item / Service:</label>
                    <input type="text" id="selectedItemName" class="input-field" value="No item selected yet" readonly style="background: #f1f5f9;">
                </div>
                <div>
                    <label style="font-size: 13px; font-weight: 600;">Total Amount (INR):</label>
                    <input type="text" id="selectedItemPrice" class="input-field" value="Rs. 0" readonly style="background: #f1f5f9;">
                </div>
            </div>

            <label style="font-size: 13px; font-weight: 600;">Customer Full Name:</label>
            <input type="text" id="custName" class="input-field" placeholder="Enter your full name">

            <label style="font-size: 13px; font-weight: 600;">Customer Phone / UPI ID:</label>
            <input type="text" id="custUpi" class="input-field" placeholder="9876543210 or username@paytm">

            <button onclick="processCheckout()" style="background: #16a34a; color: white; border: none; width: 100%; padding: 14px; border-radius: 8px; font-size: 1rem; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(22, 163, 74, 0.2);">🔒 Pay Now Securely (Simulated Gateway)</button>
        </div>
    </div>

    <footer>
        <div class="footer-content">
            <div>
                <strong style="color: var(--primary); font-size: 1rem;">${projectName}</strong>
                <p style="margin: 5px 0 0 0;">Autonomously generated and hosted via SamarthAI Core v8.0.</p>
            </div>
            <div class="footer-links">
                <strong style="color: var(--primary); display: block; margin-bottom: 6px;">Legal & Compliance</strong>
                <a onclick="openModal('termsModal')">Terms & Conditions</a>
                <a onclick="openModal('privacyModal')">Privacy Policy</a>
                <a onclick="openModal('refundModal')">Refund & Cancellation Policy</a>
            </div>
        </div>
    </footer>

    <!-- Terms Modal -->
    <div id="termsModal" class="modal">
        <div class="modal-content">
            <button class="close-btn" onclick="closeModal('termsModal')">X</button>
            <h2 style="color: var(--primary); margin-top: 0;">Terms & Conditions</h2>
            <p>Welcome to ${projectName}. By accessing our platform via ${safeDomain}, you agree to comply with and be bound by the following terms of use. All transactions, digital services, and product deliveries are autonomously governed by standard commercial guidelines.</p>
            <p>Users must ensure accuracy while providing personal and financial details during checkout. ${projectName} holds zero tolerance for fraudulent or unauthorized usage.</p>
        </div>
    </div>

    <!-- Privacy Modal -->
    <div id="privacyModal" class="modal">
        <div class="modal-content">
            <button class="close-btn" onclick="closeModal('privacyModal')">X</button>
            <h2 style="color: var(--primary); margin-top: 0;">Privacy Policy</h2>
            <p>At ${projectName}, we respect your privacy. This policy outlines how we collect, use, and protect your information when you interact with our autonomous application platform.</p>
            <p>Data such as names and transaction identifiers are securely processed strictly for order fulfillment and internal verification.</p>
        </div>
    </div>

    <!-- Refund Modal -->
    <div id="refundModal" class="modal">
        <div class="modal-content">
            <button class="close-btn" onclick="closeModal('refundModal')">X</button>
            <h2 style="color: var(--primary); margin-top: 0;">Refund & Cancellation Policy</h2>
            <p>Orders processed through ${projectName} are eligible for review under verified circumstances. If a service or product fulfillment fails due to technical errors, appropriate refunds are triggered automatically within 3-5 business days.</p>
        </div>
    </div>

    <script>
        let cartCount = 0;
        function addToCart(name, price) {
            document.getElementById('selectedItemName').value = name;
            document.getElementById('selectedItemPrice').value = "Rs. " + price;
            cartCount++;
            document.getElementById('cartCount').innerText = cartCount;
            alert('Selected: ' + name + ' added to checkout queue!');
        }

        function processCheckout() {
            const name = document.getElementById('custName').value;
            const item = document.getElementById('selectedItemName').value;
            if(!name || item.includes('No item')) {
                alert('Please select an item and fill in your customer details before proceeding.');
                return;
            }
            alert('🎉 Payment Gateway Simulation Successful! Order placed for ' + item + ' by ' + name + '. Thank you for using ' + projectName + '!');
            location.reload();
        }

        function openModal(id) { document.getElementById(id).style.display = 'flex'; }
        function closeModal(id) { document.getElementById(id).style.display = 'none'; }
        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) { event.target.style.display = 'none'; }
        }
    </script>
</body>
</html>
`;

        fs.writeFileSync(path.join(projectDir, 'index.html'), previewHtml);

        res.json({
            success: true,
            message: "Fully autonomous store with payment gateway and legal policies synthesized!",
            projectName: cleanProjectName,
            path: projectDir,
            previewUrl: `/api/autonomous/preview/${cleanProjectName}`
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/preview/:projectName', (req, res) => {
    const rawName = req.params.projectName;
    const projName = decodeURIComponent(rawName).trim().toLowerCase().replace(/\s+/g, '-');
    const indexPath = path.join(__dirname, '../generated_projects', projName, 'index.html');

    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`<h2 style="text-align:center; margin-top:100px; font-family:sans-serif;">Project not found. Generate from dashboard first.</h2>`);
    }
});

module.exports = router;
