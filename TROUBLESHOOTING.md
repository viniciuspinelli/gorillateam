# GymDiet - Troubleshooting Guide para Render

## 🔴 Problemas Comuns e Soluções

### **1. Build Falha com "Cannot read property 'createServerProfile' of undefined"**

**Problema**: Render não consegue instalar dependências corretamente

**Solução**:
```bash
# 1. Acesse o Shell do Render
# 2. Execute:
npm ci --force
npx prisma generate
npm run db:migrate
```

---

### **2. Erro: "connect ECONNREFUSED 127.0.0.1:5432"**

**Problema**: Aplicação não consegue conectar ao banco de dados

**Verificação**:
- [ ] DATABASE_URL está correto?
- [ ] Database PostgreSQL foi criado?
- [ ] Estão na mesma **região** do Render?

**Solução**:
```bash
# No Shell do Render:
echo $DATABASE_URL  # Verificar se está setada

# Se estiver vazia:
# 1. Vá para Settings
# 2. Adicione DATABASE_URL (copiar da database PostgreSQL)
# 3. Execute "Redeploy"
```

---

### **3. Erro: "Error: The `prisma` command does not exist"**

**Problema**: Prisma não foi instalado globalmente

**Solução**:
```bash
# 1. Acesse o Shell
# 2. Execute:
npm install --save-dev prisma
npm run db:migrate
```

---

### **4. Página em Branco (HTTP 500)**

**Problema**: Erro genérico (verifique os logs)

**Verificação**:
1. Clique em **Analytics & Logs** no Dashboard
2. Procure por linhas com `Error` ou `Cannot find module`
3. Se vir erro de require, execute no Shell:
   ```bash
   npm ci
   npx prisma generate
   npm start
   ```

---

### **5. Erro: "listen EADDRINUSE :::3000"**

**Problema**: Porta 3000 já está em uso (raro no Render)

**Solução**:
- [ ] Verifique se PORT está setado em Environment
- [ ] Redeploy a aplicação

---

### **6. Erro: "session table not found"**

**Problema**: Banco de dados não foi executado com as migrações

**Solução**:
```bash
# No Shell do Render:
npm run db:migrate

# Se ainda falhar:
npx prisma db push --skip-generate --force-reset

# Se for primeira vez, carregue os dados:
npm run db:seed
```

---

### **7. Login não funciona (sempre redireciona)**

**Problema**: Session não está sendo armazenada

**Verificação**:
- [ ] SESSION_SECRET está definido?
- [ ] Database PostgreSQL está acessível?
- [ ] Connect-pg-simple consegue criar tabela de sessões?

**Solução**:
```bash
# No Shell:
npx prisma db push  # Recria todas as tabelas
npm run db:seed     # Recarrega dados

# Tente fazer login novamente
```

---

### **8. Aplicação inicia mas fica pendente (timeouts)**

**Problema**: Health check falhando

**Verificação**:
```bash
# No Shell:
curl http://localhost:3000
```

**Solução**:
- Aumente timeout do health check em Settings
- Verifique se app.js pode iniciar:
  ```bash
  npm start
  ```

---

### **9. Erro: "FATAL: remaining connection slots are for non-replication superuser connections"**

**Problema**: Database chegou ao limite de conexões

**Solução**:
- Aumente o plan do database (paid tier)
- Ou reduza maxconnections em Environment

---

### **10. Seed data não está siendo carregado**

**Problema**: npm run db:seed falhou silenciosamente

**Verificação no Shell**:
```bash
npm run db:seed
# Se der erro, veja a mensagem completa
```

**Se a tabela User já existir**:
```bash
npx prisma db push --force-reset  # ⚠️ Deleta dados!
npm run db:seed
```

---

## 📋 Checklist de Debug

Use isso para diagnosticar problemas:

```bash
# 1. Versão do Node
node --version         # Deve ser 20+

# 2. Dependências
npm list prisma
npm list express

# 3. Banco de dados
echo $DATABASE_URL     # Não deve estar vazio

# 4. Variáveis de ambiente
env | grep SESSION_SECRET

# 5. Conectar ao banco diretamente
psql $DATABASE_URL -c "SELECT 1"

# 6. Ver estado das tabelas
npx prisma studio

# 7. Executar migrations
npx prisma migrate status
npx prisma migrate resolve

# 8. Logs da aplicação
npm start              # Ver se inicia sem erros
```

---

## 🔧 Resetar e Recomeçar

**Se tudo falhar, faça um reset completo:**

```bash
# ⚠️ Isso DELETA todos os dados!

# No Shell do Render:

# 1. Resetar banco
npx prisma migrate reset --force

# 2. Recriar schema
npx prisma db push

# 3. Carregar dados de exemplo
npm run db:seed

# 4. Redeploy
# Voltar ao Dashboard e clique em "Redeploy"
```

---

## 📞 Recursos Adicionais

| Problema | Link |
|----------|------|
| Prisma Errors | https://www.prisma.io/docs/reference/error-reference |
| PostgreSQL Issues | https://www.postgresql.org/docs/15/errcodes-appendix.html |
| Render Status | https://status.render.com |
| GitHub Issues | https://github.com/gymdiet/issues |

---

## 📝 Coletando Informações para Suporte

Se precisar de ajuda, forneça:

1. **Erro completo** (copiar do Logs)
2. **Output do comando**:
   ```bash
   node --version
   npm --version
   npx prisma --version
   ```
3. **Environment variables**:
   ```bash
   env | grep -E 'DATABASE_URL|NODE_ENV|PORT'
   ```
4. **Status do deploy**:
   - Screenshot do Build Log
   - Screenshot dos Logs

---

**Última atualização**: Abril 2026
