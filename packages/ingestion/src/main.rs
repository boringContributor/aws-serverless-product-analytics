use lambda_http::{run, service_fn, Body, Error, Request, Response};
use std::sync::Arc;
use aws_sdk_kinesis::Client as KinesisClient;

mod models;
mod handlers;
mod shared;

use shared::{AppState, create_response, create_error_response};

/// Main Lambda handler
async fn function_handler(event: Request, state: Arc<AppState>) -> Result<Response<Body>, Error> {
    // Handle OPTIONS for CORS preflight
    if event.method() == "OPTIONS" {
        return Ok(create_response(200, serde_json::json!({})));
    }

    // Extract path
    let path = event.uri().path();

    // Parse request body
    let body = event.body();
    let body_str = match body {
        Body::Text(s) => {
            tracing::debug!("Received text body: {}", s);
            s
        }
        Body::Binary(b) => {
            let decoded = std::str::from_utf8(b)?;
            tracing::debug!("Received binary body (decoded): {}", decoded);
            decoded
        }
        Body::Empty => {
            tracing::warn!("Received empty body");
            return Ok(create_error_response(400, "Missing request body"));
        }
    };

    // Route based on path
    match path {
        p if p.ends_with("/view") => {
            handlers::handle_page_view(body_str, &event, state.clone()).await
        }
        p if p.ends_with("/event") => {
            handlers::handle_track(body_str, &event, state.clone()).await
        }
        _ => Ok(create_error_response(404, "Not found")),
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"))
        )
        .json()
        .init();

    // Load AWS configuration
    let config = aws_config::load_from_env().await;
    let kinesis_client = KinesisClient::new(&config);

    // Get environment variables
    let stream_name = std::env::var("STREAM_NAME")
        .expect("STREAM_NAME environment variable not set");

    tracing::info!("Initialized with Kinesis stream: {}", stream_name);

    let state = Arc::new(AppState {
        kinesis_client,
        stream_name,
    });

    run(service_fn(move |event| {
        let state = state.clone();
        async move { function_handler(event, state).await }
    }))
    .await
}
