// Admin-styled replacements for the browser's confirm(), alert() and prompt():
// a small modal <dialog>, built on demand, that resolves a promise.
//   await confirmDialog('Устгах уу?', { ok: 'Устгах', danger: true }) -> true / false
//   await alertDialog('...')                                         -> undefined
//   await promptDialog('Хаяг:', 'https://')                         -> text / null

let count = 0;

function open({ message, ok = 'Тийм', cancel = 'Болих', danger = false, input = null }) {
  return new Promise((resolve) => {
    const id = `a-dialog-${++count}`;
    const dialog = document.createElement('dialog');
    dialog.className = 'a-modal a-dialog';
    dialog.setAttribute('role', input === null && cancel ? 'alertdialog' : 'dialog');
    dialog.setAttribute('aria-labelledby', id);
    dialog.innerHTML = `
      <form method="dialog" class="a-dialog-body">
        <p class="a-dialog-text" id="${id}"></p>
        <div class="a-dialog-actions"></div>
      </form>`;
    const form = dialog.querySelector('form');
    form.querySelector('p').textContent = message;

    let field = null;
    if (input !== null) {
      field = document.createElement('input');
      field.className = 'a-dialog-input';
      field.value = input;
      field.setAttribute('aria-labelledby', id);
      form.insertBefore(field, form.lastElementChild);
    }
    const button = (label, className) => {
      const b = document.createElement('button');
      b.className = className;
      b.textContent = label;
      form.lastElementChild.append(b);
      return b;
    };
    // "Cancel" is a plain button, so Enter (in the text field) submits "OK".
    const no = cancel ? button(cancel, 'a-btn') : null;
    if (no) {
      no.type = 'button';
      no.addEventListener('click', () => dialog.close('cancel'));
    }
    const yes = button(ok, `a-btn ${danger ? 'a-btn-danger' : 'a-btn-primary'}`);
    yes.value = 'ok';

    // Esc and a click on the backdrop cancel too.
    dialog.addEventListener('click', (e) => e.target === dialog && dialog.close('cancel'));
    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'ok';
      dialog.remove();
      if (input !== null) resolve(confirmed ? field.value : null);
      else resolve(cancel ? confirmed : undefined);
    });

    document.body.append(dialog);
    dialog.showModal();
    // Dangerous questions start on "cancel"; Enter in the text field confirms.
    if (field) field.select();
    else (danger && no ? no : yes).focus();
  });
}

export const confirmDialog = (message, options = {}) => open({ message, ...options });
export const alertDialog = (message) => open({ message, ok: 'Ойлголоо', cancel: null });
export const promptDialog = (message, value = '') => open({ message, input: value, ok: 'Оруулах' });
