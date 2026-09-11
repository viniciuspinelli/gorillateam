# ⚡ Quick Reference - Tema Preto & Laranja

## 🎯 Início Rápido

### Cores Principais (3 segundos)
```
Fundo:  #1A1A1A  (Preto)
Laranja: #FF6B00 (Destaque)
Texto:  #F0F0F0  (Branco)
```

### Botões (1 linha)
```html
<button class="btn btn-primary">Primário</button>
<button class="btn btn-secondary">Secundário</button>
<button class="btn btn-danger">Perigo</button>
```

### Card (3 linhas)
```html
<div class="card">
    <div class="card-body">Conteúdo</div>
</div>
```

### Input (1 linha)
```html
<input type="text" placeholder="Digite...">
```

### Layout Grid (1 linha)
```html
<div class="grid"><!-- Auto 3 colunas --></div>
```

---

## 📋 Cheat Sheet - CSS Classes

### Layout
| Classe | Efeito |
|--------|--------|
| `.grid` | Grid automático 300px+ |
| `.grid-2` | 2 colunas |
| `.grid-3` | 3 colunas |
| `.flex` | Display flex |
| `.flex-between` | Space-between |
| `.flex-center` | Centralizado |

### Espaçamento
| Classe | Valor |
|--------|-------|
| `.gap-1` | 8px gap |
| `.gap-2` | 16px gap |
| `.gap-3` | 24px gap |
| `.mb-1` | 8px margin-bottom |
| `.mb-2` | 16px margin-bottom |
| `.mb-3` | 24px margin-bottom |

### Botões
| Classe | Uso |
|--------|-----|
| `.btn` | Classe base |
| `.btn-primary` | Ação principal (laranja) |
| `.btn-secondary` | Alternativa (cinza) |
| `.btn-danger` | Deletar/Perigo (vermelho) |
| `.btn-ghost` | Link (transparente) |
| `.btn-lg` | Grande |
| `.btn-block` | Tela inteira |

### Cards & Containers
| Classe | Uso |
|--------|-----|
| `.card` | Card padrão |
| `.card-highlight` | Com linha laranja topo |
| `.card-header` | Título section |
| `.card-body` | Conteúdo |
| `.card-footer` | Ações |

### Texto
| Classe | Efeito |
|--------|--------|
| `.text-center` | Centralizado |
| `.text-right` | Alinhado direita |
| `.text-primary` | Laranja |
| `.text-muted` | Cinza desabilitado |

### Utilitários
| Classe | Efeito |
|--------|--------|
| `.d-none` | display: none |
| `.d-block` | display: block |
| `.d-flex` | display: flex |

### Componentes
| Classe | Uso |
|--------|-----|
| `.alert` | Alerta base |
| `.alert-success` | Verde |
| `.alert-error` | Vermelho |
| `.alert-warning` | Amarelo |
| `.alert-info` | Laranja |
| `.badge` | Badge base |
| `.badge-primary` | Laranja |
| `.badge-success` | Verde |
| `.badge-danger` | Vermelho |
| `.modal` | Modal overlay |
| `.toast` | Notificação |

---

## 🎨 Cores - Variáveis CSS

```css
/* Fundos */
var(--bg-primary)    /* #1A1A1A */
var(--bg-secondary)  /* #242424 */
var(--bg-tertiary)   /* #2E2E2E */

/* Laranja */
var(--accent-primary)   /* #FF6B00 */
var(--accent-hover)     /* #E05A00 */
var(--accent-light)     /* #FF8C2A */

/* Texto */
var(--text-primary)     /* #F0F0F0 */
var(--text-secondary)   /* #A0A0A0 */
var(--text-tertiary)    /* #555555 */
```

---

## ⚙️ JavaScript - Funções Úteis

### Toast Notification
```javascript
showToast('Mensagem', 'success');  // 'success', 'error', 'warning', 'info'
showToast('Erro!', 'error', 3000); // 3000ms custom duration
```

### Modal Confirmation
```javascript
showConfirmation('Título', 'Mensagem?', function(confirmed) {
    if (confirmed) { /* fazer algo */ }
});
```

### Close Modal
```javascript
closeModal();
```

### Animate Element
```javascript
animate(element, 'slideIn', 300);  // 'slideIn', 'slideInDown', 'fadeIn'
```

