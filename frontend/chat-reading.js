/* Markdown is built from DOM nodes only. Raw HTML is always plain text. */
function renderChatMarkdown(container, source, plain = false) {
    if (plain) { container.textContent = source; container.classList.add('plain-text'); return; }
    function inline(parent, text, depth = 0) {
        if (depth > 6) { parent.append(document.createTextNode(text)); return; }
        const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^\s)]+\))/g;
        let cursor = 0;
        for (const match of text.matchAll(pattern)) {
            parent.append(document.createTextNode(text.slice(cursor, match.index)));
            const token = match[0];
            let node;
            if (token.startsWith('[')) {
                const link = token.match(/^\[([^\]]+)\]\((.+)\)$/);
                try {
                    const url = new URL(link[2]);
                    if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error();
                    node = document.createElement('a'); node.href = url.href;
                    node.target = '_blank'; node.rel = 'noopener noreferrer'; node.textContent = link[1];
                } catch { node = document.createTextNode(token); }
            } else {
                const code = token.startsWith('`'), bold = token.startsWith('**');
                node = document.createElement(code ? 'code' : bold ? 'strong' : 'em');
                const value = token.slice(bold ? 2 : 1, bold ? -2 : -1);
                if (code) node.textContent = value; else inline(node, value, depth + 1);
            }
            parent.append(node); cursor = match.index + token.length;
        }
        parent.append(document.createTextNode(text.slice(cursor)));
    }
    const lines = String(source).replace(/\r\n?/g, '\n').trim().split('\n');
    let paragraph = [], list = null;
    function flush() {
        if (paragraph.length) { const p = document.createElement('p'); inline(p, paragraph.join(' ')); container.append(p); paragraph = []; }
    }
    const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i], trimmed = line.trim();
        if (!trimmed) { flush(); list = null; continue; }
        const fence = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
        if (fence) {
            flush(); list = null;
            const codeLines = [], marker = fence[1][0];
            while (++i < lines.length) {
                if (lines[i].trim().startsWith(marker.repeat(fence[1].length))) break;
                codeLines.push(lines[i]);
            }
            const pre = document.createElement('pre'), code = document.createElement('code');
            code.textContent = codeLines.join('\n'); pre.append(code); container.append(pre); continue;
        }
        if (trimmed.includes('|') && i + 1 < lines.length && cells(lines[i + 1]).every(c => /^:?-{3,}:?$/.test(c))) {
            flush(); list = null;
            const scroll = document.createElement('div'); scroll.className = 'table-scroll';
            const table = document.createElement('table'), head = document.createElement('thead'), body = document.createElement('tbody');
            const row = (values, header) => { const tr = document.createElement('tr'); values.forEach(value => { const td = document.createElement(header ? 'th' : 'td'); inline(td, value); tr.append(td); }); return tr; };
            head.append(row(cells(trimmed), true)); i++;
            while (i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].trim()) body.append(row(cells(lines[++i]), false));
            table.append(head, body); scroll.append(table); container.append(scroll); continue;
        }
        const heading = trimmed.match(/^(#{1,6})\s+(.+)$/), bullet = trimmed.match(/^([-*+•]|\d+[.)])\s+(.+)$/);
        if (heading) { flush(); list = null; const h = document.createElement('h' + Math.min(heading[1].length, 4)); inline(h, heading[2]); container.append(h); }
        else if (bullet) {
            flush(); const tag = /^\d/.test(bullet[1]) ? 'ol' : 'ul';
            if (!list || list.localName !== tag) { list = document.createElement(tag); if (tag === 'ol') list.start = parseInt(bullet[1], 10); container.append(list); }
            const li = document.createElement('li'); inline(li, bullet[2]); list.append(li);
        } else if (/^>\s?/.test(trimmed)) { flush(); list = null; const quote = document.createElement('blockquote'); inline(quote, trimmed.replace(/^>\s?/, '')); container.append(quote); }
        else { list = null; paragraph.push(trimmed); }
    }
    flush();
}
