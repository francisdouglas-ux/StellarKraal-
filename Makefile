.PHONY: install dev build test lint docker-up docker-down clean help

## install: Install dependencies for frontend and backend
install:
	cd backend && npm ci
	cd frontend && npm ci

## dev: Start backend and frontend in development mode
dev:
	cd backend && npm run dev &
	cd frontend && npm run dev

## build: Build backend and frontend for production
build:
	cd backend && npm run build
	cd frontend && npm run build

## test: Run all tests (contract, backend, frontend)
test:
	npm run test:contract
	cd backend && npm test
	cd frontend && npm test

## lint: Run ESLint and Prettier checks on backend and frontend
lint:
	cd backend && npm run lint
	cd frontend && npm run lint

## docker-up: Start all services with Docker Compose
docker-up:
	docker compose up --build -d

## docker-down: Stop and remove all Docker Compose services
docker-down:
	docker compose down

## clean: Remove build artifacts and node_modules
clean:
	rm -rf backend/dist backend/node_modules
	rm -rf frontend/.next frontend/node_modules

## help: Print this help message
help:
	@grep -E '^## ' Makefile | sed 's/## //' | column -t -s ':'
