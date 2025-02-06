import {
  Account,
  Args,
  Mas,
  OperationStatus,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import * as dotenv from 'dotenv';

dotenv.config();

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

const wmasTokenAddress =
  'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';

const contrat = new SmartContract(provider, wmasTokenAddress);

async function wrapMas(amount: number) {
  const args = new Args().addU64(Mas.fromString(amount.toString()));

  const operation = await contrat.call('deposit', args.serialize(), {
    coins: Mas.fromString(amount.toString()),
  });

  const status = await operation.waitFinalExecution();

  if (status === OperationStatus.Success) {
    console.log(`Wrapped ${amount} MAS Successfully`);
  } else {
    console.log('Failed to wrap MAS');
  }
}

async function unwrapMas(amount: number) {
  const args = new Args()
    .addU64(Mas.fromString(amount.toString()))
    .addString(account.address.toString());

  const operation = await contrat.call('withdraw', args.serialize());

  const status = await operation.waitFinalExecution();

  if (status === OperationStatus.Success) {
    console.log(`Unwrapped ${amount} MAS Successfully`);
  } else {
    console.log('Failed to unwrap MAS');
  }
}

console.log('Wrapping 20 MAS....');
await wrapMas(20);
console.log('Unwrapping 5 MAS....');
await unwrapMas(5);
