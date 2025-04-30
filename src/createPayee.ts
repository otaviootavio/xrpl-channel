/*
 * Create, claim and verify a Payment Channel.
 * Reference: https://xrpl.org/paychannel.html
 */

// Import the request and response types for channel_verify
import { Client, type PaymentChannelClaim, type Wallet } from "xrpl";
import { verifyPaymentChannelClaim } from "./payee/verifyPaymentChannelClaim";
import { validateChannel } from "./payee/validateChannel";
import { claimPaymentChannel } from "./payee/claimPaymentChannel";

// Use a direct HTTP endpoint for raw JSON-RPC calls

/**
 * Create a payee object with payment channel related functions
 */
export function createPayee(client: Client, wallet: Wallet) {
  // Function to check channel status

  return {
    /**
     * Validate a payment channel's parameters
     */
    validateChannel: async ({
      channelId,
      payerClassicAddress,
      expectedAmount,
      minSettleDelay,
    }: {
      channelId: string;
      payerClassicAddress: string;
      expectedAmount: string;
      minSettleDelay: number;
    }) => {
      return validateChannel({
        channelId,
        payerClassicAddress,
        expectedAmount,
        minSettleDelay,
        client,
        wallet,
      });
    },
    /**
     * Verify a payment channel claim
     */
    verifyPaymentChannelClaim: async ({
      channelId,
      signature,
      publicKey,
      xrpAmount,
      payerClassicAddress,
    }: {
      channelId: string;
      signature: string;
      publicKey: string;
      xrpAmount: string;
      payerClassicAddress: string;
    }) => {
      return verifyPaymentChannelClaim({
        channelId,
        xrpAmount,
        signature,
        publicKey,
        client,
        wallet,
        payerClassicAddress,
      });
    },

    /**
     * Claim XRP from a payment channel
     */
    claimPaymentChannel: ({
      amount,
      channelId,
      payerClassicAddress,
      payerPublicKey,
      signature,
    }: {
      amount: string;
      channelId: string;
      payerClassicAddress: string;
      payerPublicKey: string;
      signature: string;
    }) => {
      return claimPaymentChannel({
        amount,
        channelId,
        payerClassicAddress,
        payerPublicKey,
        signature,
        client,
        wallet,
      });
    },

    /**
     * Close a payment channel
     */
    closePaymentChannel: async (params: {
      channelId: string;
    }): Promise<void> => {
      const { channelId } = params;

      // Request to close the channel immediately
      const closeChannelTx: PaymentChannelClaim = {
        Account: wallet.classicAddress,
        TransactionType: "PaymentChannelClaim",
        Channel: channelId,
        Flags: 2147614720, // tfClose flag
      };

      const closeChannelResponse = await client.submitAndWait(closeChannelTx, {
        wallet: wallet,
        autofill: true,
      });
      // console.log("Close channel response:", closeChannelResponse);
    },
  };
}
