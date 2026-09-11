# 🚀 GymDiet - Deployment Checklist para Render

## ✅ Antes de Fazer Deploy

### **1. Verificar Arquivos Críticos**
- [ ] `app.js` - Existe e está correto
- [ ] `package.json` - Todas as dependências listadas
- [ ] `Dockerfile` - Está na raiz do projeto
- [ ] `docker-compose.yml` - Para testes locais
- [ ] `prisma/schema.prisma` - Schema do banco
- [ ] `prisma/seed.js` - Dados de exemplo
- [ ] `.env.example` - Template de variáveis
- [ ] `render.yaml` - Configuração de deploy
- [ ] `.dockerignore` - Arquivos a ignorar
- [ ] `README.md` - Documentação

### **2. Preparar GitHub**
- [ ] Repositório criado (https://github.com/seu-usuario/gymdiet)
- [ ] Código feito push para branch `main`
- [ ] Branch `main` é o padrão
- [ ] `.gitignore` está correto
- [ ] Node modules NÃO foram commitados

```bash
# Verificar:
git log --oneline | head -5
git branch -a
```

### **3. Preparar Render**
- [ ] Conta Render criada (https://render.com)
- [ ] Email verificado
- [ ] GitHub conectado em Settings → GitHub
- [ ] Payment method adicionado (se usar plano pago)

### **4. Testar Localmente**
```bash
# Limpar tudo
make clean

# Instalar
make install

# Iniciar
make dev

# Em outro terminal:
# - Teste http://localhost:3000
# - Login: admin/admin123
# - Verifique workouts, diet, shopping

# Parar
make dev-stop
```

---

## 🚀 Passo a Passo do Deploy

### **Etapa 1: Criar Database no Render** (5 minutos)
```
1. Acesse https://dashboard.render.com
2. Clique em "New" → "PostgreSQL"
3. Preenchaoptions:
   - Name: gymdiet-db
   - Database: gymdb
   - User: gymuser
   - Region: (selecione mais próxima)
   - Plan: Free
4. Clique "Create Database"
5. COPIE a Connection String (vem com DATABASE_URL)
```

### **Etapa 2: Deploy da Aplicação** (10 minutos)
```
1. Dashboard Render → "New" → "Web Service"
2. Selecione "Deploy an existing Git repository"
3. Selecione seu repositório gymdiet
4. Configure:
   - Name: gymdiet-app
   - Branch: main
   - Runtime: Docker
   - Region: MESMA do database
   - Plan: Free
5. Clique "Create Web Service"
6. AGUARDE O BUILD (5-10 minutos)
```

### **Etapa 3: Configurar Environment** (2 minutos)
```
Enquanto aguarda o build:
1. Abra seu Web Service
2. Vá em "Environment"
3. Clique "Add Environment Variable"
4. Adicione:
   - NODE_ENV = production
   - PORT = 3000
   - DATABASE_URL = (copiar do database PostgreSQL)
   - SESSION_SECRET = (deixe vazio, Render gera)
5. Clique "Save"
6. Clique "Redeploy"
```

### **Etapa 4: Rodar Migrações** (3 minutos)
```
1. Quando deployment terminar, clique em "Shell"
2. Execute:
   npm run db:migrate
   npm run db:seed
3. Aguarde conclusão
4. Pronto! ✅
```

---

## 📊 Verificar Deploy

| Item | Como Verificar |
|------|-----------------|
| Aplicação Online | Clique no link do Render (ex: gymdiet-app.onrender.com) |
| Login Funciona | Teste admin/admin123 |
| Database Conectado | Se conseguir fazer login, está ok |
| Dados Carregados | Vá em Treinos - se vê 5 planos, está ok |
| Histórico | Vá em Histórico - deve estar vazio (1º vez) |

---

## 🔧 Pós-Deploy

### **Adicionar Domínio Customizado** (opcional)
```
1. Em seu Web Service → Settings
2. Vá para "Custom Domain"
3. Adicione seu domínio (ex: gymdiet.com)
4. Siga instruções de DNS
```

### **Configurar Auto-Deploy**
```
Render já faz isso por padrão:
- Sempre que você faz push para 'main'
- Render faz build automático
- Deploy automático
```

### **Backups do Database**
```
1. Vá no seu PostgreSQL database
2. Settings → Backups
3. Habilitar backups automáticos
```

---

## 🚨 Se Der Problema

### **1. Build Falhando**
```bash
# Verifique os Logs do Build
Dashboard → Build Log

# Se vir erro de npm:
# Vá em Shell e execute:
npm ci --force
npx prisma generate
```

### **2. Application Error**
```bash
# Verifique os Logs
Dashboard → Analytics & Logs

# Se vir DATABASE_URL undefined:
# Vá em Environment e adicione
```

### **3. Migração Falhou**
```bash
# No Shell:
npm run db:migrate

# Se falhar:
npx prisma db push --force-reset
npm run db:seed
```

**Veja mais**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 💡 Dicas Importantes

✅ **Sempre fazer push para 'main' antes de deploy**
```bash
git add .
git commit -m "mensagem"
git push origin main
```

✅ **Não commitar .env ou node_modules**
```bash
# Verificar:
git status
```

✅ **Use o Shell do Render para debug**
```bash
1. Dashboard → Seu Web Service
2. Clique em "Shell"
3. Execute comandos
```

✅ **Salve os Logs se der erro**
```bash
1. Copie o erro do Analytics & Logs
2. Compartilhe quando pedir ajuda
```

---

## 🎯 URLs Importantes

| Item | URL |
|------|-----|
| Aplicação | https://gymdiet-app.onrender.com |
| Dashboard | https://dashboard.render.com |
| GitHub | https://github.com/seu-usuario/gymdiet |
| Prisma Docs | https://www.prisma.io/docs/ |
| Render Docs | https://render.com/docs |

---

## 📝 Comandos Rápidos

```bash
# Iniciar desenvolvimento
make dev

# Deploy (após git push)
make deploy

# Ver logs
make logs

# Limpar tudo
make clean

# Help
make help
```

---

**Versão**: 1.0.0  
**Data**: Abril 2026  
**Status**: ✅ Pronto para Deploy
