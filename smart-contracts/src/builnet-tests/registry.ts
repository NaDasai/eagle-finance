import {
  Account,
  Args,
  bytesToF64,
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

// constructr takes fee share protocol as a parameter
const constructorArgs = new Args()
  .addF64(0.5)
  .addString('AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU')
  .serialize();

let contract = await SmartContract.deploy(provider, byteCode, constructorArgs, {
  coins: Mas.fromString('10'),
});

console.log('Contract deployed at:', contract.address);

async function createNewPool(
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: number,
) {
  console.log('Creating new poool.....');

  const operation = await contract.call(
    'createNewPool',
    new Args()
      .addString(aTokenAddress)
      .addString(bTokenAddress)
      .addF64(inputFeeRate)
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

async function getRegistryFeeShareProtocol() {
  const result = await contract.read(
    'getFeeShareProtocol',
    new Args().serialize(),
  );

  const feeShareProtocol = bytesToF64(result.value);

  console.log('Fee share protocol:', feeShareProtocol);
}

async function test1() {
  await getRegistryFeeShareProtocol();

  await createNewPool(
    'AS1otSzBjxmtAFfqsRViVSEqbW8ARnY5S34B2bYH2qWqTxzJQsiA',
    'AS1otSzBjxmtAFfqsRViVSEqbW8ARnY5S34B2bYH2qWqTxzJQsiA',
    0.5,
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
