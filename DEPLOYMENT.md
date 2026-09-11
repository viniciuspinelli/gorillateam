# GymDiet - Deployment Guide para Render.com

## 🚀 Passo a Passo para Deploy no Render

### **Pré-requisitos**
- Conta no [Render.com](https://render.com)
- Repositório GitHub com o código
- Docker instalado localmente (opcional, para testes)

### **Etapa 1: Preparar o Repositório GitHub**

1. **Clone o repositório local:**
```bash
cd c:\Users\vinic\GymDiet
git init
git add .
git commit -m "Initial commit: GymDiet app"
```

2. **Crie um repositório GitHub:**
   - Acesse https://github.com/new
   - Crie um repositório chamado `gymdiet`
   - Não inicialize com README (já temos)

3. **Configure o remote e faça push:**
```bash
git remote add origin https://github.com/seu-usuario/gymdiet.git
git branch -M main
git push -u origin main
```

---

### **Etapa 2: Criar Database PostgreSQL no Render**

1. **Acesse [Render Dashboard](https://dashboard.render.com)**

2. **Crie uma nova PostgreSQL Database:**
   - Clique em "New +" → "PostgreSQL"
   - **Nome**: `gymdiet-db`
   - **Database**: `gymdb`
   - **User**: `gymuser`
   - **Region**: Selecione a mais próxima
   - **Plan**: Free tier ou pago conforme necessário
   - Clique em "Create Database"

3. **Aguarde a criação** (leva alguns minutos)
   - Copie a **Connection String** (você usará no próximo passo)

---

### **Etapa 3: Deploy da Aplicação Web**

1. **No Dashboard Render, crie um novo Web Service:**
   - Clique em "New +" → "Web Service"

2. **Conecte seu repositório GitHub:**
   - Selecione "Deploy an existing Git repository"
   - Clique em "Connect GitHub Account" se necessário
   - Selecione `seu-usuario/gymdiet`

3. **Configure as definições:**
   - **Name**: `gymdiet-app`
   - **Branch**: `main`
   - **Runtime**: `Docker`
   - **Region**: Mesma da database (importante!)
   - **Plan**: Free ou pago

4. **Configurar Variáveis de Ambiente:**
   - Clique em "Environment"
   - Adicione as variáveis:

   | Chave | Valor |
   |-------|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `DATABASE_URL` | *(Copiar da PostgreSQL)* |
   | `SESSION_SECRET` | *(Render gera automaticamente)* |
   | `APP_URL` | *(URL do seu app, ex: https://gymdiet.onrender.com)* |
   | `SMTP_HOST` | *(ex: smtp.gmail.com)* |
   | `SMTP_PORT` | *(ex: 587)* |
   | `SMTP_SECURE` | `false` *(use `true` para porta 465)* |
   | `SMTP_USER` | *(seu e-mail SMTP)* |
   | `SMTP_PASS` | *(sua senha de app SMTP)* |

5. **Clique em "Create Web Service"**
   - Render fará o build e deploy automaticamente

---

### **Etapa 4: Primeiro Deploy - Configurar Database**

1. **Após o deploy (pode levar 5-10 min), abra o Shell da aplicação:**
   - No Dashboard Render, vá para sua aplicação
   - Clique em "Shell"

2. **Execute as migrações do banco:**
```bash
npx prisma migrate deploy
npm run db:seed
```

3. **Pronto!** 🎉
   - Acesse a URL da sua aplicação (ex: `https://gymdiet-app.onrender.com`)
   - Login: `admin` / `admin123`

---

### **Etapa 5: Configurar Auto-Deploy**

O Render já faz auto-deploy quando você faz push para `main`, mas você pode verificar:

1. **No Dashboard da aplicação:**
   - Vá para "Settings"
   - Verifique "Auto-deploy" está ativado
   - Auto-deploy faz build a cada push em `main`

---

## 🔧 Gerenciando Sua Aplicação

### **Ver Logs**
```
Analytics & Logs → Logs
```

### **Reiniciar a Aplicação**
```
Dashboard → Manual Deploy → Restart
```

### **Atualizar Código**
```bash
git add .
git commit -m "Sua mensagem"
git push origin main
# Render fará o deploy automaticamente
```

### **Migrar Dados do Database**
```bash
1. No Shell:
npx prisma migrate deploy

2. Para adicionar dados:
npm run db:seed
```

---

## 🐛 Troubleshooting no Render

### **Erro: "Aplicação demora para iniciar"**
- Aumente o timeout no Render (Settings → Health Check)
- Verifique se DATABASE_URL está corrigida

### **Erro: "Cannot find module 'prisma'"**
- Execute no Shell: `npm install`
- Depois: `npx prisma generate`

### **Erro: "Database connection refused"**
- Verifique se o PostgreSQL database foi criado
- Confirme o DATABASE_URL está correto
- Aguarde alguns minutos para o database estar pronto

### **Erro: "SyntaxError: Unexpected token"**
- Verifique versão do Node (deve ser 20+)
- Limpe o build: Settings → Delete Web Service → Create novo

### **Página em branco / 500 erro**
- Verifique os Logs
- Se SESSION_SECRET não está definido, defina manualmente em Environment

---

## 🚀 Usando render.yaml (Alternative)

Se preferir usar o arquivo `render.yaml` para IaC:

```bash
# Faça login no Render CLI
npm i -g @render-oss/cli
render login

# Deploy usando o arquivo
render deploy --config render.yaml
```

---

## 📊 Monitoramento

### **Alertas e Notificações**
- Vá em Account Settings → Notifications
- Configure para receber alertas de deploy

### **Logs em Tempo Real**
- Dashboard → Analytics & Logs

### **Métricas**
- Dashboard → Metrics (CPU, Memory, Requests)

---

## 🔒 Segurança em Produção

✅ **Já configurado:**
- SESSION_SECRET gerado automaticamente
- HTTPS/SSL ativado automaticamente
- Node_ENV = production
- Cookies com httpOnly

⚠️ **Recomendado adicional:**
1. **Rate limiting** - Adicione na aplicação
2. **Backups do database** - Configure no Render database
3. **Monitoring** - Use Sentry para erros
4. **IP Whitelist** - Se necessário (plan pago)

---

## 💡 Dicas Úteis

### **Teste local antes de fazer push:**
```bash
docker-compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
# Acesse http://localhost:3000
```

### **Ver diferenças antes de push:**
```bash
git diff
git status
```

### **Reverter ao último deploy bem-sucedido:**
- Dashboard → Manual Deploy → Selecione versão anterior

---

## 📞 Suporte

- **Documentação Render**: https://render.com/docs
- **Prisma Help**: https://www.prisma.io/docs/
- **PostgreSQL**: https://www.postgresql.org/docs/

---

**Versão**: 1.0.0  
**Última atualização**: Abril 2026
