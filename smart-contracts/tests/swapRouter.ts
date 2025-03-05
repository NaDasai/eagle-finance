import {
  Account,
  Args,
  Mas,
  MRC20,
  OperationStatus,
  parseUnits,
  populateDatastore,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { beforeAll, describe, expect, test } from 'vitest';
import * as dotenv from 'dotenv';
import { SwapPath } from './classes/swapPath';
import { getScByteCode, NATIVE_MAS_COIN_ADDRESS } from './utils';
import { increaseAllowance } from '../src/builnet-tests/helpers';
// import { increaseAllownace } from './calls/basicPool';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

let registryContract = new SmartContract(user1Provider, '');

const usdtWmasPoolAddress =
  'AS124jjA2D1unruxip45tZTDQER4BGQ8DxJA8NqekqzPp1nfQDTLk';

const usdcWMASPoolAddress =
  'AS12QxVMK3NPF2ZzcqknD4MDkr75VU6FnGiiZt5iShPVvvEQh5w6c';

let usdtWmasPoolContract = new SmartContract(
  user1Provider,
  usdtWmasPoolAddress,
);

let usdcWMASPoolContract = new SmartContract(
  user1Provider,
  usdcWMASPoolAddress,
);

const usdcAddress = 'AS12s8vxjgYc4jwBfA8rFQB6M9NGVzGid6e7EKKA599og9JrNL6AC';
const usdtAddress = 'AS12sQwteFmgj5j1waqKVZ5KtwVW63fcbyrNYKQeB3KcwADzHGHjb';

const swapPath1 = new SwapPath(
  usdtWmasPoolAddress,
  usdtAddress,
  NATIVE_MAS_COIN_ADDRESS,
  parseUnits('100', 18),
  parseUnits('0.01', 18),
);

const swapPath2 = new SwapPath(
  usdcWMASPoolAddress,
  NATIVE_MAS_COIN_ADDRESS,
  usdcAddress,
  parseUnits('25.55139019818133', 18),
  parseUnits('0.0001', 18),
);

const args = new Args()
  .addString('test')
  .addSerializableObjectArray<SwapPath>([swapPath1, swapPath2])
  .addU64(Mas.fromString('0.1'))
  .serialize();

const swapRouterByteCode = getScByteCode('build', 'swapRouter.wasm');

// const datastore = populateDatastore([
//   {
//     data: swapRouterByteCode,
//     args,
//     coins: Mas.fromString('0.01'),
//   },
// ]);

// const operation = await user1Provider.executeSC({
//   byteCode: swapRouterByteCode,
//   maxCoins: Mas.fromString('10'),
//   datastore,
// });

// const status = await operation.waitSpeculativeExecution();

// console.log(status);

// if (status === OperationStatus.SpeculativeSuccess) {
//   console.log('Operation successful');
// } else {
//   console.log('Operation failed');
// }

// const events = await operation.getSpeculativeEvents();

// console.log(events);

// increase

const contract = await SmartContract.deploy(
  user1Provider,
  swapRouterByteCode,
  new Args().serialize(),
  {
    coins: Mas.fromString('0.1'),
  },
);

console.log('Contract deployed at:', contract.address);

try {
  // increase allownace of usdt to the contract
  await increaseAllowance(
    usdtAddress,
    swapPath1.amountIn,
    user1Provider,
    contract,
  );

  // Call executeSwap on the contract
  const operation = await contract.call('executeSwap', args, {
    coins: Mas.fromString('0.1'),
  });

  const status = await operation.waitSpeculativeExecution();

  const events = await operation.getSpeculativeEvents();

  console.log(events);

  console.log(status);

  if (status === OperationStatus.SpeculativeSuccess) {
    console.log('Operation swap successful');
  } else {
    console.log('Operation sswap failed');
  }
} catch (error) {
  console.log(error);
}
