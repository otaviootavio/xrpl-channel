import type { Client, Wallet } from "xrpl";

// Function to setup wallets
export async function setupWallets(
  client: Client
): Promise<{ wallet1: Wallet; wallet2: Wallet }> {
  const { wallet: wallet1 } = await client.fundWallet();
  const { wallet: wallet2 } = await client.fundWallet();

  return { wallet1, wallet2 };
}
