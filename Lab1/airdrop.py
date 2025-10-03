import logging

from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed
from solders.pubkey import Pubkey

from solana_wallet import load_keypair
from utils import LAMPORTS_PER_SOL, get_rpc_url_from_env
from utils import get_balance

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def request_airdrop(rpc_url: str, pubkey: Pubkey, amount: int) -> str:
    client = Client(rpc_url)
    commitment = Confirmed
    logger.info(f"Requesting airdrop of {amount} lamports...")
    signature = client.request_airdrop(pubkey, amount).value
    logger.info(f"Airdrop request submitted with signature: {signature}")
    logger.info("Waiting for transaction confirmation...")
    client.confirm_transaction(signature, commitment)
    logger.info("Airdrop confirmed successfully!")
    return signature


if __name__ == "__main__":
    keypair = load_keypair("wallet.json")
    print(keypair.pubkey())
    print(
        f"Balance before airdrop: {get_balance(get_rpc_url_from_env(), keypair.pubkey()) / LAMPORTS_PER_SOL} SOL"
    )
    request_airdrop(get_rpc_url_from_env(), keypair.pubkey(), 10 * LAMPORTS_PER_SOL)
