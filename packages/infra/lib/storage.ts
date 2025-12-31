import * as cdk from 'aws-cdk-lib';
import * as dsql from 'aws-cdk-lib/aws-dsql';
import { Construct } from 'constructs';

export class AnalyticsStorage extends Construct {
  public readonly cluster: dsql.CfnCluster;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.cluster = new dsql.CfnCluster(this, 'AnalyticsDSQLCluster', {
      deletionProtectionEnabled: false,
    });

    new cdk.CfnOutput(this, 'DSQLClusterEndpoint', {
      value: this.cluster.attrEndpoint,
      description: 'Amazon DSQL cluster endpoint. Run schema initialization manually: DSQL_HOST=<endpoint> bun run packages/storage/src/dsql/init-schema.ts',
      exportName: 'AnalyticsDSQLEndpoint',
    });
  }
}
