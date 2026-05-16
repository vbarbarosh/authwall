(function () {
    const theme_key = 'authwall-docs-theme';
    const root = document.documentElement;
    const button = document.querySelector('[data-theme-toggle]');

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

    if (button) {
        button.addEventListener('click', function () {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            localStorage.setItem(theme_key, next);
            apply_theme(next);
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

    function setup_code_copy_buttons()
    {
        const blocks = Array.from(document.querySelectorAll('pre'));

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
})();
