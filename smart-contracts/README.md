# eagle-finance

## Introduction

**eagle-finance** is a decentralized finance (DeFi) protocol built on the Massa blockchain, providing a platform for automated liquidity provision and token swapping. This project consists of smart contracts implemented using AssemblyScript, offering efficient and secure trading capabilities for MRC-20 tokens. The core components are:

- **Basic Pool:** A smart contract that enables users to add liquidity and swap two MRC-20 tokens.
- **Registry:** A smart contract that manages the deployment and storage of different liquidity pools.
- **MRC-20 Token:** A standard token contract based on Massa's MRC-20 specification.

**IMPORTANT:** This implementation **ONLY supports MRC-20 tokens**. To use native MAS coins, they must be wrapped into an MRC-20 token (e.g., WMAS) using a separate wrapping contract.

## Project Structure

The project is structured as follows:

- `contracts/`: Contains the source code for all smart contracts and related libraries.
  - `basicPool.ts`: Implements the core logic for a liquidity pool.
  - `registry.ts`: Manages pool deployments and configurations.
  - `mrc20.ts`: Provides a basic MRC-20 token implementation.
  - `lib/`: Contains core libraries and logic for the contracts
    - `basicPoolMath.ts`: Implements mathematical functions for calculating swaps and fees in the basic pool.
    - `liquidityManager.ts`: Manages liquidity and token balances within the contracts.
    - `math.ts`: Provides mathematical utility functions for the contracts.
    - `safeMath.ts`: Implements safe mathematical operations for preventing overflows and underflows.
  - `interfaces/`: Provides the interfaces for all smart contracts.
    - `IBasicPool.ts`: Defines the interface for the basic pool contract.
    - `IMRC20.ts`: Defines the interface for the MRC-20 token contract.
    - `IRegistry.ts`: Defines the interface for the registry contract.
  - `structs/`: Contains data structures
    - `pool.ts`: defines the structure of a pool object
  - `utils/`: Contains utility functions for the contracts
    - `index.ts`: export all the utility files in this folder
    - `ownership-internal.ts`: Implements internal functions for ownership management.
    - `ownership.ts`: Implements external functions for ownership management
- `build/`: Contains compiled WASM files.
  - `basicPool.wasm`: The compiled WASM for the Basic Pool contract.
  - `registry.wasm`: The compiled WASM for the Registry contract.
  - `mrc20.wasm`: The compiled WASM for the MRC-20 token contract.

## Smart Contracts Overview

### 1. Basic Pool (`basicPool.ts`)

This contract implements a liquidity pool for trading two MRC-20 tokens. It allows users to:

- **Add Liquidity:** Provide tokens A and B to the pool, receiving LP tokens in return.
- **Remove Liquidity:** Burn LP tokens to retrieve tokens A and B.
- **Swap:** Exchange tokens A for B or vice-versa based on the current pool reserves.
- **Claim Protocol Fees:** Collect accumulated fees that are reserved for the protocol.
- **Get Swap Estimation**: get the estimation for the swap before executing it.
- **Synchronize Reserves**: syncs the reserves of the pool with the current balances of the tokens.
- **Get the LP Balance of a user**: Get the balance of LP tokens of a user in the contract.
- **Get the local reserve of A**: returns the reserve of the token A in the pool.
- **Get the local reserve of B**: returns the reserve of the token B in the pool.
- **Get the Price of A in term of B**: Returns the price of token A in terms of token B (reserveB/reserveA).

**Key Features:**

- **MRC-20 Support:** Designed to work exclusively with MRC-20 tokens.
- **Fee Structure:** Implements a swap fee that's split between liquidity providers and protocol.
- **Dynamic Reserve**: Reserves are automatically updated after each transaction to keep track of the balance of the pool.
- **Initial Liquidity:** Calculation of initial liquidity using the square root of the product of initial token deposits.
- **Proportional Liquidity Addition:** Adding liquidity proportionally based on the existing reserves.
- **LP Token Management:** Uses the LiquidityManager contract for minting and burning LP tokens.
- **Protocol fee receiver**: The protocol fees can be claimed by the protocol fee receiver defined in the registry.

**Constructor Arguments:**

- `aAddress` (string): The address of token A.
- `bAddress` (string): The address of token B.
- `feeRate` (f64): The trading fee rate, between 0 and 1.
- `feeShareProtocol` (f64): The protocol's share of the trading fee, between 0 and 1.
- `registryAddress` (string): The address of the registry contract.

**Public Functions:**

- `constructor(binaryArgs: StaticArray<u8>): void`: Constructor for the pool.
- `addLiquidity(binaryArgs: StaticArray<u8>): void`: Adds liquidity to the pool.
- `swap(binaryArgs: StaticArray<u8>): void`: Swaps tokens in the pool.
- `claimProtocolFees(): void`: Claims accumulated protocol fees.
- `removeLiquidity(binaryArgs: StaticArray<u8>): void`: Removes liquidity from the pool.
- `getSwapOutEstimation(binaryArgs: StaticArray<u8>): StaticArray<u8>`: Retrieves the swap estimation for a given input amount.
- `syncReserves(): void`: Synchronizes the reserves of the pool with the current balances of the tokens.
- `getLPBalance(binaryArgs: StaticArray<u8>): StaticArray<u8>`: Retrieves the balance of the LP token for a given user.
- `getLocalReserveA(): StaticArray<u8>`: Retrieves the local reserve of token A.
- `getLocalReserveB(): StaticArray<u8>`: Retrieves the local reserve of token B.
- `getPrice(): StaticArray<u8>`: Retrieves the price of token A in terms of token B.

