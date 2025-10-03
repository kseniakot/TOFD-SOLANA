import asyncio
import os

from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
from solders.message import MessageV0
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import VersionedTransaction

from airdrop import get_balance
from solana_wallet import load_keypair
from utils import LAMPORTS_PER_SOL, get_rpc_url_from_env


async def transfer_sol(
    rpc_url: str,
    sender: Keypair,
    recipient_pubkey: Pubkey,
    lamports: int,
) -> str:
    async with AsyncClient(rpc_url) as rpc:
        latest_blockhash = await rpc.get_latest_blockhash()

        ix = transfer(
            TransferParams(
                from_pubkey=sender.pubkey(),
                to_pubkey=recipient_pubkey,
                lamports=lamports,
            )
        )

        message = MessageV0.try_compile(
            payer=sender.pubkey(),
            instructions=[ix],
            address_lookup_table_accounts=[],
            recent_blockhash=latest_blockhash.value.blockhash,
        )

        print(f"Fee: {(await rpc.get_fee_for_message(message)).value}")

        tx = VersionedTransaction(message, [sender])

        send_resp = await rpc.send_raw_transaction(bytes(tx))
        signature = send_resp.value

        await rpc.confirm_transaction(signature)
        return signature


async def main():
    rpc_url = get_rpc_url_from_env()
    file_name = "wallet.json"
    try:
        sender = load_keypair(file_name)
    except FileNotFoundError:
        raise FileNotFoundError(f"Wallet not found: {file_name}")

    recipient_env = os.getenv("RECIPIENT_PUBKEY")
    if not recipient_env:
        raise ValueError(f"Recipient not found: {recipient_env}")

    recipient = Pubkey.from_string(recipient_env)
    lamports = 2 * LAMPORTS_PER_SOL

    print(f"Sender: {sender.pubkey()}")
    print(f"Recipient: {recipient}")
    print(f"Sender balance: {get_balance(rpc_url, sender.pubkey())} SOL")
    print(f"Recipient balance: {get_balance(rpc_url, recipient)} SOL")
    print(f"Amount: {lamports / LAMPORTS_PER_SOL} SOL")

    sig = await transfer_sol(
        rpc_url, sender, Pubkey.from_string(str(recipient)), lamports
    )
    print(f"Signature: {sig}")
    print(f"Sender balance: {get_balance(rpc_url, sender.pubkey())} SOL")
    print(f"Recipient balance: {get_balance(rpc_url, recipient)} SOL")


if __name__ == "__main__":
    asyncio.run(main())
