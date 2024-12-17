import {
  Account,
  Args,
  Mas,
  OperationStatus,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';
import { Pool } from './structs/pool';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'registry.wasm');

const constructorArgs = new Args().serialize();

let contract = await SmartContract.deploy(provider, byteCode, constructorArgs, {
  coins: Mas.fromString('10'),
});

console.log('Contract deployed at:', contract.address);

async function createNewPool(
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: number,
  feeShareProtocol: number,
) {
  console.log('Creating new poool.....');

  const operation = await contract.call(
    'createNewPool',
    new Args()
      .addString(aTokenAddress)
      .addString(bTokenAddress)
      .addF64(inputFeeRate)
      .addF64(feeShareProtocol)
      .serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitFinalExecution();

  if (status === OperationStatus.Success) {
    console.log('Pool created successfully');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to create new pool');
  }
}

async function getPools() {
  const result = await contract.read('getPools', new Args().serialize());

  const pools = new Args(result.value).nextSerializableObjectArray<Pool>(Pool);

  console.log('Pools:', pools);
}

async function test1() {
  await createNewPool(
    'AS1otSzBjxmtAFfqsRViVSEqbW8ARnY5S34B2bYH2qWqTxzJQsiA',
    'AS1otSzBjxmtAFfqsRViVSEqbW8ARnY5S34B2bYH2qWqTxzJQsiA',
    0.5,
    0.05,
  );

  await getPools();
}

await test1();

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}

// const ev = await provider.getEvents({
//   smartContractAddress: 'AS1XSHcSxpFNXcxCPDQp8yyW6ezMkKk5h3EeviDndh3P2xmP6E9q',
// });

// console.log('Events 2 :', ev);
