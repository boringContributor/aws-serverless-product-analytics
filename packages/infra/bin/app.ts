#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AnalyticsStack } from '../lib/analytics-stack';

const app = new cdk.App();

new AnalyticsStack(app, 'AnalyticsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'Serverless Product Analytics Platform'
});

app.synth();
