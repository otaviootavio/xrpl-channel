/*
 * Create, claim and verify a Payment Channel.
 * Reference: https://xrpl.org/paychannel.html
 */

// Import the request and response types for channel_verify
import { Client, type PaymentChannelClaim, type Wallet } from "xrpl";
import { verifyPaymentChannelClaim } from "./payee/verifyPaymentChannelClaim";
import { validateChannel } from "./payee/validateChannel";
import { claimPaymentChannel } from "./payee/claimPaymentChannel";
import { closePaymentChannel } from "./payee/closePaymentChannel";

// Use a direct HTTP endpoint for raw JSON-RPC calls

/**
 * Create a payee object with payment channel related functions
 */
export function createPayee(client: Client, wallet: Wallet) {
  // Function to check channel status

  return {
    /**
     * Validate a payment channel's parameters
     * @param channelId - The ID of the payment channel to validate
     * @param payerClassicAddress - The classic address of the payer
     * @param expectedAmount - The expected amount of the payment channel
     * @param minExpectedSettleDelay - The minimum expected settle delay of the payment channel
     * @param cancelAfter - The cancel after time of the payment channel
     */
    validateChannel: async ({
      channelId,
      payerClassicAddress,
      expectedAmount,
      minSettleDelay,
      minCancelAfter,
      minExpiration,
    }: {
      channelId: string;
      payerClassicAddress: string;
      expectedAmount: string;
      minSettleDelay: number;
      minCancelAfter?: number;
      minExpiration?: number;
    }) => {
      return validateChannel({
        channelId,
        payerClassicAddress,
        expectedAmount,
        minSettleDelay,
        minCancelAfter,
        minExpiration,
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
      amount,
      payerClassicAddress,
    }: {
      channelId: string;
      signature: string;
      publicKey: string;
      amount: string;
      payerClassicAddress: string;
    }) => {
      return verifyPaymentChannelClaim({
        channelId,
        amount,
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
    closePaymentChannel: async ({
      channelId,
    }: {
      channelId: string;
    }): Promise<void> => {
      return closePaymentChannel({
        channelId,
        wallet,
        client,
      });
    },
  };
}
