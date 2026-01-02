import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dsql from 'aws-cdk-lib/aws-dsql';
import { Construct } from 'constructs';
import * as path from 'path';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export interface QueryApiProps {
  dsqlCluster: dsql.CfnCluster;
}

export class QueryApi extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly queryLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: QueryApiProps) {
    super(scope, id);

    this.queryLambda = new NodejsFunction(this, 'QueryApiHandler', {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(
        __dirname,
        '../../query/src/index.ts'
      ),
      environment: {
        DSQL_HOST: props.dsqlCluster.attrEndpoint,
        DSQL_USERNAME: 'admin',
        NODE_ENV: 'production',
      },
      timeout: cdk.Duration.seconds(30),
      logRetention: RetentionDays.ONE_WEEK,
      bundling: {
        // Enable Source Map for better error logs
        sourceMap: true,
        // Hook into Commands for adding the OpenAPI Specification to Output
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          // Add the OpenAPI specification to the Lambda bundle
          afterBundling: (_inputDir: string, outputDir: string) => [
            `cp "${path.join(__dirname, '../../query/openapi.yml')}" "${outputDir}/openapi.yml"`,
          ],
        },
      },
    });

    // Grant DSQL permissions to query Lambda
    this.queryLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['dsql:DbConnect'],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: 'dsql',
            resource: 'cluster',
            resourceName: props.dsqlCluster.ref,
          }),
        ],
      })
    );

    // Query API Gateway: Internal/authenticated API for reading data
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'Product Analytics Query API',
      description: 'Query and analytics API for reading product analytics data',
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 100, // Lower rate limit for query API
        throttlingBurstLimit: 200,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Api-Key',
          'X-Amz-Date',
          'Authorization',
          'X-Amz-Security-Token',
        ],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Lambda integration for query endpoints
    const queryIntegration = new apigateway.LambdaIntegration(
      this.queryLambda,
      {
        proxy: true,
      }
    );

    // /projects resource
    const projects = this.api.root.addResource('projects');
    const project = projects.addResource('{projectId}');

    // GET /projects/{projectId}/events
    const projectEvents = project.addResource('events');
    projectEvents.addMethod('GET', queryIntegration);

    // GET /projects/{projectId}/events/{eventId}
    const projectEvent = projectEvents.addResource('{eventId}');
    projectEvent.addMethod('GET', queryIntegration);

    // GET /projects/{projectId}/analytics
    const analytics = project.addResource('analytics');

    // GET /projects/{projectId}/analytics/overview
    const overview = analytics.addResource('overview');
    overview.addMethod('GET', queryIntegration);

    // GET /projects/{projectId}/analytics/timeseries
    const timeseries = analytics.addResource('timeseries');
    timeseries.addMethod('GET', queryIntegration);

    // GET /projects/{projectId}/pages
    const pages = project.addResource('pages');
    pages.addMethod('GET', queryIntegration);

    // GET /projects/{projectId}/pages/top-referrers
    const topReferrers = pages.addResource('top-referrers');
    topReferrers.addMethod('GET', queryIntegration);

    // GET /projects/{projectId}/users
    const users = project.addResource('users');

    // GET /projects/{projectId}/users/active
    const activeUsers = users.addResource('active');
    activeUsers.addMethod('GET', queryIntegration);

    // GET /projects/{projectId}/users/{userId}/events
    const userIdResource = users.addResource('{userId}');
    const userEvents = userIdResource.addResource('events');
    userEvents.addMethod('GET', queryIntegration);

    // POST /projects/{projectId}/funnels
    const funnels = project.addResource('funnels');
    funnels.addMethod('POST', queryIntegration);

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'QueryApiEndpoint', {
      value: this.api.url,
      description: 'Query API Gateway endpoint URL (internal, read-only)',
      exportName: 'ProductAnalyticsQueryApiEndpoint',
    });
  }
}
