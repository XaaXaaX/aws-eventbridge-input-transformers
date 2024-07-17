import { SNSEvent, Context, DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';

export const handler = async (event: DynamoDBRecord[], context: Context) => {
  console.log('Event:', JSON.stringify(event));
  const results = event.map((record: DynamoDBRecord) => {
    if(['INSERT', 'MODIFY'].includes(record.eventName!) && record.dynamodb) {
      const rec = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue> );
      return {
        ...rec,
        type: record.eventName
      }
    }
    else if(record.eventName === 'REMOVE' && record.dynamodb) {
      const rec = unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue> );
      return {
        ...rec,
        type: record.eventName
      }
    }
  });
  return results;
}