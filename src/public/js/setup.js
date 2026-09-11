document.addEventListener('DOMContentLoaded', () => {
  const setupForm = document.getElementById('setupForm');
  const formSetup = document.getElementById('formSetup');
  const jaConfigurado = document.getElementById('jaConfigurado');
  const mensagem = document.getElementById('mensagem');
  const btnSubmit = document.getElementById('btnSubmit');

  async function verificarAdminExiste() {
    try {
      const res = await fetch('/setup/admin-existe');
      const data = await res.json();

      if (data.existe) {
        if (formSetup) formSetup.style.display = 'none';
        if (jaConfigurado) jaConfigurado.style.display = 'block';
      }
    } catch (err) {
      console.error('Erro ao verificar admin:', err);
    }
  }

  if (setupForm) {
    setupForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (!username || !password || !confirmPassword) {
        mensagem.textContent = 'Todos os campos são obrigatórios';
        mensagem.className = 'message erro';
        return;
      }

      if (password !== confirmPassword) {
        mensagem.textContent = 'As senhas não coincidem';
        mensagem.className = 'message erro';
        return;
      }

      if (password.length < 6) {
        mensagem.textContent = 'Senha deve ter pelo menos 6 caracteres';
        mensagem.className = 'message erro';
        return;
      }

      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Criando...';
      mensagem.className = 'message';
      mensagem.textContent = '';

      try {
        const res = await fetch('/setup/setup-admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password, confirmPassword })
        });

        const data = await res.json();

        if (data.sucesso) {
          mensagem.textContent = '✅ Admin criado com sucesso! Redirecionando...';
          mensagem.className = 'message sucesso';

          setTimeout(() => {
            window.location.href = '/auth/login';
          }, 2000);
        } else {
          mensagem.textContent = '❌ ' + (data.erro || 'Erro ao criar admin');
          mensagem.className = 'message erro';
          btnSubmit.disabled = false;
          btnSubmit.textContent = 'Criar Admin';
        }
      } catch (err) {
        console.error('Erro:', err);
        mensagem.textContent = '❌ Erro de conexão. Tente novamente.';
        mensagem.className = 'message erro';
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Criar Admin';
      }
    });
  }

  verificarAdminExiste();
});
