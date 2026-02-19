(() => {
  const input = document.getElementById('liveSearchInput');
  const dropdown = document.getElementById('liveSearchDropdown');

  let timer = null;
  let controller = null;
  let items = [];
  let activeIdx = -1;

  function debounceFetch() {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 180);
  }

  function close() {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    items = [];
    activeIdx = -1;
  }

  function render(results) {
    if (!results.length) return close();
    dropdown.innerHTML = results.map((r, i) => {
      const url = linkFor(r);
      return `
        <div class="row" role="option" aria-selected="${i === activeIdx}" data-idx="${i}" data-url="${url}">
          <span class="type">[${r.type}]</span>
          <span class="title">${escapeHtml(r.title || '(no title)')}</span>
          ${r.snippet ? `<div class="snippet">${escapeHtml(r.snippet)}</div>` : ''}
        </div>
      `;
    }).join('');
    dropdown.classList.remove('hidden');
  }

function linkFor(r) {
  switch (r.type) {
    case 'blog':
      return r.slug ? `/blog/${encodeURIComponent(r.slug)}` : `/blog`;
    case 'story':
      return `/fanfiction/stories?q=${encodeURIComponent(r.title || '')}`;
    case 'art':
      return `/fanart/sfw?q=${encodeURIComponent(r.title || '')}`;
    case 'project':
      return `/projects?q=${encodeURIComponent(r.title || '')}`;
    case 'artist':
      return `/fanart/artists?q=${encodeURIComponent(r.title || '')}`;

    case 'quote': {
      // r.extra holds the book name; map to short code
      const code = BOOK_CODE[r.extra] || 'ps';
      // Deep-link to the quote anchor on that child page
      return `/quotes/${encodeURIComponent(code)}#q-${encodeURIComponent(r.id)}`;
    }

    case 'writer': 
      // You can deep-link to the writer page if you prefer:
      // return `/fanfiction/writers/${encodeURIComponent(r.id)}`;
      return `/fanfiction/writers?q=${encodeURIComponent(r.title || '')}`;
    default:
      return `/search?q=${encodeURIComponent(r.title || '')}`;
  }
}

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  async function runSearch() {
    const q = input.value.trim();
    if (!q) return close();

    if (controller) controller.abort();
    controller = new AbortController();

    try {
      const res = await fetch(`/api/live-search?q=${encodeURIComponent(q)}&limit=8`, {
        signal: controller.signal
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      items = data.results || [];
      activeIdx = -1;
      render(items);
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error(e);
        close();
      }
    }
  }

  // Keyboard + mouse interactions
  input.addEventListener('input', debounceFetch);
  input.addEventListener('keydown', (e) => {
    if (dropdown.classList.contains('hidden')) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = items.length ? (activeIdx + 1) % items.length : -1;
      highlight();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = items.length ? (activeIdx - 1 + items.length) % items.length : -1;
      highlight();
    }
    if (e.key === 'Enter') {
      if (activeIdx >= 0 && items[activeIdx]) {
        window.location.href = linkFor(items[activeIdx]);
      }
    }
  });

  dropdown.addEventListener('mousemove', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    const idx = parseInt(row.dataset.idx, 10);
    if (!Number.isNaN(idx)) {
      activeIdx = idx; highlight();
    }
  });

  dropdown.addEventListener('mousedown', (e) => {
    // prevent input blur before navigation
    e.preventDefault();
  });

  dropdown.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    window.location.href = row.dataset.url;
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== input) close();
  });

  function highlight() {
    [...dropdown.querySelectorAll('.row')].forEach((el, i) => {
      if (i === activeIdx) el.classList.add('active'); else el.classList.remove('active');
      el.setAttribute('aria-selected', i === activeIdx ? 'true' : 'false');
    });
  }
})();