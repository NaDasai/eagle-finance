import { Args, Mas, Provider, SmartContract } from '@massalabs/massa-web3';
import { getScByteCode } from '../utils';

export async function deployTokenDeployer(provider: Provider) {
  console.log('Deploying TokenDeployer contract...');

  const byteCode = getScByteCode('build', 'tokenDeployer.wasm');

  // Constructr empty args
  const constructorArgs = new Args().serialize();

  let contract = await SmartContract.deploy(
    provider,
    byteCode,
    constructorArgs,
    {
      coins: Mas.fromString('0.9'),
    },
  );

  console.log('Contract deployed at:', contract.address);

  return contract;
}
