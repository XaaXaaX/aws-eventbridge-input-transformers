#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SQSSourceStack } from '../lib/sqs-sns-stack';
import { DDBSourceSQSTargetStack } from '../lib/ddb-sqs-stack';

const app = new cdk.App();

new SQSSourceStack(app, SQSSourceStack.name, {});

new DDBSourceSQSTargetStack(app, DDBSourceSQSTargetStack.name, {});