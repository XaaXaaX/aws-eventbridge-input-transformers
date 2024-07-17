import { RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { join, resolve } from "path";
import { LambdaConfiguration } from "../helpers/lambda-nodejs";
import { ManagedPolicy, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { CfnPipe } from "aws-cdk-lib/aws-pipes";
import { AttributeType, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";

export interface DDBSourceSQSTargetStackProps extends StackProps {}

export class DDBSourceSQSTargetStack extends Stack  {
  constructor(scope: Construct, id: string, props: DDBSourceSQSTargetStackProps) {
    super(scope, id, props);

    const lambdaServiceRole = new ServicePrincipal('lambda.amazonaws.com');

    const queue = new Queue(this, 'Queue', {});

    const table = new Table(this, 'Table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: RemovalPolicy.DESTROY
    });
    
    const enrichmentFunctionRole = new Role(this, 'EnrichmentFunctionRole', { 
      assumedBy: lambdaServiceRole,
      managedPolicies: [ ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole') ]
     });

    const enrichmentFunction =  new NodejsFunction(this, 'EnrichmentFunction', {
      entry: resolve(join(__dirname, '../../src/enrichment/handler.ts')),
      handler: 'handler',
      role: enrichmentFunctionRole,
      ...LambdaConfiguration,
    });

    new LogGroup(this, 'TriggerFunctionLogGroup', {
      logGroupName: `/aws/lambda/${enrichmentFunction.functionName}`,
      removalPolicy: RemovalPolicy.DESTROY,
      retention: RetentionDays.ONE_DAY
    });

    const piperole = new Role(this, 'PipeRole', { assumedBy: new ServicePrincipal('pipes.amazonaws.com') });
    new CfnPipe(this, 'Pipe', {
      source: table.tableStreamArn!,
      sourceParameters : {
        dynamoDbStreamParameters: {
          startingPosition: 'LATEST',
          batchSize: 1
        }
      },
      enrichment: enrichmentFunction.functionArn,
      target: queue.queueArn,
      roleArn: piperole.roleArn,
      logConfiguration: {
        level: 'TRACE',
        cloudwatchLogsLogDestination: {
          logGroupArn: new LogGroup(this, 'PipeLogGroup', {
            removalPolicy: RemovalPolicy.DESTROY,
            retention: RetentionDays.ONE_DAY
          }).logGroupArn
        }
      }
    })

    queue.grantSendMessages(piperole);
    table.grantStreamRead(piperole);
    enrichmentFunction.grantInvoke(piperole);
  }
}