### 2. Registry (`registry.ts`)

The registry contract is responsible for managing and deploying liquidity pools. It provides functionalities to:

- **Create New Pool:** Deploy a new basic pool with specified tokens and fee rates.
- **Get Pools:** Retrieve an array containing all registered pools.
- **Set Protocol Fee Receiver**: Sets the receiver of the protocol fees.
- **Get Protocol Fee Receiver**: Gets the receiver of the protocol fees.
- **Get protocol fee share**: Returns the protocol fee share.

**Key Features:**

- **Pool Management:** Manages the creation and storage of liquidity pool contracts.
- **Fee Configuration:** Sets the default protocol fee share for all pools.
- **Security**: Only the owner of the contract can perform sensitive actions.

**Constructor Arguments:**

- `feeShareProtocol` (f64): The protocol's default share of the trading fee, between 0 and 1.

**Public Functions:**

- `constructor(binaryArgs: StaticArray<u8>): void`: Constructor for the registry.
- `createNewPool(binaryArgs: StaticArray<u8>): void`: Adds a new pool to the registry.
- `getPools(): StaticArray<u8>`: Retrieves all pools in the registry.
- `getFeeShareProtocol(): StaticArray<u8>`: Get the fee share protocol.
- `getFeeShareProtocolReceiver(): StaticArray<u8>`: Get the fee share protocol receiver.
- `setFeeShareProtocolReceiver(binaryArgs: StaticArray<u8>): void`: Set the fee share protocol receiver.

### 3. MRC-20 Token (`mrc20.ts`)

This contract implements a standard MRC-20 token, providing functionalities to:

- **Basic Token Functions**: It provides the basic mrc20 token functionalities (mint, burn, transfer, allowance etc...).
- **Token Metadata**: It provides function to get the token url and description.

**Key Features:**

- **MRC-20 Compliant:** Implements the standard MRC-20 token interface.
- **Metadata**: It contains function to get the token url and description.

**Constructor Arguments:**

- `tokenName` (string): The name of the token.
- `tokenSymbol` (string): The symbol of the token.
- `decimals` (u8): The number of decimals the token uses.
- `totalSupply` (u256): The total supply of the token.
- `url` (string) (optional): The URL of the token.
- `description` (string) (optional): The description of the token.

**Public Functions:**

- `constructor(binaryArgs: StaticArray<u8>): void`: Constructor for the MRC-20 token.
- `url(_: StaticArray<u8>): StaticArray<u8>`: Returns the token URL.
- `description(_: StaticArray<u8>): StaticArray<u8>`: Returns the token description.

## Libraries

### Basic Pool Math (`lib/basicPoolMath.ts`)

This library provides essential math functions for calculating swaps, fees, and liquidity within the Basic Pool contract. It includes functions for:

- **`getInputAmountNet(inputAmount: u256, feeRate: f64): u256`**: Calculates the net input amount after applying the fee.
- **`getFeeFromAmount(inputAmount: u256, feeRate: f64): u256`**: Calculates the fee amount based on the input amount and fee rate.
- **`getAmountOut(inputAmount: u256, inputReserve: u256, outputReserve: u256): u256`**: Calculates the output amount based on the input amount and reserves.

### Liquidity Manager (`lib/liquidityManager.ts`)

This library manages the liquidity and token balances across different contracts. It handles:

- **Minting:** Creation of new LP tokens.
- **Burning:** Destruction of LP tokens.
- **Transferring:** Transfer of LP tokens between users.
- **Allowances:** Management of token allowances for spending on behalf of others.

### Math (`lib/math.ts`)

This library contains mathematical utility functions:

- **`f64ToU256(value: f64, decimals: i32 = DEFAULT_DECIMALS): u256`**: Converts a float64 to a u256 with a specified number of decimals.
- **`normalizeToDecimals(value: u256, currentDecimals: i32, toDecimals: i32 = DEFAULT_DECIMALS): u256`**: Normalizes a number to a specific number of decimals.
- **`isBetweenZeroAndOne(value: f64): bool`**: Checks if a float64 value is between 0 and 1.

### Safe Math (`lib/safeMath.ts`)

This library ensures safe mathematical operations, preventing overflows and underflows:

- **`add(a: u256, b: u256): u256`**: Safe addition of two u256 numbers.
- **`sub(a: u256, b: u256): u256`**: Safe subtraction of two u256 numbers.
- **`mul(a: u256, b: u256): u256`**: Safe multiplication of two u256 numbers.
- **`div(a: u256, b: u256): u256`**: Safe division of two u256 numbers.
  - **`sqrt(y: u256): u256`**: Calculate the square root of a u256.

## Getting Started

To start using or contributing to the project:

1.  **Clone the Repository:** Clone this repository to your local machine.
2.  **Install dependencies**: run `npm install` in the root folder
3.  **Compile the Contracts:** Use the AssemblyScript compiler to compile the contracts into WASM files.
4.  **Deploy:** Deploy the WASM contracts to the Massa blockchain.
5.  **Interact:** Use Massa's SDK or CLI to interact with the deployed contracts.

## License

This project is licensed under the [License Name] license.

## Disclaimer

This is a work in progress. Use at your own risk. The code may contain bugs. Always test on testnet before deploying to mainnet.
