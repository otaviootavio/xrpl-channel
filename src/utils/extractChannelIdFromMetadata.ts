import { isCreatedNode } from "xrpl";
import type { PaymentChannelCreate, TransactionMetadata } from "xrpl";

// Function to extract channel ID from transaction metadata
export function extractChannelIdFromMetadata(
  metadata: TransactionMetadata<PaymentChannelCreate>
): string {
  let channelId = "";

  // Loop through affected nodes to find the created PayChannel
  for (const node of metadata.AffectedNodes) {
    if (
      isCreatedNode(node) &&
      node.CreatedNode.LedgerEntryType === "PayChannel"
    ) {
      // Extract the channel ID (LedgerIndex) from the created PayChannel node
      channelId = node.CreatedNode.LedgerIndex;
      break;
    }
  }

  return channelId;
}
