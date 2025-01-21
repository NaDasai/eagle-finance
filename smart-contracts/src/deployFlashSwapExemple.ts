import {
  Account,
  Args,
  Mas,
  SmartContract,
  Web3Provider,
} from '@massalabs/massa-web3';
import { getScByteCode } from './utils';

const account = await Account.fromEnv();
const provider = Web3Provider.buildnet(account);

console.log('Deploying FlashSwap Exemple contract...');

const byteCode = getScByteCode('build', 'ExempleFlashSwap.wasm');

// constructr takes pool and regisry address as a parameter
const constructorArgs = new Args()
  .addString('AS128wQRHcdrLxuPZAcr5p4CLbZ3zBJY1asoouCNWskJpkU7fhEPK') // pool address
  .addString('AS1yDijtJ57x9SMbMFVifNFLC8hNnjS1a4hMv7LuQXARvPQHnTbp') // regisrty address
  .serialize();

const contract = await SmartContract.deploy(
  provider,
  byteCode,
  constructorArgs,
  {
    coins: Mas.fromString('2'),
  },
);

console.log('Contract deployed at:', contract.address);

const events = await provider.getEvents({
  smartContractAddress: contract.address,
});

for (const event of events) {
  console.log('Event message:', event.data);
}
