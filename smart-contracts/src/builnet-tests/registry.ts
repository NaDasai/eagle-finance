import {
  Account,
  Args,
  bytesToF64,
  Mas,
  MRC20,
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

async function createNewPoolWithLiquidity(
  aTokenAddress: string,
  bTokenAddress: string,
  inputFeeRate: number,
  amountA: number,
  amountB: number,
) {
  console.log('Creating new poool and add liquidity.....');

  const operation = await contract.call(
    'createNewPoolWithLiquidity',
    new Args()
      .addString(aTokenAddress)
      .addString(bTokenAddress)
      .addU256(BigInt(amountA))
      .addU256(BigInt(amountB))
      .addF64(inputFeeRate)
      .serialize(),
    { coins: Mas.fromString('0.1') },
  );

  const status = await operation.waitFinalExecution();

  if (status === OperationStatus.Success) {
    console.log('Pool created successfully and Liquidity added');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to create new pool and add liquidity');
  }
}

async function getPools(): Promise<Pool[]> {
  const result = await contract.read('getPools', new Args().serialize());

  const pools = new Args(result.value).nextSerializableObjectArray<Pool>(Pool);

  console.log('Pools:', pools);
  return pools;
}

async function getRegistryFeeShareProtocol() {
  const result = await contract.read(
    'getFeeShareProtocol',
    new Args().serialize(),
  );

  const feeShareProtocol = bytesToF64(result.value);

  console.log('Fee share protocol:', feeShareProtocol);
}

async function testCreateAndGetPools() {
  await getRegistryFeeShareProtocol();

  await createNewPool(
    'AS1otSzBjxmtAFfqsRViVSEqbW8ARnY5S34B2bYH2qWqTxzJQsiA',
    'AS1otSzBjxmtAFfqsRViVSEqbW8ARnY5S34B2bYH2qWqTxzJQsiA',
    0.5,
  );

  await getPools();
}

async function getPoolReserves(poolAddress: string) {
  const poolContract = new SmartContract(provider, poolAddress);

  const aReserve = await poolContract.read('getLocalReserveA');

  const bReserve = await poolContract.read('getLocalReserveB');

  console.log('A reserve:', new Args(aReserve.value).nextU256());
  console.log('B reserve:', new Args(bReserve.value).nextU256());
}

async function increaseAllowance(tokenAddress: string, amount: number) {
  const mrc20 = new MRC20(provider, tokenAddress);

  // increase allowance of the token
  const operation = await mrc20.increaseAllowance(
    contract.address,
    Mas.fromString(amount.toString()),
  );

  const status = await operation.waitFinalExecution();

  if (status === OperationStatus.Success) {
    console.log('Allowance increased successfully');
  } else {
    console.log('Status:', status);
    throw new Error('Failed to increase allowance');
  }
}

async function testCreateAndAddLiquidityAndGetPools() {
  const aToken = 'AS12vNzXieYEbh4A49utzRRaTjPFCP1VR9xreETG1SjPLHRc9V6XP';
  const bToken = 'AS123TVpzNG6HXs6v5a7PfNagRcbZjApU4xnijWhDW3TpnxF7XxFh';

  await increaseAllowance(aToken, 100);
  await increaseAllowance(bToken, 100);

  await createNewPoolWithLiquidity(aToken, bToken, 0.5, 100, 100);

  const pools = await getPools();

  if (pools.length <= 0) {
    console.warn('No pools found');
    return;
  }

  const pool = pools[0];

  console.log('Pool address:', pool.poolAddress);
  console.log('Pool token A address:', pool.aTokenddress);
  console.log('Pool token B address:', pool.bTokenAddress);
  console.log('Pool fee rate:', pool.inputFeeRate);

  await getPoolReserves(pool.poolAddress);
}

// await testCreateAndGetPools();
await testCreateAndAddLiquidityAndGetPools();

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}
