#!/usr/bin/env bash
set -euo pipefail

# Verify compiled contracts on Sourcify using Foundry's verifier integration.
#
# Usage examples:
#   cd contracts
#   CHAIN_ID=33101 FACTORY_ADDRESS=0x... ./scripts/verify-sourcify.sh
#   CHAIN_ID=33101 AIRDROPPER_ADDRESS=0x... ./scripts/verify-sourcify.sh
#   CHAIN_ID=33101 FACTORY_ADDRESS=0x... AIRDROPPER_ADDRESS=0x... ./scripts/verify-sourcify.sh
#
# Optional:
#   RPC_URL=<https rpc> (used by forge if needed)

CHAIN_ID=${CHAIN_ID:-}
RPC_URL=${RPC_URL:-}

if [[ -z "${CHAIN_ID}" ]]; then
  echo "CHAIN_ID is required (e.g. 33101 for Zilliqa EVM Testnet)." >&2
  exit 1
fi

FACTORY_ADDRESS=${FACTORY_ADDRESS:-}
AIRDROPPER_ADDRESS=${AIRDROPPER_ADDRESS:-}

echo "Building artifacts..."
forge build >/dev/null

function verify_one() {
  local address=$1
  local fqname=$2
  echo "Verifying ${fqname} at ${address} on chain ${CHAIN_ID} via Sourcify..."
  if [[ -n "${RPC_URL}" ]]; then
    forge verify-contract --verifier sourcify --chain-id "${CHAIN_ID}" --rpc-url "${RPC_URL}" "${address}" "${fqname}"
  else
    forge verify-contract --verifier sourcify --chain-id "${CHAIN_ID}" "${address}" "${fqname}"
  fi
}

if [[ -n "${FACTORY_ADDRESS}" ]]; then
  verify_one "${FACTORY_ADDRESS}" "src/ForgeTokenFactory.sol:ForgeTokenFactory"
fi

if [[ -n "${AIRDROPPER_ADDRESS}" ]]; then
  verify_one "${AIRDROPPER_ADDRESS}" "src/ForgeAirdropper.sol:ForgeAirdropper"
fi

if [[ -z "${FACTORY_ADDRESS}" && -z "${AIRDROPPER_ADDRESS}" ]]; then
  echo "Nothing to verify. Provide FACTORY_ADDRESS and/or AIRDROPPER_ADDRESS."
fi

