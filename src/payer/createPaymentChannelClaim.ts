import { signPaymentChannelClaim } from "xrpl";
import type { Wallet } from "xrpl";

export async function createPaymentChannelClaim({
  channelId,
  amount,
  wallet,
}: {
  channelId: string;
  amount: string;
  wallet: Wallet;
}): Promise<string> {
  // Convert drops to XRP for the signPaymentChannelClaim function
  // signPaymentChannelClaim expects the amount in XRP, not drops
  const amountInXRP = (parseInt(amount) / 1000000).toString();

  // Use the signPaymentChannelClaim function from xrpl.js
  const signature = signPaymentChannelClaim(
    channelId,
    amountInXRP,
    wallet.privateKey
  );

  return signature;
}
