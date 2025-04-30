import type { Client, Wallet } from "xrpl";
import { getAccountBalance } from "./getAccountBalance";

// Function to print account balances
export async function printAccountBalances({
  wallet1,
  wallet2,
  client,
}: {
  wallet1: Wallet;
  wallet2: Wallet;
  client: Client;
}): Promise<void> {
  console.log(
    `Balance of ${wallet1.address} is ${await getAccountBalance({
      address: wallet1.address,
      client: client,
    })} XRP`
  );
  console.log(
    `Balance of ${wallet2.address} is ${await getAccountBalance({
      address: wallet2.address,
      client: client,
    })} XRP`
  );
}
