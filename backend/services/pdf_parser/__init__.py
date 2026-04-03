"""
PDF parser factory. Returns the correct bureau adapter by name.
Adapters are implemented in experian.py, equifax.py, transunion.py (Plan 03).
"""
from services.pdf_parser.base import BureauParser


def get_parser(bureau: str) -> BureauParser:
    """Return the correct bureau parser. Raises ValueError for unknown bureau."""
    # Import here to avoid circular imports when adapters aren't created yet
    bureau = bureau.lower().strip()
    if bureau == "experian":
        from services.pdf_parser.experian import ExperianParser
        return ExperianParser()
    elif bureau == "equifax":
        from services.pdf_parser.equifax import EquifaxParser
        return EquifaxParser()
    elif bureau == "transunion":
        from services.pdf_parser.transunion import TransUnionParser
        return TransUnionParser()
    else:
        raise ValueError(f"Unknown bureau: {bureau!r}. Must be experian, equifax, or transunion.")
