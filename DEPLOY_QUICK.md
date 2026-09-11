# GymDiet - Guia Rápido de Deploy

## ⚡ Quick Start

### Local com Docker:
```bash
docker-compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### No Render:
1. Push código para GitHub
2. Criar PostgreSQL database no Render
3. Criar Web Service Docker
4. Configurar DATABASE_URL e SESSION_SECRET
5. Deploy automático!

## 📋 Checklist de Deploy

- [ ] Código feito push para GitHub (`main` branch)
- [ ] PostgreSQL database criado no Render
- [ ] Web Service criado no Render
- [ ] DATABASE_URL configurada
- [ ] SESSION_SECRET configurada
- [ ] Build concluído (verificar Logs)
- [ ] Aplicação rodando (verificar Logs e URL)
- [ ] Testes funcionando (login com admin/admin123)
- [ ] Migrações do banco rodadas
- [ ] Seed data carregado

## 🔗 Links Importantes

- Render Dashboard: https://dashboard.render.com
- GitHub: https://github.com
- Documentação Render: https://render.com/docs
- Prisma Docs: https://www.prisma.io/docs/

## 📞 Comandos Úteis no Shell do Render

```bash
# Verificar versão do Node
node --version

# Executar migrações
npx prisma migrate deploy

# Carregar dados de exemplo
npm run db:seed

# Ver status do banco
npx prisma db execute --stdin < queries.sql

# Verificar logs
npm run dev (dentro do Shell)
```

---

**Documentação completa**: Veja [DEPLOYMENT.md](./DEPLOYMENT.md)
