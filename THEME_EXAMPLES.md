# 🎨 Guia Prático - Usando o Tema Preto & Laranja

## 📚 Exemplos Práticos

Este arquivo contém exemplos prontos para usar o novo tema em suas páginas.

---

## 1️⃣ Layout Básico com Card

```html
<div class="card">
    <div class="card-header">
        <h2>Meu Card</h2>
    </div>
    <div class="card-body">
        <p>Conteúdo aqui</p>
    </div>
    <div class="card-footer">
        <button class="btn btn-primary">Ação</button>
    </div>
</div>
```

---

## 2️⃣ Formulário Completo

```html
<form class="form">
    <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" placeholder="seu@email.com" required>
    </div>
    
    <div class="form-group">
        <label for="password">Senha</label>
        <input type="password" id="password" placeholder="••••••••" required>
    </div>
    
    <div class="form-group">
        <label for="description">Descrição</label>
        <textarea id="description" placeholder="Digite aqui..." rows="4"></textarea>
    </div>
    
    <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Enviar</button>
        <button type="reset" class="btn btn-secondary">Limpar</button>
    </div>
</form>
```

---

## 3️⃣ Grid de Cards com Stats

```html
<div class="grid">
    <% items.forEach(item => { %>
        <div class="card">
            <div class="card-header">
                <h2><%= item.title %></h2>
                <span class="badge badge-primary">Live</span>
            </div>
            
            <div class="card-body">
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Total</div>
                        <div class="stat-value"><%= item.count %></div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Ativo</div>
                        <div class="stat-value" style="color: var(--status-success);">
                            <%= item.active %>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card-footer">
                <a href="/items/<%= item.id %>" class="btn btn-secondary">Ver Detalhes</a>
            </div>
        </div>
    <% }); %>
</div>
```

---

## 4️⃣ Tabela com Dados

```html
<div class="card">
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Status</th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody>
            <% items.forEach(item => { %>
                <tr class="<%= item.selected ? 'selected' : '' %>">
                    <td><%= item.id %></td>
                    <td><%= item.name %></td>
                    <td>
                        <span class="badge badge-<%= item.status.type %>">
                            <%= item.status.label %>
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-secondary">Editar</button>
                        <button class="btn btn-danger">Deletar</button>
                    </td>
                </tr>
            <% }); %>
        </tbody>
    </table>
</div>
```

---

## 5️⃣ Page Header com Breadcrumb

```html
<div class="mb-3">
    <h1 class="section-title">Página de Exemplo</h1>
    <p class="section-subtitle">Subtítulo descritivo aqui</p>
</div>

<!-- Breadcrumb opcional -->
<div style="font-size: 9pt; color: var(--text-secondary); margin-bottom: 24px;">
    <a href="/" style="color: var(--accent-primary); text-decoration: none;">Home</a>
    <span style="margin: 0 6px;">›</span>
    <a href="/exemplo" style="color: var(--accent-primary); text-decoration: none;">Seção</a>
    <span style="margin: 0 6px;">›</span>
    <span>Página Atual</span>
</div>
```

---

## 6️⃣ Alert/Mensagem

```html
<!-- Alert Success -->
<div class="alert alert-success">
    Ação realizada com sucesso!
</div>

<!-- Alert Error -->
<div class="alert alert-error">
    Oops! Algo deu errado. Tente novamente.
</div>

<!-- Alert Warning -->
<div class="alert alert-warning">
    Aviso: Esta ação não pode ser desfeita.
</div>

<!-- Alert Info -->
<div class="alert alert-info">
    Informação: Você será redirecionado em 5 segundos.
</div>
```

---

## 7️⃣ Botões em Diferentes Estados

```html
<div class="flex gap-2">
    <!-- Primário -->
    <button class="btn btn-primary">Enviar</button>
    
    <!-- Primário Grande -->
    <button class="btn btn-primary btn-lg">Enviar (Grande)</button>
    
    <!-- Secundário -->
    <button class="btn btn-secondary">Próximo</button>
    
    <!-- Perigo -->
    <button class="btn btn-danger">Deletar</button>
    
    <!-- Ghost/Link -->
    <button class="btn btn-ghost">Link</button>
    
    <!-- Desabilitado -->
    <button class="btn btn-primary" disabled>Desabilitado</button>
    
    <!-- Bloco inteiro -->
    <button class="btn btn-primary btn-block">Ocupar Tudo</button>
</div>
```

---

## 8️⃣ Validação de Formulário com Toast

```html
<form onsubmit="handleSubmit(event)">
    <div class="form-group">
        <label>Email Requerido</label>
        <input type="email" id="email" required>
        <span class="hint">Exemplo: usuario@email.com</span>
    </div>
    
    <button type="submit" class="btn btn-primary btn-lg btn-block">
        Cadastrar
    </button>
</form>

<script>
function handleSubmit(event) {
    event.preventDefault();
    
    // Validar
    const email = document.getElementById('email').value;
    
    if (!email) {
        showToast('Preencha o email', 'error');
        return;
    }
    
    // Enviar (exemplo)
    showToast('Email válido!', 'success');
    // ... enviar dados
}
</script>
```

---

## 9️⃣ Modal de Confirmação

