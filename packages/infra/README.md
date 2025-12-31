# CDK Infrastructure

AWS CDK stack for deploying the serverless product analytics platform.

## Architecture

The stack is organized into **bounded contexts** using CDK constructs:

```typescript
new AnalyticsStack(app, 'AnalyticsStack', {
  ingest: { enabled: true },  // Hot path (write-heavy, public)
  query: { enabled: true },   // Cold path (read-heavy, authenticated)
});
```

### Constructs

**`AnalyticsStorage`** (`lib/storage.ts`)
- DynamoDB events table
- SQS ingest queue + DLQ
- Shared foundation for both APIs

**`IngestApi`** (`lib/ingest-api.ts`)
- Ingestion API Gateway (public)
- Ingest Lambda (validates, queues)
- Processor Lambda (writes to DynamoDB)
- High throughput (1000 rps)

**`QueryApi`** (`lib/query-api.ts`)
- Query API Gateway (authenticated)
- Query Lambda (reads, aggregates)
- Lower throughput (100 rps)
- Read-only access

### Benefits

1. **Single stack deployment** - Simple: `pnpm deploy`
2. **Clear separation** - Each construct owns its bounded context
3. **Easy to test** - Can disable ingest or query for testing
4. **Future-proof** - Can split into separate stacks later if needed

## Stack Components

### Resources Created

1. **DynamoDB Table** (`product-analytics-events`)
   - On-demand billing
   - Point-in-time recovery enabled
   - GSI for event type queries
   - Retention: RETAIN (won't delete on stack deletion)

2. **SQS Queue** (`product-analytics-events`)
   - Standard queue (not FIFO)
   - 14-day retention
   - Dead letter queue for failed messages
   - Visibility timeout: 300s

3. **Lambda Functions**
   - Ingest Lambda (event ingestion)
   - Processor Lambda (event processing)

4. **API Gateway** (REST API)
   - Public endpoint
   - CORS enabled
   - Throttling: 1000 rps (burst 2000)
   - Endpoints: POST /events, GET /health

5. **IAM Roles & Permissions**
   - Ingest Lambda → SQS:SendMessage
   - Processor Lambda → SQS:ReceiveMessage, DynamoDB:PutItem

## Commands

### Deploy

```bash
pnpm deploy
```

Builds all Lambda functions and deploys the stack.

### Synthesize

```bash
pnpm synth
```

Generates CloudFormation template without deploying.

### Diff

```bash
pnpm diff
```

Shows changes between deployed and local stack.

### Destroy

```bash
pnpm destroy
```

Deletes all resources except DynamoDB table (protected by RETAIN policy).

## Outputs

After deployment, you'll get:

- `ApiEndpoint`: Base API URL
- `IngestEndpoint`: Event ingestion endpoint (POST /events)
- `EventsTableName`: DynamoDB table name
- `QueueUrl`: SQS queue URL

## Customization

Edit `lib/product-analytics-stack.ts` to customize:

### Change Region/Account

```typescript
new ProductAnalyticsStack(app, 'ProductAnalyticsStack', {
  env: {
    account: '123456789012',
    region: 'eu-west-1',
  },
});
```

### Change Resource Names

```typescript
const eventsTable = new dynamodb.Table(this, 'EventsTable', {
  tableName: 'my-custom-table-name',
  // ...
});
```

### Adjust Lambda Settings

```typescript
const ingestLambda = new lambda.Function(this, 'IngestFunction', {
  timeout: cdk.Duration.seconds(30),  // Increase timeout
  memorySize: 512,                     // More memory
  // ...
});
```

### Change API Throttling

```typescript
const api = new apigateway.RestApi(this, 'IngestApi', {
  deployOptions: {
    throttlingRateLimit: 2000,    // Increase rate limit
    throttlingBurstLimit: 5000,   // Increase burst
  },
});
```

### Enable DynamoDB Deletion on Stack Destroy

```typescript
const eventsTable = new dynamodb.Table(this, 'EventsTable', {
  removalPolicy: cdk.RemovalPolicy.DESTROY,  // Change from RETAIN
  // ...
});
```

## Development

### Local Build

```bash
pnpm build
```

### Watch Mode

```bash
cdk watch
```

Auto-deploys on file changes (experimental).

## Bootstrap (First Time)

If you haven't used CDK in your AWS account/region:

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

## Selective Deployment

Deploy only specific bounded contexts:

```typescript
// Deploy only ingestion (disable query)
new AnalyticsStack(app, 'AnalyticsStack', {
  ingest: { enabled: true },
  query: { enabled: false },
});

// Deploy only query (disable ingestion)
new AnalyticsStack(app, 'AnalyticsStack', {
  ingest: { enabled: false },
  query: { enabled: true },
});
```

## Multi-Environment Setup

Create separate stacks for different environments:

```typescript
// bin/app.ts
const app = new cdk.App();

new AnalyticsStack(app, 'Analytics-Dev', {
  env: { account: '123', region: 'us-east-1' },
  ingest: { enabled: true },
  query: { enabled: true },
});

new AnalyticsStack(app, 'Analytics-Prod', {
  env: { account: '456', region: 'us-west-2' },
  ingest: { enabled: true },
  query: { enabled: true },
});
```

Deploy specific stack:
```bash
cdk deploy Analytics-Dev
cdk deploy Analytics-Prod
```

## Splitting Into Multiple Stacks

When you need independent deployments (e.g., different teams, SLAs):

```typescript
// Future: Split into 3 stacks
class StorageStack extends cdk.Stack {
  public readonly storage: AnalyticsStorage;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.storage = new AnalyticsStorage(this, 'Storage');
  }
}

class IngestStack extends cdk.Stack {
  constructor(scope: Construct, id: string, storage: AnalyticsStorage, props?: cdk.StackProps) {
    super(scope, id, props);
    new IngestApi(this, 'IngestApi', {
      queue: storage.ingestQueue,
      table: storage.eventsTable,
    });
  }
}

// bin/app.ts
const storage = new StorageStack(app, 'Analytics-Storage');
new IngestStack(app, 'Analytics-Ingest', storage.storage);
new QueryStack(app, 'Analytics-Query', storage.storage);
```

Then deploy independently:
```bash
cdk deploy Analytics-Storage       # Once
cdk deploy Analytics-Ingest         # Deploy ingest changes
cdk deploy Analytics-Query          # Deploy query changes (independent!)
```