---

## 📱 Breakpoints Responsivos

```css
/* Desktop */
@media (min-width: 1025px) { ... }

/* Tablet */
@media (max-width: 1024px) { ... }

/* Mobile */
@media (max-width: 768px) { ... }

/* Mobile Pequeno */
@media (max-width: 480px) { ... }
```

---

## 🔥 Exemplos Mais Comuns

### Página com Stats
```html
<div class="mb-3">
    <h1 class="section-title">Dashboard</h1>
</div>

<div class="grid-2">
    <div class="stats-card">
        <div class="stat-item">
            <div class="stat-label">MÉTRICA</div>
            <div class="stat-value">42</div>
        </div>
    </div>
</div>
```

### Formulário Simples
```html
<div class="card">
    <div class="card-body">
        <div class="form-group">
            <label>Email</label>
            <input type="email" placeholder="seu@email.com">
        </div>
        <button class="btn btn-primary">Enviar</button>
    </div>
</div>
```

### Tabela
```html
<div class="card">
    <table>
        <thead>
            <tr><th>Coluna 1</th><th>Coluna 2</th></tr>
        </thead>
        <tbody>
            <tr><td>Dado 1</td><td>Dado 2</td></tr>
        </tbody>
    </table>
</div>
```

### Alert
```html
<div class="alert alert-success">Sucesso!</div>
<div class="alert alert-error">Erro!</div>
```

### Badges
```html
<span class="badge badge-primary">Primário</span>
<span class="badge badge-success">Sucesso</span>
```

---

## 📖 Documentação Completa

| Arquivo | Conteúdo |
|---------|----------|
| `THEME_DOCUMENTATION.md` | Referência completa |
| `THEME_EXAMPLES.md` | 15+ exemplos |
| `THEME_IMPLEMENTATION.md` | Checklist |
| `REDESIGN_SUMMARY.md` | Resumo visual |
| **ESTE ARQUIVO** | **Quick reference** |

---

## 🚀 Atualizar Produção

```bash
# 1. Commit das mudanças
git add .
git commit -m "✨ Novo tema empresarial preto & laranja"

# 2. Push para repositório
git push origin main

# 3. Redeployment automático (se configurado) ou manual
npm run build  # se aplicável
npm start      # reiniciar servidor
```

---

## ⚡ Performance Tips

✅ CSS + JS são muito leves (< 50KB)  
✅ Sem dependências externas  
✅ Lazy load images com `loading="lazy"`  
✅ Minify CSS em produção  
✅ Enable GZIP compression  

---

## 🎨 Regras de Ouro

1. **USE CLASSES CSS** - Não inline styles
2. **USE VARIÁVEIS** - `var(--accent-primary)` não `#FF6B00`
3. **TESTE MOBILE** - Não apenas desktop
4. **CONTRASTE** - Respeite os fundos
5. **CONSISTÊNCIA** - Mesmo padrão em toda app

---

## 🆘 Troubleshooting Rápido

**Arquivo CSS não carrega?**  
→ Verifique em DevTools (F12) se o arquivo está sendo servido  
→ Pasta correta: `src/public/css/style.css`

**Toast não aparece?**  
→ Incluir `theme.js` após `utils.js` no layout  
→ Chamar `showToast()` no console para testar

**Cores não aparecem?**  
→ Limpar cache do navegador (Ctrl+Shift+R)  
→ Hard refresh F12 → Network → "Disable cache"

**Layout quebrado no mobile?**  
→ Verifique viewport meta tag  
→ Teste com F12 Device Toggle

---

## 📚 Referências Rápidas

**Minha cor não está aqui!**  
→ Edite `:root` em `style.css` (topo do arquivo)

**Preciso de outra cor de status?**  
→ Adicione em `:root` e crie classe `.alert-custom`

**Quero mais espaçamento?**  
→ Adicione `.mb-4` em utilidades (modifique SCSS se tiver)

---

## 💡 Dica Final

Todas as animações são **suaves e profissionais**:
- Hover: 150ms ease
- Transições: 200-300ms
- Sem delays desnecessários

**Resultado: Interface responsiva e elegante! ✨**

---

**Versão**: 1.0.0  
**Última atualização**: 14 de Abril de 2026  
**Status**: ✅ Pronto para usar
