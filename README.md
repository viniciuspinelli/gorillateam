# GymDiet - Gerenciador de Treinos e Dieta 💪

Uma aplicação web full-stack para rastreamento de treinos, planejamento de dieta e gerenciamento de listas de compras.

## 🚀 Tecnologias

- **Backend**: Node.js + Express.js
- **Banco de Dados**: PostgreSQL 15 + Prisma ORM
- **Frontend**: EJS + Vanilla JavaScript + CSS
- **Autenticação**: bcrypt + express-session
- **Containerização**: Docker + Docker Compose
- **Hospedagem**: Render.com

## 📋 Funcionalidades

### 🏋️ Módulo de Treinos
- Criar e gerenciar planos de treino
- Iniciar sessões de treino com timer em tempo real
- Marcar exercícios como concluídos
- Rastrear histórico de treinos
- Calcular duração e progresso

### 🥗 Módulo de Dieta
- Criar múltiplos planos de refeições
- Adicionar alimentos com macronutrientes
- Cálculo automático de calorias e macros
- Visualizar resumo nutricional diário
- Alternar entre planos ativos

### 🛒 Menu de Compras
- Criar listas de compras categorizado
- Marcar itens como comprados
- Importar alimentos do plano de dieta ativo
- Sincronização em tempo real com AJAX

### 👤 Autenticação
- Login de usuário único com bcrypt
- Sessões persistidas em PostgreSQL
- Proteção CSRF em formulários
- Logout seguro

## 🏗️ Estrutura do Projeto

```
GymDiet/
├── prisma/
│   ├── schema.prisma        # Schema do banco de dados
│   └── seed.js              # Dados iniciais
├── src/
│   ├── controllers/         # Lógica de negócio
│   ├── routes/              # Definições de rotas
│   ├── middleware/          # Middleware customizado
│   ├── views/               # Templates EJS
│   └── public/              # Arquivos estáticos (CSS, JS)
├── app.js                   # Arquivo principal
├── package.json
├── Dockerfile
├── docker-compose.yml
└── render.yaml              # Configuração de deployment
```

## 🔧 Configuração Local

### Pré-requisitos
- Node.js v20+
- Docker + Docker Compose
- ou PostgreSQL 15 instalado localmente

### Instalação

1. **Clone o repositório**
```bash
cd GymDiet
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o arquivo .env**
```bash
cp .env.example .env
```

Variáveis importantes para imagens de exercícios (local-first):
```env
# local (padrão) | s3 | r2
STORAGE_PROVIDER=local

# Caminho local para arquivos de imagem
LOCAL_STORAGE_PATH=D:\\gymdietimages

# Rota pública para servir imagens locais
LOCAL_STORAGE_PUBLIC_BASE_PATH=/media

# Limite por upload (2MB)
MAX_EXERCISE_IMAGE_SIZE_BYTES=2097152
```

4. **Com Docker Compose (recomendado)**
```bash
docker-compose up -d
```

5. **Sem Docker - configure manualmente**
```bash
# Crie um banco de dados PostgreSQL
createdb -U gymuser -W gymdb

# Atualize DATABASE_URL em .env para:
# DATABASE_URL=postgresql://gymuser:gympass@localhost:5432/gymdb

