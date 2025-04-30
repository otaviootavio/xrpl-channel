import { Client } from "xrpl";

// Function to get account balance
export async function getAccountBalance({address, client}: {address: string, client: Client}): Promise<string> {
  return (await client.getXrpBalance(address)).toString();
}
