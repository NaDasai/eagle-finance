import { Account, OperationStatus, Web3Provider } from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';

dotenv.config();

const account = await Account.fromEnv('PRIVATE_KEY');
const account2 = await Account.fromEnv('PRIVATE_KEY_TWO');
const provider = Web3Provider.buildnet(account);

console.log('Geeting account 1 rolls : ');

const client = provider.client;

const addrInfo = await client.getAddressInfo(account.address.toString());

const rollsBefore = addrInfo.candidate_roll_count;

console.log('Account 1 rolls Before Buy : ', rollsBefore);

// Buy rolls
await buyRolls();

// Get rolls after buy
const addrInfoAfter = await client.getAddressInfo(account.address.toString());

const rollsAfter = addrInfoAfter.candidate_roll_count;

console.log('Account 1 rolls After Buy : ', rollsAfter);

// Sell rolls
await sellRolls();

// Get rolls after sell
const addrInfoAfterSell = await client.getAddressInfo(
  account.address.toString(),
);
const rollsAfterSell = addrInfoAfterSell.candidate_roll_count;
console.log('Account 1 rolls After Sell : ', rollsAfterSell);

console.log('Done');

async function buyRolls() {
  console.log('Buyy 1 Rolls...');

  const operation = await provider.buyRolls(1n);

  const operationStatus = await operation.waitSpeculativeExecution();

  if (operationStatus == OperationStatus.SpeculativeSuccess) {
    console.log('Rolls bought successfully');
  } else {
    console.log('Rolls not bought');
    process.exit(1);
  }
}

async function sellRolls() {
  console.log('Sell 1 Rolls...');

  const operation = await provider.sellRolls(1n);

  const operationStatus = await operation.waitSpeculativeExecution();

  if (operationStatus == OperationStatus.SpeculativeSuccess) {
    console.log('Rolls selled successfully');
  } else {
    console.log('Rolls not selled');
    process.exit(1);
  }
}
