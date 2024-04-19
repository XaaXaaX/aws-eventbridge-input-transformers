#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SQSSourceStack } from '../lib/sqs-sns-stack';

const app = new cdk.App();

new SQSSourceStack(app, SQSSourceStack.name, {});