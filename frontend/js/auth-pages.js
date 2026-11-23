// Login and register forms (kept out of inline <script> so the Content Security Policy can block inline scripts).
document.addEventListener('DOMContentLoaded', () => {
  for (const [selector, path] of [['#login-form', '/auth/login'], ['#register-form', '/auth/register']]) {
    const form = document.querySelector(selector);
    if (!form) continue;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const message = document.querySelector('#message');
      message.textContent = '';
      try {
        await API.request(path, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
        const back = document.referrer && new URL(document.referrer).origin === location.origin && /checkout|cart/.test(document.referrer);
        location.href = back ? '/checkout.html' : '/index.html';
      } catch (error) {
        message.textContent = error.message;
      }
    });
  }
});
