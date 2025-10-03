import json
import logging
import os

from solders.keypair import Keypair

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_keypair(file_name: str = "wallet.json") -> Keypair:
    with open(file_name, "r") as f:
        raw = bytes(json.load(f))
    return Keypair.from_bytes(raw)


def save_keypair(keypair: Keypair, file_name: str = "wallet.json") -> None:
    if os.path.exists(file_name):
        logger.info(f"Wallet already exists: {file_name}")
        return
    with open(file_name, "w") as f:
        json.dump(list(bytes(keypair)), f)
    logger.info(f"Wallet saved to {file_name}: {keypair.pubkey()}")


def create_wallet(file_name: str = "wallet.json") -> Keypair:
    if os.path.exists(file_name):
        keypair = load_keypair(file_name)
        logger.info(f"Wallet exists, loaded: {keypair.pubkey()}")
        return keypair
    keypair = Keypair()
    save_keypair(keypair, file_name)
    logger.info(f"Wallet created: {keypair.pubkey()}")
    return keypair


if __name__ == "__main__":
    kp = create_wallet("recipient.json")
    print(kp.pubkey())
