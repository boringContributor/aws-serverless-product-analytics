use lambda_http::{Body, Response};
use std::sync::Arc;
use aws_sdk_kinesis::Client as KinesisClient;
use crate::models::IngestEventPayload;

/// Application state shared across Lambda invocations
#[derive(Clone)]
pub struct AppState {
    pub kinesis_client: KinesisClient,
    pub stream_name: String,
}

/// CORS headers for JSON responses
pub const JSON_RESPONSE_HEADERS: [(&str, &str); 3] = [
    ("Content-Type", "application/json"),
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Headers", "Content-Type, X-API-Key"),
];

/// CORS headers for text responses
pub const TEXT_RESPONSE_HEADERS: [(&str, &str); 3] = [
    ("Content-Type", "text/plain"),
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Headers", "Content-Type, X-API-Key"),
];

/// Creates a success response with JSON body
pub fn create_response(status_code: u16, body: serde_json::Value) -> Response<Body> {
    let mut response = Response::builder()
        .status(status_code);

    for (key, value) in JSON_RESPONSE_HEADERS.iter() {
        response = response.header(*key, *value);
    }

    response
        .body(Body::Text(body.to_string()))
        .unwrap()
}

/// Creates a simple text response
pub fn create_text_response(status_code: u16, body: &str) -> Response<Body> {
    let mut response = Response::builder()
        .status(status_code);

    for (key, value) in TEXT_RESPONSE_HEADERS.iter() {
        response = response.header(*key, *value);
    }

    response
        .body(Body::Text(body.to_string()))
        .unwrap()
}

/// Creates an error response
pub fn create_error_response(status_code: u16, message: &str) -> Response<Body> {
    create_response(
        status_code,
        serde_json::json!({
            "error": message
        }),
    )
}

/// Sends events to Kinesis Stream for fan-out processing
/// Kinesis consumers will handle:
/// 1. Firehose → S3 with native Parquet conversion
/// 2. Lambda → ClickHouse for real-time analytics
/// 3. Lambda → DynamoDB for fast key-value queries
pub async fn process_events(
    events: Vec<IngestEventPayload>,
    state: Arc<AppState>,
) -> Result<(), lambda_http::Error> {
    if events.is_empty() {
        return Ok(());
    }

    tracing::info!("Sending {} events to Kinesis Stream", events.len());

    // Send events to Kinesis Stream
    // Use projectId as partition key for even distribution
    for event in &events {
        let record_data = serde_json::to_vec(event)?;

        state.kinesis_client
            .put_record()
            .stream_name(&state.stream_name)
            .partition_key(&event.project_id) // Ensures events from same project go to same shard
            .data(aws_sdk_kinesis::primitives::Blob::new(record_data))
            .send()
            .await?;
    }

    tracing::info!("Successfully sent {} events to Kinesis Stream", events.len());
    Ok(())
}
