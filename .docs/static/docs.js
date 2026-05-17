(function () {
    const theme_key = 'authwall-docs-theme';
    const root = document.documentElement;
    const button = document.querySelector('[data-theme-toggle]');
    let mermaid_rerender = null;

    function preferred_theme()
    {
        const stored = localStorage.getItem(theme_key);
        if (stored === 'light' || stored === 'dark') {
            return stored;
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function apply_theme(theme)
    {
        root.dataset.theme = theme;
        if (button) {
            button.textContent = theme === 'dark' ? 'Light' : 'Dark';
            button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
        }
    }

    apply_theme(preferred_theme());
    setup_code_copy_buttons();
    setup_current_section();
    setup_mermaid();
    setup_search();

    if (button) {
        button.addEventListener('click', function () {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem(theme_key, next);
            apply_theme(next);
            if (mermaid_rerender) {
                mermaid_rerender();
            }
        });
    }

    function setup_current_section()
    {
        const links = Array.from(document.querySelectorAll('.sidebar a[href^="#"], .toc a[href^="#"]'));
        const ids = [];
        const seen = {};

        for (const link of links) {
            const id = decodeURIComponent(link.hash.slice(1));
            if (!id || seen[id]) {
                continue;
            }
            const target = document.getElementById(id);
            if (!target) {
                continue;
            }
            seen[id] = true;
            ids.push(id);
        }

        if (!ids.length) {
            return;
        }

        function current_id()
        {
            let current = ids[0];
            for (const id of ids) {
                const target = document.getElementById(id);
                if (target.getBoundingClientRect().top > 96) {
                    break;
                }
                current = id;
            }
            return current;
        }

        function update_current_section()
        {
            const id = current_id();
            let current_sidebar_link = null;
            for (const link of links) {
                const is_current = decodeURIComponent(link.hash.slice(1)) === id;
                link.classList.toggle('is-current', is_current);
                if (is_current && link.closest('.sidebar')) {
                    current_sidebar_link = link;
                }
            }
            if (current_sidebar_link) {
                current_sidebar_link.scrollIntoView({block: 'nearest'});
            }
        }

        update_current_section();
        window.addEventListener('scroll', update_current_section, {passive: true});
        window.addEventListener('resize', update_current_section);
    }

    function setup_mermaid()
    {
        const nodes = Array.from(document.querySelectorAll('pre.mermaid'));
        if (!nodes.length) {
            return;
        }

        // Keep the original diagram source so the theme toggle can re-render.
        for (const node of nodes) {
            node.dataset.source = node.textContent;
        }

        import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then(function (module) {
            const mermaid = module.default;
            let counter = 0;

            function render()
            {
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'loose',
                    theme: root.dataset.theme === 'dark' ? 'dark' : 'default',
                });

                for (const node of nodes) {
                    const id = 'mermaid-svg-' + (counter++);
                    mermaid.render(id, node.dataset.source).then(function (result) {
                        node.innerHTML = result.svg;
                        if (typeof result.bindFunctions === 'function') {
                            result.bindFunctions(node);
                        }
                        node.classList.add('mermaid-rendered');
                    }).catch(function () {
                        // Leave the diagram source visible if it fails to parse.
                    });
                }
            }

            render();
            mermaid_rerender = render;
        }).catch(function () {
            // Mermaid could not be loaded (e.g. offline) — the source stays visible.
        });
    }

    function setup_code_copy_buttons()
    {
        const blocks = Array.from(document.querySelectorAll('pre:not(.mermaid)'));

        for (const pre of blocks) {
            const wrapper = document.createElement('div');
            const button = document.createElement('button');

            wrapper.className = 'code-block';
            button.className = 'code-copy';
            button.type = 'button';
            button.textContent = 'Copy';
            button.setAttribute('aria-label', 'Copy code to clipboard');

            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            wrapper.appendChild(button);

            button.addEventListener('click', function () {
                copy_text(pre.textContent).then(function () {
                    button.textContent = 'Copied';
                    window.setTimeout(function () {
                        button.textContent = 'Copy';
                    }, 1200);
                }).catch(function () {
                    button.textContent = 'Failed';
                    window.setTimeout(function () {
                        button.textContent = 'Copy';
                    }, 1200);
                });
            });
        }
    }

    function copy_text(text)
    {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function (resolve, reject) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.top = '-1000px';
            textarea.style.left = '-1000px';
            document.body.appendChild(textarea);
            textarea.select();

            try {
                if (document.execCommand('copy')) {
                    resolve();
                }
                else {
                    reject(new Error('Copy failed'));
                }
            }
            catch (err) {
                reject(err);
            }
            finally {
                document.body.removeChild(textarea);
            }
        });
    }

    function setup_search()
    {
        const box = document.querySelector('.search');
        const input = box ? box.querySelector('.search-input') : null;
        if (!input || typeof window.filter1_from_spec_fuzzy !== 'function') {
            return;
        }
        const clear_button = box.querySelector('.search-clear');

        if (box.dataset.mode === 'single') {
            setup_search_single(input);
        }
        else {
            setup_search_classic(input, box);
        }

        // The clear control appears whenever there is something to clear — text
        // in the box or leftover highlights — and resets both.
        function update_clear_button()
        {
            if (clear_button) {
                clear_button.hidden = !input.value && !document.querySelector('mark.search-hit');
            }
        }

        input.addEventListener('input', update_clear_button);

        if (clear_button) {
            clear_button.addEventListener('click', function () {
                input.value = '';
                input.dispatchEvent(new Event('input'));
                clear_highlights();
                update_clear_button();
            });
        }

        update_clear_button();

        // Any keydown (bar Tab and modifier combos) jumps focus into the search
        // box, so the keystroke lands there and search starts immediately.
        document.addEventListener('keydown', function (event) {
            if (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Tab') {
                return;
            }
            const target = event.target;
            const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || (target && target.isContentEditable)) {
                return;
            }
            input.focus();
        });
    }

    // Single-page mode: every section is in the DOM, so filter it in place.
    function setup_search_single(input)
    {
        const sections = Array.from(document.querySelectorAll('.doc-section'));
        const pages = Array.from(document.querySelectorAll('.doc-page'));
        const nav_links = Array.from(document.querySelectorAll('.sidebar a.nav-link'));

        const no_matches = document.createElement('p');
        no_matches.className = 'search-no-matches';
        no_matches.textContent = 'No sections match your search.';
        no_matches.hidden = true;
        const main = document.querySelector('.content');
        if (main) {
            main.appendChild(no_matches);
        }

        // Hide sidebar entries whose target section/page is filtered out.
        function sync_nav(filtering)
        {
            nav_links.forEach(function (link) {
                const li = link.closest('li');
                if (!li) {
                    return;
                }
                if (!filtering) {
                    li.hidden = false;
                    return;
                }
                const id = link.hash ? decodeURIComponent(link.hash.slice(1)) : '';
                const target = id ? document.getElementById(id) : null;
                const host = target ? target.closest('.doc-section, .doc-page') : null;
                li.hidden = host ? host.hidden : false;
            });
        }

        function reveal_all()
        {
            sections.forEach(function (section) { section.hidden = false; });
            pages.forEach(function (page) { page.hidden = false; });
            sync_nav(false);
            no_matches.hidden = true;
        }

        function apply(value)
        {
            clear_highlights();
            const spec = value.trim().toLowerCase();
            if (!spec) {
                reveal_all();
                return;
            }
            const match = window.filter1_from_spec_fuzzy(spec);
            const terms = highlight_terms(spec);
            sections.forEach(function (section) {
                const hit = match(section.textContent.toLowerCase());
                section.hidden = !hit;
                if (hit) {
                    highlight_node(section, terms);
                }
            });
            pages.forEach(function (page) {
                page.hidden = !page.querySelector('.doc-section:not([hidden])');
            });
            sync_nav(true);
            no_matches.hidden = sections.some(function (section) { return !section.hidden; });
        }

        input.addEventListener('input', function () {
            apply(input.value);
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                // Keep the filtered view (hidden sections stay hidden) and just
                // scroll to the first match; clearing the search restores them.
                event.preventDefault();
                const first = sections.find(function (section) { return !section.hidden; });
                if (first) {
                    first.scrollIntoView({behavior: 'smooth', block: 'start'});
                }
                input.blur();
            }
            else if (event.key === 'Escape') {
                input.value = '';
                clear_highlights();
                reveal_all();
                input.blur();
            }
        });
    }

    // Classic mode: only the current page is in the DOM, so search the
    // build-time index of every page and show matches in a dropdown.
    function setup_search_classic(input, box)
    {
        const panel = box.querySelector('.search-results');
        let entries = null;
        let results = [];
        let active = -1;
        let last_spec = '';

        function load()
        {
            if (entries) {
                return Promise.resolve(entries);
            }
            return fetch(box.dataset.index).then(function (response) {
                return response.json();
            }).then(function (data) {
                entries = data;
                return entries;
            });
        }

        function run(value)
        {
            const spec = value.trim().toLowerCase();
            last_spec = spec;
            if (!spec) {
                close();
                return;
            }
            load().then(function (data) {
                const match = window.filter1_from_spec_fuzzy(spec);
                const terms = highlight_terms(spec);
                results = data.filter(function (entry) {
                    return match(entry.text.toLowerCase());
                }).slice(0, 40);
                active = results.length ? 0 : -1;
                render(terms);
            }).catch(close);
        }

        function render(terms)
        {
            if (!results.length) {
                panel.innerHTML = '<p class="search-empty">No matches</p>';
                panel.hidden = false;
                return;
            }
            panel.innerHTML = results.map(function (entry, i) {
                const href = entry.page + (entry.anchor ? '#' + entry.anchor : '');
                const crumb = escape_html(entry.title) + (entry.heading
                    ? ' <span class="search-crumb">›</span> ' + escape_html(entry.heading)
                    : '');
                return '<a class="search-result' + (i === active ? ' is-active' : '') +
                    '" href="' + escape_html(href) + '">' +
                    '<span class="search-result-crumb">' + crumb + '</span>' +
                    '<span class="search-result-snippet">' + make_snippet(entry.text, terms) + '</span>' +
                    '</a>';
            }).join('');
            panel.hidden = false;
        }

        function mark_active()
        {
            const rows = panel.querySelectorAll('.search-result');
            rows.forEach(function (row, i) {
                row.classList.toggle('is-active', i === active);
            });
            if (rows[active]) {
                rows[active].scrollIntoView({block: 'nearest'});
            }
        }

        function close()
        {
            panel.hidden = true;
            panel.innerHTML = '';
            results = [];
            active = -1;
        }

        function go(i)
        {
            if (i >= 0 && i < results.length) {
                const entry = results[i];
                const query = last_spec ? '?q=' + encodeURIComponent(last_spec) : '';
                window.location.href = entry.page + query + (entry.anchor ? '#' + entry.anchor : '');
            }
        }

        input.addEventListener('input', function () {
            run(input.value);
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                go(active < 0 ? 0 : active);
            }
            else if (event.key === 'ArrowDown' && results.length) {
                event.preventDefault();
                active = (active + 1) % results.length;
                mark_active();
            }
            else if (event.key === 'ArrowUp' && results.length) {
                event.preventDefault();
                active = (active - 1 + results.length) % results.length;
                mark_active();
            }
            else if (event.key === 'Escape') {
                input.value = '';
                close();
                clear_highlights();
                input.blur();
            }
        });

        document.addEventListener('click', function (event) {
            if (!box.contains(event.target)) {
                close();
            }
        });

        // Landed here from a search result — keep the matched words highlighted
        // on the destination page (the query rides along as ?q=).
        const landed = new URLSearchParams(window.location.search).get('q');
        if (landed) {
            input.value = landed;
            const content = document.querySelector('.doc-content');
            if (content) {
                highlight_node(content, highlight_terms(landed.trim().toLowerCase()));
            }
            if (window.location.hash) {
                const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
                if (target) {
                    target.scrollIntoView({block: 'start'});
                }
            }
        }
    }

    // What to highlight: only the LAST `/`-separated term. Earlier terms only
    // narrow the filter (`aa/bb` keeps sections matching aa AND bb, but bb is
    // the active term). A negated (`!`) last term highlights nothing; `^`/`$`
    // anchors are stripped.
    function highlight_terms(spec)
    {
        const parts = spec.split('/').filter(Boolean);
        if (!parts.length) {
            return [];
        }
        const last = parts[parts.length - 1];
        if (last.indexOf('!') !== -1) {
            return [];
        }
        const term = last.replace(/[\^$]/g, '');
        return term ? [term] : [];
    }

    function clear_highlights()
    {
        const touched = [];
        document.querySelectorAll('mark.search-hit').forEach(function (mark) {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            touched.push(parent);
        });
        touched.forEach(function (parent) { parent.normalize(); });
    }

    function highlight_node(root, terms)
    {
        if (!terms.length) {
            return;
        }
        const re = new RegExp(terms.map(escape_regexp).join('|'), 'gi');
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (node.parentElement && node.parentElement.closest('svg, pre.mermaid')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const text_nodes = [];
        let node;
        while ((node = walker.nextNode())) {
            text_nodes.push(node);
        }
        text_nodes.forEach(function (text_node) {
            const value = text_node.nodeValue;
            re.lastIndex = 0;
            if (!re.test(value)) {
                return;
            }
            re.lastIndex = 0;
            const frag = document.createDocumentFragment();
            let last = 0;
            let m;
            while ((m = re.exec(value))) {
                if (m[0].length === 0) {
                    re.lastIndex++;
                    continue;
                }
                if (m.index > last) {
                    frag.appendChild(document.createTextNode(value.slice(last, m.index)));
                }
                const mark = document.createElement('mark');
                mark.className = 'search-hit';
                mark.textContent = m[0];
                frag.appendChild(mark);
                last = m.index + m[0].length;
            }
            if (last < value.length) {
                frag.appendChild(document.createTextNode(value.slice(last)));
            }
            text_node.parentNode.replaceChild(frag, text_node);
        });
    }

    function make_snippet(text, terms)
    {
        const lower = text.toLowerCase();
        let pos = -1;
        terms.forEach(function (term) {
            const at = lower.indexOf(term);
            if (at >= 0 && (pos < 0 || at < pos)) {
                pos = at;
            }
        });
        const start = pos > 48 ? pos - 48 : 0;
        let html = escape_html(text.slice(start, start + 200));
        if (start > 0) {
            html = '… ' + html;
        }
        if (start + 200 < text.length) {
            html = html + ' …';
        }
        if (terms.length) {
            const re = new RegExp(terms.map(escape_regexp).join('|'), 'gi');
            html = html.replace(re, function (hit) {
                return '<mark class="search-hit">' + hit + '</mark>';
            });
        }
        return html;
    }

    function escape_regexp(value)
    {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escape_html(value)
    {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
})();
