.PHONY: up down build logs migrate migrate-new seed test-backend test-frontend shell

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

migrate:
	docker compose exec backend alembic upgrade head

migrate-new:
	@read -p "Migration message: " msg; \
	docker compose exec backend alembic revision --autogenerate -m "$$msg"

seed:
	docker compose exec backend python -m app.utils.seed

test-backend:
	docker compose exec backend pytest --cov=app --cov-report=term-missing

test-frontend:
	docker compose exec frontend npm test

shell:
	docker compose exec backend bash
