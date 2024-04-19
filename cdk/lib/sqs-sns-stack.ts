import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join, resolve } from "path";
import { LambdaConfiguration } from "../helpers/lambda-nodejs";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { FilterOrPolicy, SubscriptionFilter, Topic } from "aws-cdk-lib/aws-sns";
import { CfnPipe } from "aws-cdk-lib/aws-pipes";
import { LambdaSubscription } from "aws-cdk-lib/aws-sns-subscriptions";

export interface SQSSourceStackProps extends StackProps {}

export class SQSSourceStack extends Stack  {
  constructor(scope: Construct, id: string, props: SQSSourceStackProps) {
    super(scope, id, props);

    const lambdaServiceRole = new ServicePrincipal('lambda.amazonaws.com');

    const queue = new Queue(this, 'Queue', {
      fifo: true,
      queueName: 'source-queue.fifo',
    });

    const topic = new Topic(this, 'Topic', {});

    const piperole = new Role(this, 'PipeRole', { assumedBy: new ServicePrincipal('pipes.amazonaws.com') });
    new CfnPipe(this, 'Pipe', {
      source: queue.queueArn,
      target: topic.topicArn,
      targetParameters: {
       inputTemplate: `{"body": <$.body>}`
      },
      roleArn: piperole.roleArn,
    })

    const triggerFunctionRole = new Role(this, 'TriggerFunctionRole', { 
      assumedBy: lambdaServiceRole,
      managedPolicies: [ ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole') ]
     });

    const triggerFunction =  new NodejsFunction(this, 'TriggerFunction', {
      entry: resolve(join(__dirname, '../../src/trigger/handler.ts')),
      handler: 'handler',
      role: triggerFunctionRole,
      ...LambdaConfiguration,
    });

    new LogGroup(this, 'TriggerFunctionLogGroup', {
      logGroupName: `/aws/lambda/${triggerFunction.functionName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY
    });

    topic.addSubscription(new LambdaSubscription(triggerFunction
      , {
      filterPolicyWithMessageBody: {
        body: FilterOrPolicy.policy({
          partner: FilterOrPolicy.filter(SubscriptionFilter.stringFilter({
            allowlist: [
              'BFF'
            ],
          })),
        })
    }}));

    queue.grantConsumeMessages(piperole);
    topic.grantPublish(piperole);

  }
}