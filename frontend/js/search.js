document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.querySelector('#catalog-products');
  if (!grid) return;
  const params = new URLSearchParams(location.search);
  const state = { q: params.get('q') || '', category: params.get('category') || '', deals: params.get('deals') === '1' };
  const title = document.querySelector('#catalog-title');
  const count = document.querySelector('#results-count');
  const select = document.querySelector('#sort-products');
  const filters = document.querySelector('#category-filters');
  let categories = [];

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.category) p.set('category', state.category);
    if (state.deals) p.set('deals', '1');
    history.replaceState(null, '', '/products.html' + (p.toString() ? '?' + p : ''));
  }

  async function render() {
    syncUrl();
    const categoryName = categories.find(c => c.slug === state.category)?.name;
    title.textContent = state.q ? `Results for “${state.q}”` : state.deals ? 'Deals' : categoryName || 'All products';
    filters.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === (state.deals ? 'deals' : state.category)));
    grid.innerHTML = '';
    count.textContent = 'Loading…';
    try {
      const list = await fetchProducts({ q: state.q, category: state.category, deals: state.deals ? '1' : '', sort: select.value });
      count.textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
      grid.innerHTML = list.length ? list.map(productCard).join('') : emptyState('No products found', 'Try another search or browse all departments.');
    } catch {
      count.textContent = '';
      grid.innerHTML = emptyState('Could not load products', 'Please refresh the page.');
    }
  }

  try {
    categories = (await API.request('/products/categories')).categories;
  } catch {
    categories = [];
  }
  filters.innerHTML = '<button data-filter="">All products</button><button data-filter="deals">Deals</button>' +
    categories.map(c => `<button data-filter="${esc(c.slug)}">${esc(c.name)}</button>`).join('');
  filters.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.q = '';
    state.deals = btn.dataset.filter === 'deals';
    state.category = state.deals ? '' : btn.dataset.filter;
    render();
  });
  select.addEventListener('change', render);
  render();
});
