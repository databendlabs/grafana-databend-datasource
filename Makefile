preview:
	@mkdir -p dist
	@mkdir -p .databend/{data,logs}
	@mage build
	@pnpm install
	@pnpm build
	@docker compose up -d --build
	@echo "==> please visit http://localhost:3000 to preview"

reload:
	@mage build
	@pnpm build
	@docker compose restart
	@echo "==> refresh browser to see changes"

stop:
	@docker compose down
	@echo "==> stoppped preview"
