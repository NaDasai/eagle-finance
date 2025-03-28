import {
  createNewPoolWithLiquidity,
  deployRegistryContract,
  getPools,
} from '../tests/calls/registry';

import {
  Account,
  Args,
  Mas,
  OperationStatus,
  parseMas,
  parseUnits,
  SmartContract,
  U128,
  U8,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';
import { getPoolReserves, increaseAllownace } from '../tests/calls/basicPool';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';

// deploy registry contract
const registryContract = await deployRegistryContract(provider, wmasAddress);

const aTokenAddress = 'AS12N76WPYB3QNYKGhV2jZuQs1djdhNJLQgnm7m52pHWecvvj1fCQ';
const bTokenAddress = wmasAddress;

const aAmount = 1;
const bAmount = 1;

// increase allowance of both tokerns amoutns first before adding liquidity
await increaseAllownace(
  aTokenAddress,
  registryContract.address,
  aAmount,
  provider,
);
await increaseAllownace(
  bTokenAddress,
  registryContract.address,
  bAmount,
  provider,
);

// await createNewPoolWithLiquidity(
//   registryContract,
//   aTokenAddress,
//   bTokenAddress,
//   1,
//   1,
//   0,
//   0,
//   0.3 * 10_000,
//   false,
//   6,
//   9,
// );

const isBNativeMas = false;
const aDecimals = 6;
const bDecimals = 9;

console.log('Creating new pool with liquidity...');

const coinsToSendOnAddLiquidity = isBNativeMas
  ? parseMas(Number(bAmount + 30).toString())
  : Mas.fromString('30');

console.log('coinsToSendOnAddLiquidity', coinsToSendOnAddLiquidity);

const operation = await registryContract.call(
  'createNewPoolWithLiquidity',
  new Args()
    .addString(aTokenAddress)
    .addString(bTokenAddress)
    .addU256(parseUnits(aAmount.toString(), aDecimals))
    .addU256(parseUnits(bAmount.toString(), bDecimals))
    .addU256(parseUnits('0', aDecimals))
    .addU256(parseUnits('0', bDecimals))
    .addU64(BigInt(0.3 * 10_000))
    .addBool(isBNativeMas)
    .serialize(),
  { coins: coinsToSendOnAddLiquidity },
);

console.log('Operation hash:', operation.id);

const events = await operation.getSpeculativeEvents();
console.log('Events:', events);


const status = await operation.waitSpeculativeExecution();

if (status === OperationStatus.SpeculativeSuccess) {
  console.log('Pool created successfully');
} else {
  console.log('Status:', status);
  process.exit(1);
}

// get registry pools
const pools = await getPools(registryContract);

console.log('Pools:', pools);

const pool = pools[0];

console.log('Pool address:', pool.poolAddress);
const poolContract = new SmartContract(provider, pool.poolAddress);

// get teh reserves
const [reserveAAfter, reserveBAfter] = await getPoolReserves(poolContract);

console.log('Reserve A after: ', reserveAAfter);
console.log('Reserve B after: ', reserveBAfter);
