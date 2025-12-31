import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IngestApi } from './ingest-api';
import { QueryApi } from './query-api';
import { AnalyticsStorage } from './storage';

export interface AnalyticsStackProps extends cdk.StackProps {}

export class AnalyticsStack extends cdk.Stack {
  public readonly storage: AnalyticsStorage;
  public readonly ingestApi: IngestApi;
  public readonly queryApi: QueryApi;

  constructor(scope: Construct, id: string, props?: AnalyticsStackProps) {
    super(scope, id, props);

    this.storage = new AnalyticsStorage(this, 'Storage');

    this.ingestApi = new IngestApi(this, 'IngestApi', {
      dsqlCluster: this.storage.cluster,
    });

    this.queryApi = new QueryApi(this, 'QueryApi', {
      dsqlCluster: this.storage.cluster,
    });
  }
}
