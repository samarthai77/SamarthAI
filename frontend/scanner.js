/* Scanner data stays in memory. No upload, analytics, or persistent scan storage. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const MAX_PAGES = 20, MAX_FILE = 20 * 1024 * 1024, MAX_SESSION = 48 * 1024 * 1024;
    const MAX_EDGE = 2400, MAX_PIXELS = 32 * 1024 * 1024;
    const pages = [];
    let mode = 'document', stream = null, cameraEpoch = 0, scanTimer = null, scanStarted = 0;
    let reader = null, source = null, preview = null, editingId = null, crop = {l:0,t:0,r:1,b:1};
    let dragStart = null, pdfBlob = null, pdfUrl = null, qrLink = null, busy = false, nextPageId = 0;
    const libraries = new Map();
    const video = $('scannerVideo'), editor = $('editorCanvas'), scanCanvas = document.createElement('canvas');
    const status = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };
    const nextPaint = () => new Promise(resolve => requestAnimationFrame(resolve));
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
    function release(c) { if(c) { c.width = 0; c.height = 0; } }

    function loadLibrary(name) {
        if(!libraries.has(name)) libraries.set(name, new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = name === 'pdf' ? 'vendor/scanner/jspdf-4.2.1.umd.min.js' : 'vendor/scanner/zxing-browser-0.2.1.min.js';
            script.onload = resolve;
            script.onerror = () => { script.remove(); libraries.delete(name); reject(new Error('Scanner library load नहीं हुई। Connection जाँचकर फिर कोशिश करें।')); };
            document.head.append(script);
        }));
        return libraries.get(name);
    }
    async function getReader() {
        await loadLibrary('qr');
        if(!window.ZXingBrowser?.BrowserMultiFormatReader) throw new Error('इस browser में QR decoder उपलब्ध नहीं है।');
        return reader ||= new window.ZXingBrowser.BrowserMultiFormatReader();
    }
    function stopCamera(announce = false) {
        cameraEpoch++;
        clearTimeout(scanTimer); scanTimer = null;
        if(stream) { stream.getTracks().forEach(track => { track.onended = null; track.stop(); }); stream = null; }
        video.pause(); video.srcObject = null;
        release(scanCanvas);
        $('cameraPanel').hidden = true; $('captureDocument').disabled = true;
        if(announce) status('कैमरा बंद है।');
    }
    function cameraError(error) {
        if(!window.isSecureContext) return 'Live Camera के लिए HTTPS आवश्यक है। फोन Camera / Gallery से फोटो चुन सकते हैं।';
        if(['NotAllowedError','SecurityError'].includes(error.name)) return 'Camera permission नहीं मिली। Browser / phone settings में अनुमति दें, या Gallery चुनें।';
        if(error.name === 'NotFoundError') return 'कैमरा नहीं मिला। Gallery या फोन Camera का उपयोग करें।';
        if(error.name === 'NotReadableError') return 'कैमरा किसी अन्य app में उपयोग हो रहा है। उसे बंद करके फिर कोशिश करें।';
        return 'Camera शुरू नहीं हुआ। Gallery / फोन Camera चुनें या browser बदलकर देखें।';
    }
    async function startCamera() {
        stopCamera();
        if(mode === 'qr') clearQrResult();
        const epoch = cameraEpoch, requestedMode = mode;
        if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { status('Live Camera इस browser में उपलब्ध नहीं है। HTTPS पर खोलें या Gallery / फोन Camera चुनें।', true); return; }
        $('cameraPanel').hidden = false; $('captureDocument').hidden = mode !== 'document';
        $('cameraHint').textContent = mode === 'document' ? 'दस्तावेज़ सीधा रखें, फिर फोटो लें।' : 'Code frame में रखें। Code पढ़ने पर camera अपने-आप बंद होगा।';
        status('कैमरा तैयार हो रहा है। जरूरत होने पर permission दें…');
        try {
            if(mode === 'qr') await getReader();
            if(epoch !== cameraEpoch || requestedMode !== mode || document.hidden) return;
            const acquired = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440}}});
            // Stop late permission grants after cancel, navigation, or a mode switch.
            if(epoch !== cameraEpoch || requestedMode !== mode || document.hidden) { acquired.getTracks().forEach(track => track.stop()); return; }
            stream = acquired;
            acquired.getVideoTracks().forEach(track => { track.onended = () => { if(epoch === cameraEpoch) { stopCamera(); status('Camera connection बंद हो गया। दोबारा शुरू कर सकते हैं।', true); } }; });
            video.srcObject = acquired; await video.play();
            if(epoch !== cameraEpoch) return;
            $('captureDocument').disabled = false;
            status(mode === 'qr' ? 'QR / Barcode खोज रहे हैं…' : 'फोटो लेने के लिए तैयार।');
            if(mode === 'qr') { scanStarted = Date.now(); scanVideo(epoch); }
        } catch(error) { if(epoch === cameraEpoch) { stopCamera(); status(cameraError(error), true); } }
    }
    function drawScaled(input, width, height, edge = MAX_EDGE) {
        if(!width || !height || width * height > MAX_PIXELS) throw new Error('फोटो बहुत बड़ी है या पढ़ी नहीं जा सकी। 32 megapixels से छोटी फोटो चुनें।');
        const scale = Math.min(1, edge / Math.max(width, height));
        const output = canvas(width * scale, height * scale), context = output.getContext('2d');
        context.fillStyle = '#fff'; context.fillRect(0, 0, output.width, output.height);
        context.drawImage(input, 0, 0, output.width, output.height);
        return output;
    }
    async function readPhoto(file) {
        if(!file || file.size > MAX_FILE) throw new Error('प्रति फोटो सीमा 20 MB है। छोटी फोटो चुनें।');
        if(!/^(image\/(jpeg|png|webp|heic|heif))$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error('JPEG, PNG या WebP फोटो चुनें।');
        const header = new Uint8Array(await file.slice(0,32).arrayBuffer());
        const signature = String.fromCharCode(...header);
        const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
        const png = header[0] === 137 && signature.slice(1,8) === 'PNG\r\n\x1a\n';
        const webp = signature.startsWith('RIFF') && signature.slice(8,12) === 'WEBP';
        const heif = signature.slice(4,8) === 'ftyp' && /heic|heix|hevc|hevx|heim|heis|mif1|msf1/.test(signature.slice(8));
        if(!jpeg && !png && !webp && !heif) throw new Error('फाइल valid JPEG, PNG, WebP या HEIC फोटो नहीं है।');
        // Browser image decoding respects EXIF orientation. Re-encoding drops photo metadata.
        const url = URL.createObjectURL(file), image = new Image();
        try {
            await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('फोटो नहीं खुली। HEIC / HEIF हो तो उसे JPEG में बदलकर चुनें।')); image.src = url; });
            return drawScaled(image, image.naturalWidth, image.naturalHeight);
        } finally { URL.revokeObjectURL(url); image.src = ''; }
    }
    function jpegBlob(c) { return new Promise((resolve, reject) => c.toBlob(blob => blob ? resolve(blob) : reject(new Error('फोटो तैयार नहीं हुई। छोटी फोटो से फिर कोशिश करें।')), 'image/jpeg', .88)); }
    function invalidatePdf() {
        $('pdfPanel').hidden = true; $('pdfFrame').removeAttribute('src');
        $('downloadPdf').removeAttribute('href'); $('openPdf').removeAttribute('href');
        if(pdfUrl) URL.revokeObjectURL(pdfUrl);
        pdfUrl = null; pdfBlob = null;
    }
    function renderPages() {
        $('pageList').replaceChildren();
        pages.forEach((page, index) => {
            const li = document.createElement('li'), image = new Image(), title = document.createElement('p'), actions = document.createElement('div');
            image.src = page.url; image.alt = 'पेज ' + (index + 1); image.loading = 'lazy';
            title.textContent = 'पेज ' + (index + 1); actions.className = 'toolbar';
            for(const [action, label] of [['edit','Edit'],['remove','हटाएँ']]) {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.action = action; button.dataset.id = page.id;
                button.setAttribute('aria-label',label + ' पेज ' + (index + 1)); actions.append(button);
            }
            li.append(image, title, actions); $('pageList').append(li);
        });
        $('pageCount').textContent = pages.length + ' / ' + MAX_PAGES;
        $('emptyPages').hidden = pages.length > 0;
        $('createPdf').disabled = busy || !pages.length || !!source;
        $('clearPages').disabled = busy || !pages.length;
    }
    function setBusy(value) {
        busy = value;
        for(const id of ['savePage','rotatePage','resetCrop','createPdf','clearPages','startDocumentCamera','startQrCamera','cancelEdit']) $(id).disabled = value;
        for(const input of document.querySelectorAll('input[type=file]')) input.disabled = value;
        $('enhancement').disabled = value;
        renderPages();
    }
    function closeEditor() {
        release(source); release(preview); source = null; preview = null; editingId = null; dragStart = null;
        release(editor); $('editorPanel').hidden = true; renderPages();
    }
    function openEditor(c, id = null) {
        closeEditor(); source = c; editingId = id;
        crop = {l:0,t:0,r:1,b:1}; $('enhancement').value = 'original';
        $('savePage').textContent = id ? 'बदलाव Save करें' : 'पेज जोड़ें';
        $('editorPanel').hidden = false; buildPreview(); syncCropControls(); renderPages();
        $('editorPanel').scrollIntoView({block:'start',behavior:'auto'});
    }
    function enhance(c, enhancement) {
        if(enhancement === 'original') return;
        const context = c.getContext('2d'), image = context.getImageData(0,0,c.width,c.height), data = image.data;
        for(let i = 0; i < data.length; i += 4) {
            if(enhancement === 'bw') {
                const gray = .299 * data[i] + .587 * data[i+1] + .114 * data[i+2];
                data[i] = data[i+1] = data[i+2] = gray > 155 ? 255 : 0;
            } else for(let channel = 0; channel < 3; channel++) data[i+channel] = Math.max(0,Math.min(255,(data[i+channel]-128)*1.22+142));
        }
        context.putImageData(image,0,0);
    }
    function buildPreview() {
        if(!source) return;
        release(preview); preview = drawScaled(source,source.width,source.height,1000);
        enhance(preview,$('enhancement').value); editor.width = preview.width; editor.height = preview.height;
        paintCrop();
    }
    function paintCrop() {
        if(!preview) return;
        const context = editor.getContext('2d'), w = editor.width, h = editor.height;
        context.drawImage(preview,0,0); context.fillStyle = 'rgba(5,19,39,.45)'; context.fillRect(0,0,w,h);
        const x = crop.l*w, y = crop.t*h, cw = (crop.r-crop.l)*w, ch = (crop.b-crop.t)*h;
        context.drawImage(preview,x,y,cw,ch,x,y,cw,ch);
        context.strokeStyle = '#4faaff'; context.lineWidth = Math.max(2,w/250); context.strokeRect(x,y,cw,ch);
    }
    function syncCropControls() { for(const [id,key] of [['cropLeft','l'],['cropTop','t'],['cropRight','r'],['cropBottom','b']]) $(id).value = Math.round(crop[key]*100); paintCrop(); }
    function cropPoint(event) { const rect = editor.getBoundingClientRect(); return {x:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))}; }
    editor.addEventListener('pointerdown',event => { if(!source || busy) return; event.preventDefault(); dragStart = cropPoint(event); editor.setPointerCapture(event.pointerId); });
    editor.addEventListener('pointermove',event => {
        if(!dragStart || !source || busy) return;
        const point = cropPoint(event), left = Math.min(dragStart.x,point.x), top = Math.min(dragStart.y,point.y), right = Math.max(dragStart.x,point.x), bottom = Math.max(dragStart.y,point.y);
        if(right-left >= .05 && bottom-top >= .05) { crop = {l:left,t:top,r:right,b:bottom}; syncCropControls(); }
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']) editor.addEventListener(type,() => { dragStart = null; });
    for(const [id,key] of [['cropLeft','l'],['cropTop','t'],['cropRight','r'],['cropBottom','b']]) $(id).addEventListener('input',() => {
        if(!source || busy) return;
        crop[key] = Number($(id).value)/100;
        if(key === 'l') crop.l = Math.min(crop.l,crop.r-.05);
        if(key === 'r') crop.r = Math.max(crop.r,crop.l+.05);
        if(key === 't') crop.t = Math.min(crop.t,crop.b-.05);
        if(key === 'b') crop.b = Math.max(crop.b,crop.t+.05);
        syncCropControls();
    });
    $('rotatePage').onclick = () => {
        if(!source || busy) return;
        const rotated = canvas(source.height,source.width), context = rotated.getContext('2d');
        context.translate(rotated.width,0); context.rotate(Math.PI/2); context.drawImage(source,0,0);
        release(source); source = rotated; crop = {l:0,t:0,r:1,b:1}; buildPreview(); syncCropControls();
        status('पेज 90° घुमा दिया। Crop फिर से चुन सकते हैं।');
    };
    $('resetCrop').onclick = () => { crop = {l:0,t:0,r:1,b:1}; syncCropControls(); };
    $('enhancement').onchange = buildPreview;
    $('cancelEdit').onclick = () => { if(!busy) { closeEditor(); status('Editing बंद है।'); } };
    async function storePage(c, id = null) {
        if(!id && pages.length >= MAX_PAGES) throw new Error('अधिकतम 20 पेज जोड़ सकते हैं। पहले कोई पेज हटाएँ।');
        const blob = await jpegBlob(c), index = id ? pages.findIndex(page => page.id === id) : -1;
        if(id && index < 0) throw new Error('यह पेज अब उपलब्ध नहीं है।');
        const bytes = pages.reduce((total,page) => total + page.blob.size,0) - (index >= 0 ? pages[index].blob.size : 0);
        if(bytes + blob.size > MAX_SESSION) throw new Error('Session की 48 MB सीमा पूरी है। PDF download करके कुछ पेज हटाएँ।');
        const page = {id:id || String(++nextPageId),blob,width:c.width,height:c.height,url:URL.createObjectURL(blob)};
        if(index >= 0) { URL.revokeObjectURL(pages[index].url); pages[index] = page; } else pages.push(page);
        invalidatePdf(); renderPages();
    }
    $('savePage').onclick = async () => {
        if(!source || busy) return;
        setBusy(true); status('पेज तैयार हो रहा है…'); let output;
        try {
            await nextPaint();
            const x = Math.round(crop.l*source.width), y = Math.round(crop.t*source.height);
            output = canvas((crop.r-crop.l)*source.width,(crop.b-crop.t)*source.height);
            output.getContext('2d').drawImage(source,x,y,output.width,output.height,0,0,output.width,output.height);
            enhance(output,$('enhancement').value); await storePage(output,editingId);
            closeEditor(); status('पेज जुड़ गया। और पेज जोड़ें या PDF बनाएँ।');
        } catch(error) { status(error.message,true); } finally { release(output); setBusy(false); }
    };
    async function importDocuments(files) {
        if(busy || !files.length) return;
        if(source && !confirm('बिना save किए editing बंद करके नई फोटो खोलें?')) return;
        if(files.length + pages.length > MAX_PAGES) { status('अधिकतम 20 पेज। कम फोटो चुनें या पुराने पेज हटाएँ।',true); return; }
        stopCamera(); setBusy(true); let failures = 0;
        try {
            if(files.length === 1) { const c = await readPhoto(files[0]); openEditor(c); status('Crop / Rotate / Enhancement के बाद पेज जोड़ें।'); }
            else {
                closeEditor();
                for(const [index,file] of files.entries()) {
                    status('फोटो ' + (index+1) + ' / ' + files.length + ' तैयार हो रही है…'); await nextPaint();
                    let c;
                    try { c = await readPhoto(file); await storePage(c); } catch { failures++; } finally { release(c); }
                }
                status(failures ? failures + ' फोटो नहीं जुड़ीं। Format / size जाँचें। बाकी पेज नीचे उपलब्ध हैं।' : 'पेज जुड़ गए। जरूरत हो तो हर पेज पर Edit चुनें।',failures > 0);
            }
        } catch(error) { status(error.message,true); } finally { setBusy(false); }
    }
    for(const id of ['documentCamera','documentGallery']) $(id).onchange = async event => { const files = Array.from(event.target.files || []); event.target.value = ''; await importDocuments(files); };
    for(const input of document.querySelectorAll('input[type=file]')) input.addEventListener('click',() => stopCamera());
    $('captureDocument').onclick = async () => {
        if(busy || !stream || !video.videoWidth) { status('कैमरा की फोटो तैयार होने दें।',true); return; }
        if(source && !confirm('बिना save किए editing बंद करके नई फोटो लें?')) return;
        try { const c = drawScaled(video,video.videoWidth,video.videoHeight); stopCamera(); openEditor(c); status('फोटो तैयार। Crop / Rotate करके पेज जोड़ें।'); }
        catch(error) { status(error.message,true); }
    };
    $('pageList').onclick = async event => {
        const button = event.target.closest('button[data-id]'); if(!button || busy) return;
        const page = pages.find(item => item.id === button.dataset.id); if(!page) return;
        if(source && !confirm('वर्तमान unsaved editing बंद करें?')) return;
        if(button.dataset.action === 'remove') { closeEditor(); pages.splice(pages.indexOf(page),1); URL.revokeObjectURL(page.url); invalidatePdf(); renderPages(); status('पेज हटा दिया।'); }
        else {
            stopCamera(); setBusy(true);
            try { const file = new File([page.blob],'page.jpg',{type:'image/jpeg'}); openEditor(await readPhoto(file),page.id); status('पेज में बदलाव करके Save करें।'); }
            catch(error) { status(error.message,true); } finally { setBusy(false); }
        }
    };
    $('clearPages').onclick = () => {
        if(busy || !confirm('इस session के सभी document pages हटाएँ?')) return;
        closeEditor(); pages.forEach(page => URL.revokeObjectURL(page.url)); pages.length = 0; invalidatePdf(); renderPages(); status('सभी पेज हटा दिए।');
    };
    $('createPdf').onclick = async () => {
        if(busy || !pages.length || source) return;
        stopCamera(); setBusy(true); status('PDF device पर बन रहा है…');
        try {
            await loadLibrary('pdf'); await nextPaint();
            const pdf = new window.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
            for(const [index,page] of pages.entries()) {
                if(index) pdf.addPage('a4','portrait');
                const bytes = new Uint8Array(await page.blob.arrayBuffer());
                const scale = Math.min(190/page.width,277/page.height), w = page.width*scale, h = page.height*scale;
                pdf.addImage(bytes,'JPEG',(210-w)/2,(297-h)/2,w,h,undefined,'FAST');
                await nextPaint();
            }
            invalidatePdf(); pdfBlob = pdf.output('blob'); pdfUrl = URL.createObjectURL(pdfBlob);
            $('pdfFrame').src = pdfUrl; $('downloadPdf').href = pdfUrl; $('openPdf').href = pdfUrl; $('pdfPanel').hidden = false;
            $('pdfPanel').scrollIntoView({block:'start'}); status(pages.length + ' पेज का PDF तैयार है। Download / Share आपकी इच्छा पर होगा।');
        } catch(error) { status('PDF नहीं बना। ' + error.message,true); } finally { setBusy(false); }
    };
    $('sharePdf').onclick = async () => {
        if(!pdfBlob) return;
        const file = new File([pdfBlob],'SamarthAI-Scan.pdf',{type:'application/pdf'});
        if(!navigator.canShare?.({files:[file]}) || !navigator.share) { status('इस browser में PDF file sharing नहीं है। Download करके phone के Files app से Share करें।',true); return; }
        try { await navigator.share({files:[file],title:'SamarthAI Scan'}); status('PDF share विकल्प बंद हुआ।'); }
        catch(error) { if(error.name !== 'AbortError') status('Share नहीं हुआ। PDF Download करके Share करें।',true); }
    };
    function safeLink(text) {
        const value = text.trim();
        if(value.length > 4096 || !/^https?:\/\//i.test(value) || /[\s\u0000-\u001f\u007f]/.test(value)) return null;
        try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url : null; } catch { return null; }
    }
    function displayCode(result) {
        const text = String(result.getText());
        stopCamera(); $('qrResult').value = text; qrLink = safeLink(text);
        const format = window.ZXingBrowser.BarcodeFormat[result.getBarcodeFormat()] || 'QR / Barcode';
        $('openQr').disabled = !qrLink; $('qrFormat').textContent = format + ' · ' + text.length + ' characters';
        $('qrResultPanel').hidden = false; status('Code पढ़ लिया। Data देखें; कोई external action अपने-आप नहीं किया गया।');
        $('qrResultPanel').scrollIntoView({block:'nearest'});
    }
    function clearQrResult() {
        $('qrResult').value = ''; qrLink = null; $('openQr').disabled = true;
        $('qrFormat').textContent = ''; $('qrResultPanel').hidden = true;
    }
    function codeNotFound(error) {
        // ZXing's minified class names are unstable; getKind() is its public exception identifier.
        return ['NotFoundException','ChecksumException','FormatException'].includes(error.getKind?.() || error.name);
    }
    function scanVideo(epoch) {
        if(epoch !== cameraEpoch || !stream || mode !== 'qr') return;
        if(Date.now()-scanStarted > 60000) { stopCamera(); status('60 seconds में code नहीं मिला। रोशनी / दूरी बदलें या Gallery image चुनें।',true); return; }
        if(video.readyState >= 2 && video.videoWidth) {
            const scale = Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
            scanCanvas.width = Math.round(video.videoWidth*scale); scanCanvas.height = Math.round(video.videoHeight*scale);
            scanCanvas.getContext('2d').drawImage(video,0,0,scanCanvas.width,scanCanvas.height);
            try { const result = reader.decodeFromCanvas(scanCanvas); if(result) { displayCode(result); return; } }
            catch(error) {
                if(!codeNotFound(error)) { stopCamera(); status('Code पढ़ने में समस्या हुई। Gallery या दूसरा browser आज़माएँ।',true); return; }
            }
        }
        scanTimer = setTimeout(() => scanVideo(epoch),220);
    }
    $('qrGallery').onchange = async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if(!file || busy) return;
        stopCamera(); clearQrResult(); setBusy(true); status('फोटो में QR / Barcode पढ़ रहे हैं…'); let c;
        try {
            const decoder = await getReader(); c = await readPhoto(file); let result;
            for(let turn = 0; turn < 4; turn++) {
                try { result = decoder.decodeFromCanvas(c); if(result) break; } catch(error) { if(!codeNotFound(error)) throw error; }
                const rotated = canvas(c.height,c.width), context = rotated.getContext('2d'); context.translate(rotated.width,0); context.rotate(Math.PI/2); context.drawImage(c,0,0); release(c); c = rotated; await nextPaint();
            }
            if(!result) throw new Error('Code नहीं मिला। साफ, बिना कटे code की फोटो चुनें।');
            displayCode(result);
        } catch(error) { status(error.message || 'इस फोटो का code नहीं पढ़ सके।',true); } finally { release(c); setBusy(false); }
    };
    $('copyQr').onclick = async () => {
        try {
            if(navigator.clipboard?.writeText) await navigator.clipboard.writeText($('qrResult').value);
            else { $('qrResult').focus(); $('qrResult').select(); if(!document.execCommand('copy')) throw new Error(); }
            status('Scan data copy हो गया।');
        } catch { $('qrResult').focus(); $('qrResult').select(); status('Copy permission नहीं मिली। चुना हुआ text manually copy करें।',true); }
    };
    $('openQr').onclick = () => {
        if(!qrLink || !confirm('यह external website खोलें?\n\n' + qrLink.href + '\n\nWebsite की पहचान जाँच लें।')) return;
        const link = document.createElement('a'); link.href = qrLink.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; document.body.append(link); link.click(); link.remove();
    };
    $('clearQr').onclick = () => { clearQrResult(); status('Scan result हटा दिया।'); };
    function setMode(next) {
        if(busy || next === mode) return;
        stopCamera(); mode = next;
        for(const name of ['document','qr']) { const active = name === mode; $(name+'Tab').setAttribute('aria-selected',String(active)); $(name+'Tab').tabIndex = active ? 0 : -1; $(name+'Panel').hidden = !active; }
        status(mode === 'qr' ? 'QR Camera या Gallery चुनें। किसी link को अपने-आप नहीं खोलेंगे।' : 'Camera या Gallery से document जोड़ें।');
    }
    $('documentTab').onclick = () => setMode('document'); $('qrTab').onclick = () => setMode('qr');
    for(const id of ['documentTab','qrTab']) $(id).onkeydown = event => { if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); setMode(event.key === 'Home' ? 'document' : event.key === 'End' ? 'qr' : mode === 'qr' ? 'document' : 'qr'); $(mode+'Tab').focus(); } };
    $('startDocumentCamera').onclick = startCamera; $('startQrCamera').onclick = startCamera;
    $('stopCamera').onclick = () => stopCamera(true);
    document.addEventListener('visibilitychange',() => { if(document.hidden) stopCamera(); });
    window.addEventListener('pagehide',event => {
        stopCamera();
        if(!event.persisted) { closeEditor(); invalidatePdf(); pages.forEach(page => URL.revokeObjectURL(page.url)); pages.length = 0; reader = null; }
    });
    renderPages();
})();
