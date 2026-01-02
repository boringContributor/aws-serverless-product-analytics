use lambda_http::{Body, Error, Request, Response};
use std::sync::Arc;

use crate::models::{CompressedEvent, IngestEventPayload, EventContext};
use crate::shared::{create_error_response, create_text_response, process_events, AppState};

/// JWT Claims structure
#[derive(Debug, serde::Deserialize)]
struct JwtClaims {
    #[serde(rename = "userId")]
    user_id: Option<String>,
    #[serde(rename = "projectId")]
    project_id: Option<String>,
    // Add other JWT fields as needed
}

/// Extracts JWT token from Authorization header and decodes it
/// Returns (project_id, user_id)
fn extract_jwt_info(request: &Request) -> Result<(String, Option<String>), String> {
    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| "Missing Authorization header".to_string())?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| "Invalid Authorization header format".to_string())?;

    // For now, we'll just decode the JWT payload without verification
    // In production, you should verify the JWT signature
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT format".to_string());
    }

    // Decode the payload (second part)
    let payload = parts[1];
    use base64::Engine;
    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .map_err(|_| "Failed to decode JWT payload".to_string())?;

    let claims: JwtClaims = serde_json::from_slice(&decoded)
        .map_err(|_| "Failed to parse JWT claims".to_string())?;

    // Use default project_id if not provided in JWT
    let project_id = claims
        .project_id
        .unwrap_or_else(|| "default".to_string());

    Ok((project_id, claims.user_id))
}

/// Enriches the event with server-side metadata
fn enrich_event(mut payload: IngestEventPayload, request: &Request) -> IngestEventPayload {
    let now = chrono::Utc::now().timestamp_millis();

    // Ensure timestamp is set
    if payload.timestamp == 0 {
        payload.timestamp = now;
    }

    // Enrich context with server-side data
    let mut context = payload.context.unwrap_or_else(|| EventContext {
        page: None,
        user_agent: None,
        locale: None,
        screen: None,
        ip: None,
        received_at: None,
        extra: std::collections::HashMap::new(),
    });

    // Add IP address from request context
    if context.ip.is_none() {
        if let Some(headers) = request.headers().get("x-forwarded-for") {
            context.ip = headers.to_str().ok().map(|s| s.split(',').next().unwrap_or("").trim().to_string());
        }
    }

    // Add user agent if not present
    if context.user_agent.is_none() {
        if let Some(ua) = request.headers().get("user-agent") {
            context.user_agent = ua.to_str().ok().map(String::from);
        }
    }

    // Set received timestamp
    context.received_at = Some(now);

    payload.context = Some(context);
    payload
}

/// Handler for POST /view (compressed format)
pub async fn handle_page_view(
    body: &str,
    request: &Request,
    state: Arc<AppState>,
) -> Result<Response<Body>, Error> {
    // Extract project_id and user_id from JWT
    let (project_id, user_id) = match extract_jwt_info(request) {
        Ok(info) => info,
        Err(e) => {
            return Ok(create_error_response(401, &format!("Unauthorized: {}", e)));
        }
    };

    // Parse compressed event
    let compressed: CompressedEvent = match serde_json::from_str(body) {
        Ok(event) => event,
        Err(e) => {
            tracing::error!("Failed to parse JSON: {} | Body: {}", e, body);
            return Ok(create_error_response(400, &format!("Invalid JSON in request body: {}", e)));
        }
    };

    // Validate compressed event
    if let Err(e) = compressed.validate() {
        return Ok(create_error_response(400, &e));
    }

    let normalized = compressed.normalize(project_id, user_id);
    let enriched = enrich_event(normalized, request);
    process_events(vec![enriched], state).await?;

    Ok(create_text_response(202, "ACCEPTED"))
}

/// Handler for POST /event (compressed format)
pub async fn handle_track(
    body: &str,
    request: &Request,
    state: Arc<AppState>,
) -> Result<Response<Body>, Error> {
    // Extract project_id and user_id from JWT
    let (project_id, user_id) = match extract_jwt_info(request) {
        Ok(info) => info,
        Err(e) => {
            return Ok(create_error_response(401, &format!("Unauthorized: {}", e)));
        }
    };

    // Parse compressed event
    let compressed: CompressedEvent = match serde_json::from_str(body) {
        Ok(event) => event,
        Err(e) => {
            tracing::error!("Failed to parse JSON: {} | Body: {}", e, body);
            return Ok(create_error_response(400, &format!("Invalid JSON in request body: {}", e)));
        }
    };

    // Validate compressed event
    if let Err(e) = compressed.validate() {
        return Ok(create_error_response(400, &e));
    }

    let normalized = compressed.normalize(project_id, user_id);
    let enriched = enrich_event(normalized, request);
    process_events(vec![enriched], state).await?;

    Ok(create_text_response(202, "ACCEPTED"))
}
