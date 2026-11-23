const CART_KEY = 'dbmCart';

function cartData() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(cart) ? cart.filter(i => i && typeof i.id === 'string' && i.qty > 0) : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = cartData().reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('.cart-count').forEach(el => { el.textContent = count; });
}

function addToCart(id, qty = 1) {
  const cart = cartData();
  const item = cart.find(i => i.id === id);
  if (item) item.qty += qty;
  else cart.push({ id, qty });
  saveCart(cart);
  showToast('Added to cart');
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function renderShell() {
  const header = document.querySelector('#site-header');
  const footer = document.querySelector('#site-footer');
  if (header) header.innerHTML = `<header class="topbar"><div class="utility container">
    <a class="logo" href="/index.html">Debre Birhan Market</a>
    <div class="location">⌖<span><small>Delivery from</small><strong>Debre Birhan</strong></span></div>
    <form class="search" action="/products.html"><input name="q" placeholder="Search products" aria-label="Search products"><button aria-label="Search">⌕</button></form>
    <a class="account" href="/login.html" id="account-link">◉<span><small>Hello, sign in</small><b>Account</b></span></a>
    <a class="cart-link" href="/cart.html" aria-label="Cart">🛒<small class="cart-count">0</small></a>
  </div><nav class="nav"><div class="nav-inner container">
    <a href="/products.html">All products</a>
    <a href="/products.html?category=groceries">Groceries</a>
    <a href="/products.html?category=fruits-vegetables">Fruits &amp; vegetables</a>
    <a href="/products.html?category=dairy">Dairy</a>
    <a href="/products.html?category=beverages">Beverages</a>
    <a href="/products.html?category=household">Household</a>
    <a href="/products.html?category=electronics">Electronics</a>
    <a href="/products.html?deals=1">Deals</a>
  </div></nav></header>`;
  if (footer) footer.innerHTML = `<footer class="footer"><div class="container footer-grid">
    <div><a class="logo" href="/index.html">Debre Birhan Market</a><p>Groceries and everyday essentials, delivered from Debre Birhan.</p></div>
    <div><h3>Shop</h3><a href="/products.html">All products</a><a href="/products.html?deals=1">Deals</a><a href="/cart.html">Cart</a></div>
    <div><h3>Account</h3><a href="/login.html">Sign in</a><a href="/register.html">Create account</a></div>
    <div><h3>Store</h3><a href="/admin/products.html">Store manager</a></div>
  </div><div class="container footer-bottom"><span>© ${new Date().getFullYear()} Debre Birhan Market</span><span>Prices in Ethiopian Birr (ETB)</span></div></footer>`;
  updateCartCount();
  showSignedInUser();
}

async function showSignedInUser() {
  const link = document.querySelector('#account-link');
  if (!link || typeof API === 'undefined') return;
  try {
    const { user } = await API.request('/auth/me');
    link.href = '#';
    link.innerHTML = `◉<span><small>Hello, ${esc(user.full_name.split(' ')[0])}</small><b>Sign out</b></span>`;
    link.addEventListener('click', async e => {
      e.preventDefault();
      await API.request('/auth/logout', { method: 'POST' }).catch(() => {});
      location.href = '/index.html';
    });
  } catch {
    // Not signed in: keep the sign-in link.
  }
}

async function renderFeatured() {
  const featured = document.querySelector('#featured-products');
  if (!featured) return;
  try {
    const products = await fetchProducts({ limit: 8 });
    featured.innerHTML = products.length ? products.map(productCard).join('') : emptyState('Products coming soon', 'The store is being stocked. Please check back shortly.');
  } catch {
    featured.innerHTML = emptyState('Could not load products', 'Please refresh the page.');
  }
}

async function renderDetail() {
  const detail = document.querySelector('#product-detail');
  if (!detail) return;
  const id = new URLSearchParams(location.search).get('id');
  try {
    if (!id) throw new Error('missing id');
    const p = await fetchProduct(id);
    document.title = `${p.name} | Debre Birhan Market`;
    const soldOut = p.stock < 1;
    detail.innerHTML = `<div class="detail"><div class="detail-image"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div><div class="detail-info">
      <span class="eyebrow blue-text">${esc(p.category)}</span><h1>${esc(p.name)}</h1>
      <div class="price">${money(p.price)} ${p.oldPrice ? `<span class="old-price">${money(p.oldPrice)}</span>` : ''}</div>
      <p>${soldOut ? 'Out of stock' : `${p.stock} in stock`}</p><hr><p>${esc(p.description)}</p>
      <div class="qty"><button type="button" data-step="-1" aria-label="Decrease">−</button><span id="detail-qty">1</span><button type="button" data-step="1" aria-label="Increase">+</button></div>
      <button class="button blue" id="detail-add" ${soldOut ? 'disabled' : ''}>${soldOut ? 'Out of stock' : 'Add to cart'}</button>
    </div></div>`;
    let qty = 1;
    const qtyEl = detail.querySelector('#detail-qty');
    detail.querySelectorAll('[data-step]').forEach(btn => btn.addEventListener('click', () => {
      qty = Math.min(Math.max(qty + Number(btn.dataset.step), 1), Math.max(p.stock, 1));
      qtyEl.textContent = qty;
    }));
    detail.querySelector('#detail-add').addEventListener('click', () => addToCart(p.id, qty));
  } catch {
    detail.innerHTML = emptyState('Product not found', 'It may have been removed. Browse all products instead.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderShell();
  document.addEventListener('click', e => {
    const btn = e.target.closest('.add-to-cart');
    if (btn && !btn.disabled) {
      e.preventDefault();
      addToCart(btn.dataset.id);
    }
  });
  renderFeatured();
  renderDetail();
});