```html
<!-- Botão que abre modal -->
<button class="btn btn-danger" onclick="confirmDelete()">
    Deletar Item
</button>

<script>
function confirmDelete() {
    showConfirmation(
        'Confirmar Exclusão',
        'Tem certeza que deseja deletar este item? Esta ação não pode ser desfeita.',
        function(confirmed) {
            if (confirmed) {
                // Realizar ação de delete
                showToast('Item deletado com sucesso', 'success');
            }
        }
    );
}
</script>
```

---

## 🔟 Card com Destaque (Highlight)

```html
<div class="card card-highlight">
    <div class="card-header">
        <h2>Aviso Importante</h2>
    </div>
    <div class="card-body">
        <p>Este card tem uma linha laranja no topo indicando importância.</p>
    </div>
</div>
```

---

## 1️⃣1️⃣ Loading Spinner

```html
<div class="flex-center">
    <div style="font-size: 24px; animation: pulse 1s infinite;">⏳</div>
    <span style="margin-left: 8px; color: var(--text-secondary);">Carregando...</span>
</div>
```

---

## 1️⃣2️⃣ Empty State

```html
<div class="empty-state">
    <p style="font-size: 48px; margin-bottom: 16px;">📦</p>
    <p>Nenhum item encontrado</p>
    <button class="btn btn-primary" onclick="createNew()">
        + Criar Novo
    </button>
</div>
```

---

## 1️⃣3️⃣ Card com Stats Complexo

```html
<div class="card">
    <div class="card-header">
        <h2>Resumo Mensal</h2>
    </div>
    
    <div class="card-body">
        <div class="stats-grid">
            <div class="stat-item">
                <div class="stat-label">Total Vendas</div>
                <div class="stat-value">R$ 5.230</div>
                <div class="stat-suffix">este mês</div>
            </div>
            
            <div class="stat-item">
                <div class="stat-label">Pedidos</div>
                <div class="stat-value">42</div>
                <div class="stat-suffix">+15% vs mês anterior</div>
            </div>
            
            <div class="stat-item">
                <div class="stat-label">Taxa de Conversão</div>
                <div class="stat-value">3.2%</div>
                <div class="stat-suffix">acima da média</div>
            </div>
            
            <div class="stat-item">
                <div class="stat-label">Clientes Ativos</div>
                <div class="stat-value">128</div>
                <div class="stat-suffix">total cadastrados</div>
            </div>
        </div>
    </div>
</div>
```

---

## 1️⃣4️⃣ Form Inline com Row

```html
<div class="form-group" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
    <div>
        <label>Nome</label>
        <input type="text" placeholder="João">
    </div>
    
    <div>
        <label>Sobrenome</label>
        <input type="text" placeholder="Silva">
    </div>
</div>

<div class="form-group" style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
    <div>
        <label>Email</label>
        <input type="email" placeholder="joao@email.com">
    </div>
    
    <div>
        <label>Telefone</label>
        <input type="tel" placeholder="+55 11 9999-9999">
    </div>
</div>
```

---

## 1️⃣5️⃣ Página Completa Exemplo

```html
<!-- Page Title -->
<div class="mb-3">
    <h1 class="section-title">Dashboard</h1>
    <p class="section-subtitle">Bem-vindo ao seu dashboard pessoal</p>
</div>

<!-- Alerts if exist -->
<% if (message) { %>
    <div class="alert alert-<%= message.type %>">
        <%= message.text %>
    </div>
<% } %>

<!-- Stats Cards -->
<div class="grid-2">
    <div class="stats-card">
        <div class="stat-item">
            <div class="stat-label">Treinos Esta Semana</div>
            <div class="stat-value"><%= workoutsThisWeek %></div>
        </div>
    </div>
    
    <div class="stats-card">
        <div class="stat-item">
            <div class="stat-label">Média de Calorias</div>
            <div class="stat-value"><%= avgCalories %></div>
        </div>
    </div>
</div>

<!-- Main Content Grid -->
<div class="grid">
    <div class="card">
        <div class="card-header">
            <h2>Próximo Treino</h2>
        </div>
        <div class="card-body">
            <%= nextWorkout.name %>
        </div>
        <div class="card-footer">
            <a href="/workouts/<%= nextWorkout.id %>" class="btn btn-primary">
                Iniciar
            </a>
        </div>
    </div>
    
    <div class="card">
        <div class="card-header">
            <h2>Última Refeição</h2>
        </div>
        <div class="card-body">
            <%= lastMeal.name %> - <%= lastMeal.calories %> kcal
        </div>
        <div class="card-footer">
            <a href="/diet" class="btn btn-secondary">Ver Dieta</a>
        </div>
    </div>
</div>
```

---

## 📝 Notas Importantes

- ✅ **Sempre use classes CSS fornecidas** - não cria estilos inline quando possível
- ✅ **Use variáveis CSS** para cores - isso permite manutenção centralizada
- ✅ **Teste em mobile** - o tema é responsivo
- ✅ **Mantenha contraste** - respeite as cores definidas
- ✅ **Use animações com moderação** - performance em primeiro lugar

---

**Exemplos versão**: 1.0.0 | Última atualização: 2026-04-14
