"""Verified public data sources and M0 scope configuration.

All URLs below were checked against live Electricity Authority endpoints on
2026-11-23. No API keys or paid services are used.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date as date_type

EA_BLOB_BASE = "https://emidatasets.blob.core.windows.net/publicdata"
EMI_BASE = "https://www.emi.ea.govt.nz"

FINAL_DAILY_BLOB = (
    EA_BLOB_BASE
    + "/Datasets/Wholesale/DispatchAndPricing/FinalEnergyPrices/{date:%Y%m%d}_FinalEnergyPrices.csv"
)
FINAL_MONTHLY_BLOB = (
    EA_BLOB_BASE
    + "/Datasets/Wholesale/DispatchAndPricing/FinalEnergyPrices/ByMonth/{month:%Y%m}_FinalEnergyPrices.csv"
)
INTERIM_DAILY_EMI = (
    "https://emi.ea.govt.nz/Wholesale/Datasets/DispatchAndPricing/FinalEnergyPrices/"
    "{date:%Y%m%d}_FinalEnergyPrices_I.csv"
)
SINGLE_NODE_REPORT = EMI_BASE + "/Wholesale/Download/DataReport/CSV/CLA3WR"
NSP_TABLE_BLOB = (
    EA_BLOB_BASE
    + "/Datasets/Wholesale/MappingsAndGeospatial/NetworkSupplyPointsTable/"
    "{date:%Y%m%d}_NetworkSupplyPointsTable.csv"
)

ATTRIBUTION = "www.emi.ea.govt.nz provided by the Electricity Authority (New Zealand)"
LICENCE = "CC BY 4.0 International"

HISTORY_START = date_type(2023, 11, 1)
HISTORY_END = date_type(2026, 11, 22)

# Representative GXP price codes are absent from the NSP POC table. These are
# official NSP records for the same named substations, used only as clearly
# labelled site-level coordinate proxies — never as invented GXP coordinates.
REPRESENTATIVE_COORDINATE_PROXIES = {
    "OTA2201": "OTA0221",
    "HAY2201": "HAY0331",
    "ISL2201": "ISL0331",
}

PRICE_COLUMNS = {
    "TradingDate": "trading_date",
    "TradingPeriod": "trading_period",
    "PointOfConnection": "node",
    "DollarsPerMegawattHour": "price_nzd_per_mwh",
}

REPORT_COLUMNS = {
    "Point of connection": "node",
    "Trading date": "trading_date",
    "Trading period": "trading_period",
    "$/MWh": "price_nzd_per_mwh",
    "Price status": "price_status",
}


@dataclass(frozen=True)
class Node:
    code: str
    label: str
    area: str
    island: str

    @property
    def is_reference_node(self) -> bool:
        return self.area in {"North Island", "South Island"}


REPRESENTATIVE_NODES: tuple[Node, ...] = (
    Node("OTA2201", "Otahuhu", "Auckland", "NI"),
    Node("HAY2201", "Haywards", "Wellington", "NI"),
    Node("ISL2201", "Islington", "Christchurch", "SI"),
    Node("OTA2201", "Otahuhu", "North Island", "NI"),
    Node("ISL2201", "Islington", "South Island", "SI"),
)

UNIQUE_REPRESENTATIVE_NODES: tuple[Node, ...] = (
    REPRESENTATIVE_NODES[0],
    REPRESENTATIVE_NODES[1],
    REPRESENTATIVE_NODES[2],
)


@dataclass(frozen=True)
class SampleDownload:
    name: str
    url: str
    filename: str
    description: str


def final_daily_url(date) -> str:
    """URL for one day of final energy prices (all nodes)."""
    return FINAL_DAILY_BLOB.format(date=date)


def final_monthly_url(month) -> str:
    """URL for one month of final energy prices (all nodes)."""
    return FINAL_MONTHLY_BLOB.format(month=month)


def interim_daily_url(date) -> str:
    """URL for one day of interim energy prices (EMI, may be short-lived)."""
    return INTERIM_DAILY_EMI.format(date=date)


def single_node_url(date_from, date_to, node: str) -> str:
    """URL for the official single-node report CSV."""
    from urllib.parse import urlencode

    params = {
        "DateFrom": date_from.strftime("%Y%m%d"),
        "DateTo": date_to.strftime("%Y%m%d"),
        "POC": node,
        "_si": "f|0-5-1-2,s|dd,v|5",
    }
    return f"{SINGLE_NODE_REPORT}?{urlencode(params)}"


def nsp_table_url(date) -> str:
    """URL for a dated Network Supply Points mapping table."""
    return NSP_TABLE_BLOB.format(date=date)


SAMPLE_DOWNLOADS: tuple[SampleDownload, ...] = (
    SampleDownload(
        name="final_daily",
        url=final_daily_url(date_type(2026, 11, 19)),
        filename="20261119_FinalEnergyPrices.csv",
        description="One day of final nodal energy prices, all 246 nodes, 48 trading periods.",
    ),
    SampleDownload(
        name="interim_daily",
        url=interim_daily_url(date_type(2026, 11, 22)),
        filename="20261122_FinalEnergyPrices_I.csv",
        description="One day of interim nodal energy prices, before prices are declared final.",
    ),
    SampleDownload(
        name="single_node_report",
        url=single_node_url(date_type(2026, 3, 28), date_type(2026, 3, 28), "OTA2201"),
        filename="single_node_OTA2201_20260328.csv",
        description="Official single-node report with a Price status column and preamble.",
    ),
    SampleDownload(
        name="node_mapping",
        url=nsp_table_url(date_type(2026, 11, 21)),
        filename="20261121_NetworkSupplyPointsTable.csv",
        description="POC-to-region/island mapping used to annotate pricing nodes.",
    ),
)
