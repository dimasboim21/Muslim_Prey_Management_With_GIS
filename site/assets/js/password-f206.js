(function () {
  'use strict';
  const fields = [
    ['loginPassword', 'password login', 'login password'],
    ['accountPassword', 'password baru', 'new password'],
    ['accountCurrentPassword', 'password saat ini', 'current password']
  ];
  const controls = [];
  function update(control, visible) {
    const en = document.documentElement.lang === 'en';
    control.input.type = visible ? 'text' : 'password';
    control.button.textContent = en ? (visible ? 'Hide' : 'Show') : (visible ? 'Sembunyikan' : 'Tampilkan');
    control.button.setAttribute('aria-pressed', String(visible));
    control.button.setAttribute('aria-label', (en ? (visible ? 'Hide ' : 'Show ') : (visible ? 'Sembunyikan ' : 'Tampilkan ')) + control.names[en ? 1 : 0]);
  }
  fields.forEach(([id, idName, enName]) => {
    const input = document.getElementById(id);
    if (!input) return;
    const wrapper = document.createElement('span');
    wrapper.className = 'password-control';
    input.before(wrapper);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'password-visibility-toggle';
    button.setAttribute('aria-controls', id);
    wrapper.append(input, button);
    const control = { input, button, names: [idName, enName] };
    controls.push(control);
    update(control, false);
    button.addEventListener('click', () => {
      const start = input.selectionStart, end = input.selectionEnd;
      update(control, input.type === 'password');
      input.focus({ preventScroll: true });
      if (start !== null) input.setSelectionRange(start, end);
    });
    input.form?.addEventListener('reset', () => update(control, false));
    input.closest('dialog')?.addEventListener('close', () => update(control, false));
  });
  window.addEventListener('mpm:language-changed', () => {
    controls.forEach(control => update(control, control.input.type === 'text'));
  });
})();
