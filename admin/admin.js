document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const gate = $('admin-gate');
  const app = $('admin-app');
  const form = $('product-form');
  const list = $('admin-products');
  const message = $('form-message');
  let products = [];

  // The server enforces admin access on every request; this only decides what to show.
  try {
    const { user } = await API.request('/auth/me');
    if (user.role !== 'admin') {
      $('gate-text').textContent = 'This account is not a store admin.';
      gate.hidden = false;
      return;
    }
  } catch {
    gate.hidden = false;
    return;
  }
  app.hidden = false;

  const { categories } = await API.request('/products/categories');
  $('category').innerHTML = categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');

  function resetForm() {
    form.reset();
    $('product-id').value = '';
    $('form-title').textContent = 'Add a product';
    message.textContent = '';
  }

  function fill(p) {
    $('product-id').value = p.id;
    $('name').value = p.name;
    $('category').value = p.category_id;
    $('price').value = p.price_etb;
    $('discount').value = p.discount_percent;
    $('stock').value = p.stock;
    $('popularity').value = p.popularity;
    $('image').value = p.image_url || '';
    $('description').value = p.description || '';
    $('active').checked = p.active;
    $('form-title').textContent = 'Edit product';
    message.textContent = '';
    form.scrollIntoView({ behavior: 'smooth' });
  }

  async function load() {
    products = (await API.request('/admin/products')).products;
    $('admin-count').textContent = `${products.length} product${products.length === 1 ? '' : 's'}`;
    list.innerHTML = products.length ? products.map(p => `<div class="admin-product">
      <img src="${esc(p.image_url || PLACEHOLDER_IMAGE)}" alt="">
      <div><h3>${esc(p.name)}${p.active ? '' : ' <small>(hidden)</small>'}</h3>
      <p>${esc(p.category)} · ${money(p.price_etb)}${Number(p.discount_percent) > 0 ? ` (−${esc(p.discount_percent)}%)` : ''} · ${esc(p.stock)} in stock</p></div>
      <div class="admin-actions"><button data-edit="${esc(p.id)}">Edit</button><button data-delete="${esc(p.id)}">Delete</button></div>
    </div>`).join('') : '<div class="empty"><h2>No products yet</h2><p>Use the form to add your first product.</p></div>';
  }

  list.addEventListener('click', async e => {
    const edit = e.target.closest('[data-edit]');
    const del = e.target.closest('[data-delete]');
    if (edit) fill(products.find(p => p.id === edit.dataset.edit));
    if (del) {
      const p = products.find(x => x.id === del.dataset.delete);
      if (!confirm(`Delete "${p.name}"? Products with past orders are hidden instead of deleted.`)) return;
      try {
        const r = await API.request('/admin/products/' + p.id, { method: 'DELETE' });
        showToast(r.archived ? 'Product hidden (it has past orders)' : 'Product deleted');
        if ($('product-id').value === p.id) resetForm();
        await load();
      } catch (error) {
        showToast(error.message);
      }
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('product-id').value;
    const body = {
      name: $('name').value,
      categoryId: $('category').value,
      priceEtb: Number($('price').value),
      discountPercent: Number($('discount').value || 0),
      stock: Number($('stock').value || 0),
      popularity: Number($('popularity').value || 0),
      imageUrl: $('image').value.trim(),
      description: $('description').value,
      active: $('active').checked,
    };
    try {
      await API.request('/admin/products' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      showToast(id ? 'Product updated' : 'Product added');
      resetForm();
      await load();
    } catch (error) {
      message.textContent = error.message;
    }
  });

  $('cancel-edit').addEventListener('click', resetForm);
  $('new-product').addEventListener('click', () => { resetForm(); $('name').focus(); });
  await load();
});