# Execute as migrações e seed
npm run db:migrate
npm run db:seed
```

6. **Inicie o servidor**
```bash
npm run dev
```

A aplicação estará disponível em http://localhost:3000

### 🔐 Credenciais Padrão
- **Usuário**: admin
- **Senha**: admin123

## 📊 Estrutura do Banco de Dados

### Módulo de Treinos
- `User` - Usuários do sistema
- `WorkoutPlan` - Planos de treino
- `Exercise` - Exercícios em um plano
- `WorkoutExerciseImage` - Imagens de referência de exercícios
- `WorkoutSession` - Sessão de treino iniciada
- `SessionExercise` - Exercício na sessão

### Módulo de Dieta
- `MealPlan` - Plano de refeições
- `Meal` - Refeição no plano
- `MealFood` - Alimento na refeição

### Módulo de Compras
- `ShoppingList` - Lista de compras
- `ShoppingItem` - Item na lista

## 🎨 Design & UX

- **Dark Mode**: Interface com tema escuro por padrão
- **Cor Primária**: Verde (#22c55e)
- **Responsivo**: Mobile-first adaptation
- **Navegação**: Sidebar desktop + Bottom navbar mobile
- **Toast Notifications**: Feedback de ações
- **Modal Dialogs**: Confirmações de ações destrutivas

## 🚀 Deployment no Render

1. **Conecte seu repositório GitHub ao Render**

2. **Crie um novo Web Service**:
   - Deploy automático do repositório
   - Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
   - Start command: `npm start`

3. **Adicione um banco de dados PostgreSQL gerenciado**:
   - Conecte automaticamente via `render.yaml`
   - Environment: `DATABASE_URL` será injetada automaticamente

4. **Configure variáveis de ambiente**:
   - `SESSION_SECRET`: Será gerada automaticamente
   - `NODE_ENV`: `production`

## 📚 API Endpoints

### Autenticação
- `GET /auth/login` - Página de login
- `POST /auth/login` - Fazer login
- `GET /auth/logout` - Fazer logout

### Treinos
- `GET /workouts` - Listar planos
- `POST /workouts/:id/start` - Iniciar sessão
- `GET /workouts/session/:sessionId` - Página de treino ativo
- `PATCH /workouts/session/:sessionId/exercise/:exerciseId/complete` - Marcar exercício
- `POST /workouts/session/:sessionId/complete` - Finalizar treino
- `GET /workouts/history` - Histórico

### Dieta
- `GET /diet` - Visualizar dieta ativa
- `POST /diet/plans` - Criar plano
- `POST /diet/plans/:planId/activate` - Ativar plano
- `POST /diet/meals` - Adicionar refeição
- `DELETE /diet/meals/:mealId` - Remover refeição
- `POST /diet/meals/:mealId/foods` - Adicionar alimento
- `DELETE /diet/foods/:foodId` - Remover alimento

### Compras
- `GET /shopping` - Listar compras
- `POST /shopping/lists` - Criar nova lista
- `POST /shopping/lists/:listId/items` - Adicionar item
- `PATCH /shopping/items/:itemId/toggle` - Marcar item
- `DELETE /shopping/items/:itemId` - Remover item
- `DELETE /shopping/lists/:listId/checked` - Limpar marcados
- `POST /shopping/import-from-diet` - Importar da dieta

## 🔒 Segurança

- **Autenticação**: bcrypt para hash de senhas
- **Sessões**: Armazenadas no PostgreSQL
- **CSRF Protection**: Middleware csurf
- **Validação**: express-validator em todas as rotas
- **Sanitização**: EJS escapa XSS por padrão
- **HTTPS**: Recomendado em produção

## 📝 Logging

- **Morgan**: Logging HTTP em desenvolvimento
- **Console**: Logs de erro e operações importantes
- **Arquivo**: Considerado para produção

## 🔄 Desenvolvimento

### Comandos Úteis
```bash
# Desenvolvimento com auto-reload
npm run dev

# Migrations do banco
npm run db:migrate

# Seed de dados
npm run db:seed

# Visualizar banco com Prisma Studio
npm run db:studio

# Build para produção
npm run build

# Start em produção
npm start
```

## 🐛 Troubleshooting

**Erro de conexão com banco de dados**
- Verifique se PostgreSQL está rodando
- Confirme DATABASE_URL em .env
- Para Docker: `docker-compose logs db`

**Erro de session table not found**
- Execute `npm run db:migrate`
- Connect-pg-simple criará a tabela automaticamente

**Porta 3000 já em uso**
- Altere PORT em .env
- Ou mate o processo: `lsof -i :3000` e `kill -9 <PID>`

## 📖 Recursos Adicionais

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Express.js Guide](https://expressjs.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

## 📄 Licença

MIT

## 👨‍💻 Desenvolvedor

Criado com ❤️ para gerenciamento de fitness e bem-estar.

---

**Versão**: 1.0.0  
**Última atualização**: Abril 2026
