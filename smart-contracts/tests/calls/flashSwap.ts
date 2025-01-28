import { Args, Mas, Provider, SmartContract } from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';

export async function deployFlashSwapContract(
  userProvider: Provider,
  poolAddress: string,
  registryAddress: string,
) {
  const flashSwapByteCode = getScByteCode('build', 'ExempleFlashSwap.wasm');

  const constructorArgs = new Args()
    .addString(poolAddress)
    .addString(registryAddress)
    .serialize();

  const contract = await SmartContract.deploy(
    userProvider,
    flashSwapByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('2'),
    },
  );

  console.log('FlashSwap contract deployed at:', contract.address);

  return contract;
}

export async function deployFlashMaliciousContract(
  userProvider: Provider,
  poolAddress: string,
  registryAddress: string,
) {
  console.log('Deploying Malicious Flash Swap Contract...');

  const flashSwapByteCode = getScByteCode('build', 'MaliciousFlash.wasm');

  const constructorArgs = new Args()
    .addString(poolAddress)
    .addString(registryAddress)
    .serialize();

  const contract = await SmartContract.deploy(
    userProvider,
    flashSwapByteCode,
    constructorArgs,
    {
      coins: Mas.fromString('2'),
    },
  );

  console.log('FlashSwap malicious contract deployed at:', contract.address);

  return contract;
}
