.PHONY: help install build test deploy destroy clean dev logs setup

# Default target
.DEFAULT_GOAL := help

## help: Show this help message
help:
	@echo "AWS Serverless Product Analytics"
	@echo ""
	@echo "Available targets:"
	@echo ""
	@sed -n 's/^##//p' ${MAKEFILE_LIST} | column -t -s ':' | sed -e 's/^/ /'
	@echo ""
	@echo "Environment Variables:"
	@echo "  AWS_REGION    AWS region (default: eu-central-1)"
	@echo "  STACK_NAME    CloudFormation stack name (default: ProductAnalyticsStack)"
	@echo ""

## setup: First-time setup - install all dependencies
setup:
	@echo "🚀 Setting up project..."
	@echo "Installing Node.js dependencies..."
	pnpm install
	@echo "Building Rust ingest API..."
	cd packages/ingestion && make install-deps
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Configure AWS credentials: aws configure"
	@echo "  2. Build everything: make build"
	@echo "  3. Deploy stack: make deploy"

## install: Install all dependencies
install:
	@echo "📦 Installing dependencies..."
	pnpm install
	@echo "✅ Dependencies installed!"

## build: Build all packages
build:
	@echo "🔨 Building all packages..."
	@echo "Building Rust packages..."
	cd packages/ingestion && make build
	@echo "Building TypeScript packages..."
	pnpm run build
	@echo "✅ Build complete!"

## build-rust: Build only Rust packages
build-rust:
	@echo "🔨 Building Rust packages..."
	cd packages/ingestion && make build
	@echo "✅ Rust build complete!"

## build-ts: Build only TypeScript packages
build-ts:
	@echo "🔨 Building TypeScript packages..."
	pnpm run build
	@echo "✅ TypeScript build complete!"

## test: Run all tests
test:
	@echo "🧪 Running tests..."
	cd packages/ingestion && make test
	pnpm run test
	@echo "✅ All tests passed!"

## deploy: Build and deploy entire stack to AWS
deploy: build
	@echo "🚀 Deploying to AWS..."
	@echo "Region: $(AWS_REGION)"
	@echo "Stack: $(STACK_NAME)"
	cd packages/infra && pnpm run deploy
	@echo "✅ Deployment complete!"
	@echo ""
	@echo "Check CloudFormation outputs for API endpoints"

## synth: Synthesize CloudFormation template
synth: build
	@echo "🔍 Synthesizing CloudFormation template..."
	cd packages/infra && pnpm run synth
	@echo "✅ Template generated in packages/infra/cdk.out/"

## diff: Show differences between deployed and local stack
diff: build
	@echo "🔍 Checking stack differences..."
	cd packages/infra && pnpm run diff

## clean: Clean all build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	cd packages/ingestion && make clean
	pnpm run build --force
	rm -rf packages/*/dist
	rm -rf packages/infra/cdk.out
	@echo "✅ Clean complete!"

## clean-all: Clean everything including node_modules
clean-all: clean
	@echo "🧹 Removing node_modules..."
	rm -rf node_modules
	rm -rf packages/*/node_modules
	@echo "✅ Deep clean complete!"

## dev: Start development mode (auto-rebuild)
dev:
	@echo "👀 Starting development mode..."
	pnpm run dev

## status: Show deployment status
status:
	@echo "📊 Stack Status:"
	@aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--region $(AWS_REGION) \
		--query 'Stacks[0].[StackStatus,LastUpdatedTime]' \
		--output table 2>/dev/null || echo "Stack not deployed"
	@echo ""
	@echo "📊 Outputs:"
	@aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--region $(AWS_REGION) \
		--query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
		--output table 2>/dev/null || echo "No outputs available"

## endpoints: Show API endpoints
endpoints:
	@echo "🌐 API Endpoints:"
	@aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--region $(AWS_REGION) \
		--query 'Stacks[0].Outputs[?contains(OutputKey, `Endpoint`)][OutputKey,OutputValue]' \
		--output table 2>/dev/null || echo "Stack not deployed"

## test-endpoint: Test deployed ingest API endpoint
test-endpoint:
	@echo "🧪 Testing ingest API endpoint..."
	@ENDPOINT=$$(aws cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--region $(AWS_REGION) \
		--query 'Stacks[0].Outputs[?OutputKey==`ViewEndpoint`].OutputValue' \
		--output text 2>/dev/null); \
	if [ -z "$$ENDPOINT" ]; then \
		echo "❌ Endpoint not found. Is the stack deployed?"; \
		exit 1; \
	fi; \
	echo "Endpoint: $$ENDPOINT"; \
	curl -X POST $$ENDPOINT \
		-H "Content-Type: application/json" \
		-d @packages/ingestion/example-events.json; \
	echo ""; \
	echo "✅ Test complete!"

## fmt: Format all code
fmt:
	@echo "🎨 Formatting code..."
	cd packages/ingestion && make fmt
	@echo "✅ Code formatted!"

## lint: Lint all code
lint:
	@echo "🔍 Linting code..."
	cd packages/ingestion && make lint
	@echo "✅ Linting complete!"


	@echo "🏥 Running health checks..."
	@echo ""
	@echo "Checking Node.js..."
	@node --version >/dev/null 2>&1 && echo "✅ Node.js installed" || echo "❌ Node.js not found"
	@echo ""
	@echo "Checking pnpm..."
	@pnpm --version >/dev/null 2>&1 && echo "✅ pnpm installed" || echo "❌ pnpm not found"
	@echo ""
	@echo "Checking Rust..."
	@rustc --version >/dev/null 2>&1 && echo "✅ Rust installed" || echo "❌ Rust not found"
	@echo ""
	@echo "Checking cargo-lambda..."
	@cargo lambda --version >/dev/null 2>&1 && echo "✅ cargo-lambda installed" || echo "❌ cargo-lambda not found"
	@echo ""
	@echo "Checking AWS CLI..."
	@aws --version >/dev/null 2>&1 && echo "✅ AWS CLI installed" || echo "❌ AWS CLI not found"
	@echo ""
	@echo "Checking AWS credentials..."
	@aws sts get-caller-identity >/dev/null 2>&1 && echo "✅ AWS credentials configured" || echo "❌ AWS credentials not found"
	@echo ""
	@echo "Checking CDK bootstrap..."
	@aws cloudformation describe-stacks --stack-name CDKToolkit --region $(AWS_REGION) >/dev/null 2>&1 && echo "✅ CDK bootstrapped" || echo "⚠️  CDK not bootstrapped (run: make bootstrap-aws)"
	@echo ""
