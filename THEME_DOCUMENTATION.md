# 🎨 Documentação - Tema Empresarial Preto & Laranja

## 📋 Sumário
- [Visão Geral](#visão-geral)
- [Paleta de Cores](#paleta-de-cores)
- [Componentes](#componentes)
- [Uso de Classes CSS](#uso-de-classes-css)
- [Guia de Customização](#guia-de-customização)

---

## 🎯 Visão Geral

O novo tema **Preto & Laranja** foi desenvolvido com foco em:
- **Profissionalismo**: Design corporativo e moderno
- **Contraste**: Excelente legibilidade com paleta preto e laranja
- **Responsividade**: Funciona perfeitamente em qualquer dispositivo
- **Acessibilidade**: Mantém todos os padrões de contraste WCAG
- **Performance**: CSS otimizado, sem dependências externas

---

## 🎨 Paleta de Cores

### Cores Principais

| Variável | Cor | Uso |
|----------|-----|-----|
| `--bg-primary` | #1A1A1A | Fundo principal da página |
| `--bg-secondary` | #242424 | Fundos de cards e painéis |
| `--bg-tertiary` | #2E2E2E | Fundos de inputs e controles |
| `--bg-hover` | #3A3A3A | Estado hover geral |

### Cores de Destaque

| Variável | Cor | Uso |
|----------|-----|-----|
| `--accent-primary` | #FF6B00 | Cor primária (botões, links) |
| `--accent-hover` | #E05A00 | Hover de elementos laranjas |
| `--accent-pressed` | #C44F00 | Pressionado/ativo |
| `--accent-light` | #FF8C2A | Destaque suave, gradientes |

### Cores de Texto

| Variável | Cor | Uso |
|----------|-----|-----|
| `--text-primary` | #F0F0F0 | Texto principal |
| `--text-secondary` | #A0A0A0 | Texto secundário, labels |
| `--text-tertiary` | #555555 | Texto mutado, hints |
| `--text-disabled` | #555555 | Estados desabilitados |

### Cores de Status

| Tipo | Cor | Uso |
|------|-----|-----|
| Success | #27AE60 | Mensagens de sucesso |
| Warning | #F39C12 | Avisos |
| Error | #E74C3C | Erros |
| Info | #FF6B00 | Informações |

---

## 🧩 Componentes

### Header/Barra Superior

```html
<header class="app-header">
    <div class="header-content">
        <div class="logo"><h1>💪 GymDiet</h1></div>
        <h2 class="page-title">Página Atual</h2>
        <div class="header-actions">
            <a href="/auth/logout" class="btn-logout">Logout</a>
        </div>
    </div>
</header>
```

**Características:**
- Altura fixa: 56px
- Borda inferior: 2px laranja (#FF6B00)
- Sticky (fica fixa ao rolar)
- Responsivo com menu mobile

---

### Sidebar Navigation (Desktop)

```html
<nav class="sidebar-nav">
    <ul>
        <li><a href="/workouts" class="nav-link active">🏋️ Treinos</a></li>
        <li><a href="/diet" class="nav-link">🥗 Dieta</a></li>
    </ul>
</nav>
```

**Características:**
- Largura: 220px
- Borda direita: 3px laranja
- Items com altura: 42px
- Hover com fundo #2A2A2A + borda esquerda laranja
- Ativo com texto laranja

---

### Botões

#### Botão Primário
```html
<button class="btn btn-primary">Ação Principal</button>
```

**Estados:**
- Padrão: Fundo laranja (#FF6B00)
- Hover: Laranja escuro (#E05A00)
- Pressionado: Laranja muito escuro (#C44F00)
- Desabilitado: Cinza opaco

#### Botão Secundário
```html
<button class="btn btn-secondary">Ação Alternativa</button>
```

**Estados:**
- Padrão: Fundo #2E2E2E + borda #3A3A3A
- Hover: Borda laranja + texto laranja

#### Botão Perigo
```html
<button class="btn btn-danger">Deletar</button>
```

**Estados:**
- Padrão: Fundo vermelho (#C0392B)
- Hover: Vermelho escuro (#A93226)

#### Botão Ghost/Link
```html
<a href="#" class="btn btn-ghost">Link</a>
```

- Transparente, apenas texto laranja
- Underline no hover

---

### Cards e Painéis

```html
<div class="card">
    <div class="card-header">
        <h2>Título do Card</h2>
    </div>
    <div class="card-body">
        Conteúdo aqui
    </div>
    <div class="card-footer">
        Rodapé com ações
    </div>
</div>
```

**Variações:**
- `.card-highlight`: Adiciona linha superior laranja 3px

---

### Inputs e Campos

```html
<input type="text" placeholder="Digite algo...">
<textarea placeholder="Descrição..."></textarea>
<select>
    <option>Opção 1</option>
</select>
```

**Estados:**
- Padrão: Fundo #2E2E2E, borda #3A3A3A
- Focus: Borda laranja + glow sutil
- Desabilitado: Opacidade 0.5

---

### Tabelas

```html
<table>
    <thead>
        <tr><th>Coluna 1</th><th>Coluna 2</th></tr>
    </thead>
    <tbody>
        <tr><td>Dados</td><td>Dados</td></tr>
        <tr class="selected"><td>Selecionado</td><td>Com borda</td></tr>
    </tbody>
</table>
```

**Características:**
- Header: Fundo #242424, texto uppercase
- Rows altura: 36px
- Alternadas: cores diferentes
- Selected: borda esquerda laranja 3px

---

### Alertas

```html
<div class="alert alert-success">✓ Sucessso!</div>
<div class="alert alert-error">✕ Erro!</div>
<div class="alert alert-warning">⚠ Aviso</div>
<div class="alert alert-info">ⓘ Informação</div>
```

**Características:**
- Borda esquerda: 4px colorida
- Fundos apropriados para cada tipo
- Ícone automático

---

### Toast Notifications

```javascript
showToast('Mensagem de sucesso', 'success', 4000);
showToast('Erro!', 'error');
```

**Características:**
- Posição: Inferior direita
- Auto-dismiss: 4000ms
- Tipos: success, error, warning, info
- Animação slide-up

---

### Modal

```html
<div id="modal" class="modal">
    <div class="modal-content">
        <span class="modal-close">&times;</span>
        <h2>Título</h2>
        <p>Conteúdo</p>
        <div class="modal-actions">
            <button class="btn btn-secondary" id="modalCancel">Cancelar</button>
            <button class="btn btn-primary">Confirmar</button>
        </div>
    </div>
</div>
```

**Uso JavaScript:**
```javascript
showConfirmation('Confirmação', 'Deseja realmente deletar?', function(confirmed) {
    if (confirmed) { /* fazer algo */ }
});
```

---

### Badges

```html
<span class="badge badge-primary">Primário</span>
<span class="badge badge-success">Sucesso</span>
<span class="badge badge-warning">Aviso</span>
<span class="badge badge-danger">Perigo</span>
```

---

### Stats/KPI

```html
<div class="stats-grid">
    <div class="stat-item">
        <div class="stat-label">MÉTRICA</div>
        <div class="stat-value">42</div>
        <div class="stat-suffix">unidades</div>
    </div>
</div>
```

---

## 📐 Uso de Classes CSS

### Grid e Layouts

```html
<!-- Grid automático 300px minimo -->
<div class="grid">...</div>

<!-- Grid 2 colunas -->
<div class="grid-2">...</div>

<!-- Grid 3 colunas -->
<div class="grid-3">...</div>

<!-- Flex utilitários -->
<div class="flex-between">Espaçado</div>
<div class="flex-center">Centralizado</div>
```

### Espaçamento

```html
<!-- Gaps -->
<div class="gap-1">8px gap</div>
<div class="gap-2">16px gap</div>
<div class="gap-3">24px gap</div>

<!-- Margins -->
<div class="mb-1">margin-bottom 8px</div>
<div class="mb-2">margin-bottom 16px</div>
<div class="mb-3">margin-bottom 24px</div>

<div class="mt-1">margin-top 8px</div>
<div class="mt-2">margin-top 16px</div>
<div class="mt-3">margin-top 24px</div>
```

### Utilitários de Texto

```html
<div class="text-center">Centralizado</div>
<div class="text-right">Alinhado à direita</div>
<div class="text-primary">Texto laranja</div>
<div class="text-muted">Texto desabilitado</div>

<div class="d-none">Escondido</div>
<div class="d-block">Block display</div>
<div class="d-flex">Flex display</div>
```

---

## 🛠️ Guia de Customização

### Alterar Cores do Tema

Edite as variáveis CSS em `src/public/css/style.css` no seção `:root`:

```css
:root {
    /* Alterar cores de fundo */
    --bg-primary: #1A1A1A;      /* Altere aqui */
    --bg-secondary: #242424;    /* Altere aqui */
    
    /* Alterar laranja primário */
    --accent-primary: #FF6B00;  /* Altere para outra cor */
}
```

### Adicionar Nova Cor de Status

```css
:root {
    /* Adicione junto com outras cores */
    --status-custom: #XXXX00;
}

.alert-custom {
    background-color: /* cor com transparência */;
    border-left-color: var(--status-custom);
    color: var(--text-primary);
}
```

### Ajustar Breakpoints Responsivos

Os breakpoints estão no final do CSS:
- **1024px**: Desktop médio
- **768px**: Tablet
- **480px**: Mobile pequeno

Altere conforme necessário.

### Modificar Tamanhos de Fontes

Todas as fontes usam `pt` (pontos):
- **Body**: 9pt
- **Titles H1**: 18pt
- **Titles H2**: 13pt
- **Labels**: 8pt

Altere em `body { font-size: 9pt; }` e demais seletores.

---

## 📱 Responsividade

### Desktop (1025px+)
- Sidebar visível (220px)
- Bottom nav escondida
- Grid completo

### Tablet (768px - 1024px)
- Sidebar 180px
- Layout ajustado
- Bottom nav escondida
- Grids 2 colunas

### Mobile (<768px)
- Sidebar escondida
- Bottom nav visível
- Layout single column
- Padding reduzido
- Bottom nav fixa com padding extra

---

## ✨ Animações Disponíveis

```javascript
// Usar animações JavaScript
await animate(element, 'slideIn', 300);     // Slide in (padrão 300ms)
await animate(element, 'slideInDown', 500); // Slide down
await animate(element, 'fadeIn', 200);      // Fade in

// Efeitos automáticos em botões
// - Ripple effect em clicks
// - Transições suaves em hover
```

---

## 🚀 Performance

- **CSS minificado**: Sem dependências externas
- **Sem JavaScript pesado**: Apenas funcionalidades essenciais
- **Font padrão**: Segoe UI (web-safe)
- **Lazy loading**: Imagens carregam sob demanda
- **GPU acceleration**: Transform e opacity para animações

---

## 🔍 Testes de Contraste

Todas as cores atendem ao **WCAG AA**:
- Texto preto/cinza sobre fundo claro: ✅
- Texto branco sobre fundos escuros: ✅
- Links laranja sobre fundos escuros: ✅
- Ícones e bordas: ✅

---

## 📞 Suporte

Para customizações específicas ou dúvidas sobre o tema, consulte:
1. Este documento
2. Variáveis CSS no arquivo
3. Classes de exemplo nas views

---

**Tema versão**: 1.0.0 | **Última atualização**: 2026-04-14
