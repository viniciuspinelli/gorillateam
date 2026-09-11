.PHONY: help install dev test build push deploy logs shell clean

help: ## Mostrar comandos disponíveis
	@echo "🏋️  GymDiet - Comandos Disponíveis"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Instalar dependências
	npm install
	npx prisma generate

dev: ## Iniciar desenvolvimento local
	docker-compose up -d
	npm run dev

dev-stop: ## Parar desenvolvimento local
	docker-compose down

dev-logs: ## Ver logs do Docker
	docker-compose logs -f app

migrate: ## Executar migrações do banco
	npx prisma migrate deploy

seed: ## Carregar dados de exemplo
	npm run db:seed

studio: ## Abrir Prisma Studio (visual do banco)
	npx prisma studio

test: ## Executar testes (estrutura)
	@echo "✅ Verificando integridade dos arquivos..."
	@test -f app.js && test -f package.json && test -f prisma/schema.prisma
	@echo "✅ Todos os arquivos críticos existem"

build: ## Build da imagem Docker
	docker build -t gymdiet:latest .
	docker image inspect gymdiet:latest

push: ## Push para GitHub (assumindo git configurado)
	git add .
	git commit -m "Update GymDiet"
	git push origin main

deploy: ## Deploy para Render (depois de push)
	@echo "🚀 Deploy iniciado no Render"
	@echo "Acesse: https://dashboard.render.com"
	@echo "Seu app deve estar em: https://gymdiet-app.onrender.com"

logs: ## Ver logs no Render (via shell remoto)
	@echo "Abra o Shell no Render Dashboard e veja os logs"

shell: ## Abrir shell no Render
	@echo "Clique em 'Shell' no seu Web Service no Render Dashboard"

clean: ## Limpar arquivos locais
	rm -rf node_modules
	rm -rf .next
	rm -f .env

reset: ## RESET COMPLETO (apaga tudo!)
	@echo "⚠️  Isso vai resetar TUDO!"
	docker-compose down -v
	rm -rf node_modules
	rm -f .env
	@echo "✅ Reset completo. Execute: make install && make dev"

# Shorthand
i: install
d: dev
m: migrate
s: seed
b: build
