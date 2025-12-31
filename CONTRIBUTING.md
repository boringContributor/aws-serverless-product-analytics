# Contributing to AWS Serverless Product Analytics

Thank you for your interest in contributing! This project is open-source and welcomes contributions from the community.

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, AWS region, etc.)

### Suggesting Features

Feature suggestions are welcome! Please open an issue with:
- Clear description of the feature
- Use case and problem it solves
- Proposed implementation (if you have ideas)

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write or update tests if applicable
5. Update documentation as needed
6. Commit with clear messages (`git commit -m 'Add amazing feature'`)
7. Push to your fork (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/aws-serverless-product-analytics.git
cd aws-serverless-product-analytics
```

2. Install dependencies:
```bash
pnpm install
```

3. Build all packages:
```bash
pnpm build
```

4. Run tests (when available):
```bash
pnpm test
```

## Project Structure

```
packages/
├── cdk/               # Infrastructure (AWS CDK)
├── ingest-api/        # Event ingestion Lambda
├── event-processor/   # Event processing Lambda
└── tracking-script/   # Client-side tracking library
```

## Code Style

- TypeScript for all code
- Use Prettier for formatting (configured in project)
- Write clear, self-documenting code
- Add comments for complex logic or architectural decisions
- Follow existing patterns in the codebase

## Testing

- Write unit tests for new features
- Test infrastructure changes in a sandbox AWS account
- Ensure all tests pass before submitting PR

## Documentation

- Update README.md if you change functionality
- Update ARCHITECTURE.md for architectural changes
- Add JSDoc comments for public APIs
- Include code examples for new features

## Commit Messages

Use clear, descriptive commit messages:

- `feat: add user authentication`
- `fix: correct event timestamp parsing`
- `docs: update deployment guide`
- `refactor: simplify storage interface`
- `test: add tests for ingest API`

## Review Process

1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, a maintainer will merge

## Areas for Contribution

Looking for ideas? Here are some areas that need help:

- [ ] Add comprehensive test suite
- [ ] Add CI/CD pipeline (GitHub Actions)
- [ ] Create query API for reading events
- [ ] Build simple dashboard UI
- [ ] Add authentication/authorization
- [ ] Create mobile SDKs (iOS, Android)
- [ ] Add data export features
- [ ] Improve error handling and logging
- [ ] Add CloudFormation alarms
- [ ] Create alternative storage backends (ClickHouse, S3)
- [ ] Performance optimizations
- [ ] Documentation improvements

## Code of Conduct

Be respectful and constructive. This is a welcoming community.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
