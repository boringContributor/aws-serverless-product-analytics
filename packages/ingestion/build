#!/bin/bash
set -e

echo "Building Rust Lambda for AWS Lambda (ARM64)..."

# Install cargo-lambda if not already installed
if ! command -v cargo-lambda &> /dev/null; then
    echo "Installing cargo-lambda..."
    pip3 install cargo-lambda
fi

# Build for AWS Lambda
cargo lambda build --release --arm64

echo "Build complete! Binary location:"
echo "target/lambda/ingest-api/bootstrap"
