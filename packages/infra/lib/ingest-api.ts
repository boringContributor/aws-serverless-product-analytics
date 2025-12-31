import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dsql from 'aws-cdk-lib/aws-dsql';
import { Construct } from 'constructs';
import * as path from 'path';

export interface IngestApiProps {
  dsqlCluster: dsql.CfnCluster;
}

export class IngestApi extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly ingestLambda: lambda.Function;
  public readonly eventStream: kinesis.Stream;
  public readonly rawEventsBucket: s3.Bucket;
  public readonly firehoseToS3: firehose.DeliveryStream;
  public readonly processorLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: IngestApiProps) {
    super(scope, id);

    this.eventStream = new kinesis.Stream(this, 'EventStream', {
      streamMode: kinesis.StreamMode.ON_DEMAND, // Auto-scaling
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryption: kinesis.StreamEncryption.MANAGED,
      retentionPeriod: cdk.Duration.days(7), // Keep events for 7 days for replay
    });

    this.rawEventsBucket = new s3.Bucket(this, 'RawAnalyticEventsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
          expiration: cdk.Duration.days(2555), // 7 years
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

     this.firehoseToS3 = new firehose.DeliveryStream(this, 'FirehoseDeliveryStream', {
      destination: new firehose.S3Bucket(this.rawEventsBucket, {
        errorOutputPrefix: 'errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/',
        bufferingInterval: cdk.Duration.seconds(60), // 1 minute
        bufferingSize: cdk.Size.mebibytes(128),
        compression: firehose.Compression.GZIP
      }),
      source: new firehose.KinesisStreamSource(this.eventStream)
    }
    );

    this.processorLambda = new lambdaNodejs.NodejsFunction(
      this,
      'ProcessorLambda',
      {
        runtime: lambda.Runtime.NODEJS_24_X,
        handler: 'handler',
        entry: path.join(__dirname, '../../processor/src/index.ts'),
        environment: {
          DSQL_HOST: props.dsqlCluster.attrEndpoint,
          DSQL_USERNAME: 'admin',
        },
        timeout: cdk.Duration.seconds(60),
        memorySize: 512,
        description: 'Consumes events from Kinesis and writes to storage via @analytics/storage'
      }
    );

    this.processorLambda.addEventSource(
      new lambdaEventSources.KinesisEventSource(this.eventStream, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 100,
        maxBatchingWindow: cdk.Duration.seconds(5),
        bisectBatchOnError: true,
        retryAttempts: 3,
      })
    );

    // Grant DSQL permissions to processor Lambda
    this.processorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dsql:DbConnect', 'dsql:DbConnectAdmin'],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: 'dsql',
            resource: 'cluster',
            resourceName: props.dsqlCluster.ref,
          }),
        ],
      })
    );

    this.ingestLambda = new lambda.Function(this, 'IngestFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2023,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../ingestion/target/lambda/ingestion')
      ),
      environment: {
        STREAM_NAME: this.eventStream.streamName,
        RUST_BACKTRACE: '1',
        RUST_LOG: 'info',
      },
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      description: 'Ingests analytics events and writes to Kinesis Stream',
    });

    this.eventStream.grantReadWrite(this.ingestLambda);

    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'Product Analytics Ingest API',
      description: 'Public endpoint for ingesting product analytics events',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 1000, // requests per second
        throttlingBurstLimit: 2000, // burst capacity
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false, // Disable for privacy (contains request/response)
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Lambda integration for all ingest endpoints
    const ingestIntegration = new apigateway.LambdaIntegration(
      this.ingestLambda,
      {
        proxy: true,
      }
    );

    // POST /view - Track page views
    const view = this.api.root.addResource('view');
    view.addMethod('POST', ingestIntegration);

    // POST /event - Track custom events
    const event = this.api.root.addResource('event');
    event.addMethod('POST', ingestIntegration);

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'IngestApiEndpoint', {
      value: this.api.url,
      description: 'Ingestion API Gateway endpoint URL (public, write-only)',
      exportName: 'ProductAnalyticsIngestApiEndpoint',
    });
  }
}
