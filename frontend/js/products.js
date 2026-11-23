// Products come only from the database via the API. There is no demo data.

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function money(value) {
  return 'ETB ' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#eef2f6"/></svg>');

// Normalises an API product row into what the templates use.
function toView(p) {
  const discounted = Number(p.discount_percent) > 0;
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    category: p.category,
    image: p.image_url || PLACEHOLDER_IMAGE,
    price: Number(p.final_price_etb),
    oldPrice: discounted ? Number(p.price_etb) : null,
    discount: Number(p.discount_percent),
    stock: Number(p.stock),
  };
}

async function fetchProducts(params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  const data = await API.request('/products' + (query ? '?' + query : ''));
  return data.products.map(toView);
}

async function fetchProduct(id) {
  return toView((await API.request('/products/' + encodeURIComponent(id))).product);
}

function productCard(p) {
  const url = '/product-details.html?id=' + encodeURIComponent(p.id);
  const soldOut = p.stock < 1;
  return `<article class="product-card">
    <a href="${url}"><div class="product-image">${p.oldPrice ? `<span class="deal-badge">-${esc(p.discount)}%</span>` : ''}<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></div></a>
    <div class="rating"><span>${esc(p.category)}</span></div>
    <a class="product-name" href="${url}">${esc(p.name)}</a>
    <div class="price">${money(p.price)} ${p.oldPrice ? `<span class="old-price">${money(p.oldPrice)}</span>` : ''}</div>
    <button class="button blue add-to-cart" data-id="${esc(p.id)}" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Out of stock' : 'Add to cart'}</button>
  </article>`;
}

function emptyState(title, text) {
  return `<div class="empty" style="grid-column:1/-1"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
}
