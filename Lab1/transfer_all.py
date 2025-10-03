import asyncio
import logging
import os

from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.message import MessageV0
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import VersionedTransaction

from solana_wallet import load_keypair
from utils import get_rpc_url_from_env, get_balance, LAMPORTS_PER_SOL


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def transfer_all_lamports(
    rpc_url: str,
    sender: Keypair,
    recipient_pubkey: Pubkey,
) -> str:
    async with AsyncClient(rpc_url) as rpc:
        balance_resp = await rpc.get_balance(sender.pubkey())
        lamports = balance_resp.value
        if lamports <= 0:
            raise ValueError("Sender has zero lamports")

        latest_blockhash = await rpc.get_latest_blockhash()

        fee_probe_ix = transfer(
            TransferParams(
                from_pubkey=sender.pubkey(),
                to_pubkey=recipient_pubkey,
                lamports=1,
            )
        )
        fee_probe_msg = MessageV0.try_compile(
            payer=sender.pubkey(),
            instructions=[fee_probe_ix],
            address_lookup_table_accounts=[],
            recent_blockhash=latest_blockhash.value.blockhash,
        )

        fee_lamports = 5000
        try:
            fee_resp = await rpc.get_fee_for_message(fee_probe_msg)
            if getattr(fee_resp, "value", None) is not None:
                fee_lamports = int(fee_resp.value)
        except Exception:
            pass
        logger.info(f"Fee lamports: {fee_lamports}")
        logger.info(f"Sender balance: {lamports}")
        send_lamports = lamports - fee_lamports
        logger.info(f"Total amount of lamports to send: {send_lamports}")
        if send_lamports <= 0:
            raise ValueError("Balance is not enough to cover transaction fee")

        ix = transfer(
            TransferParams(
                from_pubkey=sender.pubkey(),
                to_pubkey=recipient_pubkey,
                lamports=send_lamports,
            )
        )

        message = MessageV0.try_compile(
            payer=sender.pubkey(),
            instructions=[ix],
            address_lookup_table_accounts=[],
            recent_blockhash=latest_blockhash.value.blockhash,
        )

        tx = VersionedTransaction(message, [sender])

        send_resp = await rpc.send_raw_transaction(bytes(tx))
        signature = send_resp.value
        await rpc.confirm_transaction(signature)
        return signature


async def main():
    rpc_url = get_rpc_url_from_env()
    try:
        sender = load_keypair("wallet.json")
    except FileNotFoundError:
        sender = Keypair()

    recipient_env = os.getenv("RECIPIENT_PUBKEY")
    recipient = (
        Pubkey.from_string(recipient_env) if recipient_env else Keypair().pubkey()
    )

    print(f"Sender: {sender.pubkey()}")
    print(
        f"Sender balance: {get_balance(rpc_url, sender.pubkey()) / LAMPORTS_PER_SOL} SOL"
    )
    print(
        f"Recipient balance: {get_balance(rpc_url, recipient) / LAMPORTS_PER_SOL} SOL"
    )
    print(f"Recipient: {recipient}")
    sig = await transfer_all_lamports(
        rpc_url, sender, Pubkey.from_string(str(recipient))
    )
    print(f"Signature: {sig}")
    print(
        f"Sender balance: {get_balance(rpc_url, sender.pubkey()) / LAMPORTS_PER_SOL} SOL"
    )
    print(
        f"Recipient balance: {get_balance(rpc_url, recipient) / LAMPORTS_PER_SOL} SOL"
    )


if __name__ == "__main__":
    asyncio.run(main())
