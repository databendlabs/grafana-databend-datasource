preview:
	@mkdir -p dist
	@mage build
	@yarn install
	@yarn build
	@docker compose up -d --build
	@echo "==> please visit http://localhost:3000 to preview"

reload:
	@mage build
	@yarn build
	@docker compose restart
	@echo "==> refresh browser to see changes"

stop:
	@docker compose down
	@echo "==> stoppped preview"
