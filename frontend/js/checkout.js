document.addEventListener('DOMContentLoaded', async () => {
  const form = document.querySelector('#checkout-form');
  if (!form) return;
  const msg = document.querySelector('#checkout-message');
  const methodSelect = form.querySelector('[name=paymentMethod]');
  const bankInfo = document.querySelector('#bank-info');
  let bank = null;

  // Only offer payment methods the server has enabled.
  try {
    const data = await API.request('/payments/methods');
    bank = data.bank;
    methodSelect.innerHTML = data.methods.filter(m => m.enabled).map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
  } catch {
    methodSelect.innerHTML = '<option value="cod">Cash on delivery</option>';
  }

  function showBank() {
    if (methodSelect.value === 'bank_transfer' && bank && bank.accountNumber) {
      bankInfo.textContent = `Transfer to ${bank.name} · ${bank.accountName} · ${bank.accountNumber}. Your order is confirmed after the store verifies payment.`;
    } else {
      bankInfo.textContent = methodSelect.value === 'bank_transfer' ? 'Bank details will be sent to you by the store.' : '';
    }
  }
  methodSelect.addEventListener('change', showBank);
  showBank();

  // Local delivery only makes sense for Debre Birhan addresses.
  const city = form.querySelector('[name=city]');
  const delivery = form.querySelector('[name=deliveryType]');
  city.addEventListener('change', () => {
    delivery.value = city.value.trim().toLowerCase() === 'debre birhan' ? 'local' : 'nationwide';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const cart = cartData();
    if (!cart.length) {
      msg.textContent = 'Your cart is empty.';
      return;
    }
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    msg.textContent = 'Placing your order…';
    try {
      await API.request('/auth/me');
    } catch {
      msg.innerHTML = 'Please <a href="/login.html" class="blue-text">sign in</a> or <a href="/register.html" class="blue-text">create an account</a> to place your order. Your cart is saved.';
      button.disabled = false;
      return;
    }
    try {
      const data = Object.fromEntries(new FormData(form));
      const address = await API.request('/customers/addresses', {
        method: 'POST',
        body: JSON.stringify({ region: data.region, city: data.city, neighborhood: data.neighborhood, streetOrLandmark: data.landmark }),
      });
      const { order } = await API.request('/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map(x => ({ productId: x.id, quantity: x.qty })),
          addressId: address.address.id,
          deliveryType: data.deliveryType,
          paymentMethod: data.paymentMethod,
        }),
      });
      saveCart([]);
      form.reset();
      msg.textContent = `Order placed. Total ${money(order.total_etb)}. Order number: ${order.id.slice(0, 8).toUpperCase()}.`;
    } catch (error) {
      msg.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
});
