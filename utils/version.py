# TradeYantra Version Management
# This file is the single source of truth for version information.
# (TradeYantra is built on OpenAlgo, AGPL-3.0; this tracks the platform build.)

VERSION = "2.0.1.4"


def get_version() -> str:
    """Return the current TradeYantra platform version.

    Returns:
        str: The current version string (e.g. '2.0.0.2')
    """
    return VERSION
