import {
  Account,
  Address,
  Args,
  ArgTypes,
  ArrayTypes,
  bytesToF64,
  Mas,
  OperationStatus,
  SmartContract,
  U128,
  U8,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

console.log('Deploying contract...');

const byteCode = getScByteCode('build', 'tokenDeployer.wasm');

// constructr takes fee share protocol as a parameter
const constructorArgs = new Args().serialize();

let contract = await SmartContract.deploy(provider, byteCode, constructorArgs, {
  coins: Mas.fromString('0.9'),
});

console.log('Contract deployed at:', contract.address);

async function createNewToken() {
  console.log('Creating new token.....');

  const operation = await contract.call(
    'createNewToken',
    new Args()
      .addString('Eagle Finance') // token name
      .addString('EGL') // token symbol
      .addU8(U8.fromNumber(18)) // token decimals
      .addU256(U128.fromNumber(1000000000000)) // token total supply
      .addString('https://eagle.finance/logo.png') // token url (optional)
      .addString('Dex on Massa') // token description (optional)
      .serialize(),
    { coins: Mas.fromString('3') },
  );

  const status = await operation.waitFinalExecution();

  console.log('Status:', status);

  if (status === OperationStatus.Success) {
    console.log('Token created successfully');
    console.log(
      'Token Deployed Address',
      await operation.getDeployedAddress(true),
    );
  } else {
    throw new Error('Failed to create new pool');
  }
}

async function getTokens() {
  console.log('Getting tokens.....');
  const result = await contract.read('getTokens', new Args().serialize());

  const tokens = new Args(result.value).nextArray(ArrayTypes.STRING);

  console.log('Tokens:', tokens);
}

async function test1() {
  await createNewToken();

  await getTokens();
}

await test1();

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}