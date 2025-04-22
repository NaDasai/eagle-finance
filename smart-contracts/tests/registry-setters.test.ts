import {
  Account,
  parseMas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { beforeAll, describe, expect, it, test } from 'vitest';
import {
  createNewPool,
  createNewPoolWithLiquidity,
  deployRegistryContract,
  getFeeShareProtocolReceiver,
  getFlashLoanFeeReceiver,
  getPools,
  getWmasTokenAddress,
  setFeeShareProtocolReceiver,
  setFlashLoanFeeReceiver,
  setWmasTokenAddress,
} from './calls/registry';
import * as dotenv from 'dotenv';
import { NATIVE_MAS_COIN_ADDRESS } from './utils';
import { getPoolReserves, increaseAllownace } from './calls/basicPool';

dotenv.config();

const user1Provider = Web3Provider.buildnet(await Account.fromEnv());

const user2Provider = Web3Provider.buildnet(
  await Account.fromEnv('PRIVATE_KEY_TWO'),
);

const user4Address = 'AU12DX9QCAuqoGFreRTAS1qa6NmuYjyux9UG6aYnrDmT87XqxYSmH';

const wmasAddress = 'AS12FW5Rs5YN2zdpEnqwj4iHUUPt9R4Eqjq2qtpJFNKW3mn33RuLU';

let registryContract: SmartContract;

const aTokenAddress = 'AS1RWS5UNryey6Ue5HGLhMQk9q7YRnuS1u6M6JAjRwSfc2aRbZ5H';
const bTokenAddress = wmasAddress;
const inputFeeRate = 25 * 10_000;
let poolContract: SmartContract;

beforeAll(async () => {
  registryContract = await deployRegistryContract(user1Provider, wmasAddress);

  // // create a new pool without liquidity
  // await createNewPool(
  //   registryContract,
  //   aTokenAddress,
  //   bTokenAddress,
  //   inputFeeRate,
  // );

  // //  get pool contract
  // const pools = await getPools(registryContract);

  // const pool = pools[pools.length - 1];

  // poolContract = new SmartContract(user1Provider, pool.poolAddress);
});

describe.skip('Test setFeeShareProtocolReceiver functionality', async () => {
  test('should fee share protocol receiver equals the deployer user', async () => {
    const feeShareProtocolReceiver = await getFeeShareProtocolReceiver(
      registryContract,
    );

    expect(
      feeShareProtocolReceiver,
      'Fee share protocol receiver should be the user1 address',
    ).toBe(user1Provider.address);
  });

  test('should allow the deployer to set a new fee share protocol receiver', async () => {
    //  set new fee share protocol receiver
    await setFeeShareProtocolReceiver(registryContract, user4Address);

    const feeShareProtocolReceiver = await getFeeShareProtocolReceiver(
      registryContract,
    );

    expect(
      feeShareProtocolReceiver,
      'Fee share protocol receiver should be the user4 address',
    ).toBe(user4Address);
  });

  test('should not allow the deployer to set a new fee share protocol receiver to the same address', async () => {
    // switch registry contract to user 2
    registryContract = new SmartContract(
      user2Provider,
      registryContract.address,
    );

    await expect(
      setFeeShareProtocolReceiver(registryContract, user2Provider.address),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the owner at assembly/utils/ownership-internal.ts:49 col: 3',
    );
  });
});

describe.skip('Test wmasAddress functionality', async () => {
  test('should wmasAddress equals to defaultwmas address after deployment', async () => {
    const registryWmasAddress = await getWmasTokenAddress(registryContract);

    expect(
      registryWmasAddress,
      'Registry Wmas address should be the default wmas address',
    ).toBe(wmasAddress);
  });

  test('should allow the deployer to set new wmas address', async () => {
    // switch registry contract to user 1
    registryContract = new SmartContract(
      user1Provider,
      registryContract.address,
    );

    const newWmasAddress = aTokenAddress;

    await setWmasTokenAddress(registryContract, newWmasAddress);

    const registryWmasAddress = await getWmasTokenAddress(registryContract);

    expect(
      registryWmasAddress,
      'Registry Wmas address should be the new wmas address',
    ).toBe(newWmasAddress);
  });

  test('should not allow the deployer to set new wmas address to the same address', async () => {
    // switch registry contract to user 2
    registryContract = new SmartContract(
      user2Provider,
      registryContract.address,
    );

    await expect(
      setWmasTokenAddress(registryContract, wmasAddress),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the owner at assembly/utils/ownership-internal.ts:49 col: 3',
    );
  });
});

describe('Test flashLoanFeeReceiver functionality', async () => {
  test('should flashLoanFeeReceiver equals to user1 address after deployment', async () => {
    const flashLoanFeeReceiver = await getFlashLoanFeeReceiver(
      registryContract,
    );

    expect(
      flashLoanFeeReceiver,
      'Flash loan fee receiver should be the user1 address',
    ).toBe(user1Provider.address);
  });

  test('should allow the deployer to set new flash loan fee receiver', async () => {
    // switch registry contract to user 1
    registryContract = new SmartContract(
      user1Provider,
      registryContract.address,
    );

    await setFlashLoanFeeReceiver(registryContract, user4Address);
    const flashLoanFeeReceiver = await getFlashLoanFeeReceiver(
      registryContract,
    );

    expect(
      flashLoanFeeReceiver,
      'Flash loan fee receiver should be the user4 address',
    ).toBe(user4Address);
  });

  test('should not allow a non deployer to set new flash loan fee receiver', async () => {
    // switch registry contract to user 2
    registryContract = new SmartContract(
      user2Provider,
      registryContract.address,
    );

    await expect(
      setFlashLoanFeeReceiver(registryContract, user2Provider.address),
    ).rejects.toThrowError(
      'readonly call failed: VM Error in ReadOnlyExecutionTarget::FunctionCall context: VM execution error: RuntimeError: Runtime error: error: Caller is not the owner at ~lib/@massalabs/sc-standards/assembly/contracts/utils/ownership-internal.ts:49 col: 3',
    );
  });
});
