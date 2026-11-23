document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('#cart-page');
  if (!root) return;
  let products = [];
  let localFee = null;

  async function load() {
    const cart = cartData();
    const [list, fees] = await Promise.all([
      cart.length ? fetchProducts({ ids: cart.map(i => i.id).join(','), limit: 100 }) : [],
      API.request('/delivery/fees').catch(() => null),
    ]);
    products = list;
    localFee = fees ? Number(fees.local.feeEtb) : null;
    // Drop items that were removed from the store.
    const known = new Set(products.map(p => p.id));
    if (cart.some(i => !known.has(i.id))) saveCart(cart.filter(i => known.has(i.id)));
  }

  function render() {
    const cart = cartData();
    if (!cart.length) {
      root.innerHTML = '<div class="empty" style="grid-column:1/-1"><h2>Your cart is empty</h2><p>Looks like you have not added anything yet.</p><a class="button blue" href="/products.html">Start shopping</a></div>';
      return;
    }
    let subtotal = 0;
    const items = cart.map(item => {
      const p = products.find(x => x.id === item.id);
      if (!p) return '';
      subtotal += p.price * item.qty;
      const over = item.qty > p.stock;
      return `<div class="cart-item"><img src="${esc(p.image)}" alt="${esc(p.name)}"><div>
        <h3>${esc(p.name)}</h3><p>${esc(p.category)}${over ? ` · <strong>only ${p.stock} in stock</strong>` : ''}</p>
        <div class="qty"><button data-action="dec" data-id="${esc(p.id)}" aria-label="Decrease">−</button><span>${item.qty}</span><button data-action="inc" data-id="${esc(p.id)}" aria-label="Increase">+</button></div>
        <button class="remove" data-action="remove" data-id="${esc(p.id)}">Remove</button>
      </div><div class="price">${money(p.price * item.qty)}</div></div>`;
    }).join('');
    const feeText = localFee == null ? 'Calculated at checkout' : `${money(localFee)} in Debre Birhan`;
    root.innerHTML = `<section class="cart-items">${items}</section><aside class="summary">
      <h2>Order summary</h2>
      <div class="summary-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <div class="summary-row"><span>Delivery</span><span>${feeText}</span></div>
      <p class="summary-row"><small>Nationwide delivery is quoted by the store after you order.</small></p>
      <div class="summary-row total"><span>Estimated total</span><span>${money(subtotal + (localFee || 0))}</span></div>
      <a class="button blue" href="/checkout.html">Continue to checkout</a>
    </aside>`;
  }

  root.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    let cart = cartData();
    const item = cart.find(x => x.id === btn.dataset.id);
    if (!item) return;
    if (btn.dataset.action === 'remove') cart = cart.filter(x => x.id !== item.id);
    else if (btn.dataset.action === 'inc') item.qty++;
    else if (btn.dataset.action === 'dec' && --item.qty < 1) cart = cart.filter(x => x.id !== item.id);
    saveCart(cart);
    render();
  });

  root.innerHTML = '<p>Loading cart…</p>';
  load().then(render).catch(() => { root.innerHTML = emptyState('Could not load your cart', 'Please refresh the page.'); });
});
