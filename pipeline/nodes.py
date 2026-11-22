"""Pricing-node annotation with explicit handling of unmapped GXP codes."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .config import UNIQUE_REPRESENTATIVE_NODES

MANUAL_NODE_OVERRIDES: dict[str, dict[str, str]] = {
    node.code: {
        "label": node.label,
        "region": node.area,
        "island": "NI" if node.island == "NI" else "SI",
        "mapping_status": "manual_override",
    }
    for node in UNIQUE_REPRESENTATIVE_NODES
}


@dataclass(frozen=True)
class NodeMeta:
    label: str
    region: str
    island: str
    mapping_status: str


def load_node_mapping(path: Path) -> dict[str, NodeMeta]:
    """Read the latest current rows of the official NSP table."""
    mapping: dict[str, NodeMeta] = {}
    with Path(path).open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            if row.get("Current flag") != "1":
                continue
            code = (row.get("POC code") or "").strip()
            if not code or code in mapping:
                continue
            mapping[code] = NodeMeta(
                label=(row.get("Description") or code).strip(),
                region=(row.get("Network reporting region") or "Unmapped").strip(),
                island=(row.get("Island") or "Unknown").strip(),
                mapping_status="nsp_table",
            )
    for code, override in MANUAL_NODE_OVERRIDES.items():
        mapping[code] = NodeMeta(**override)
    return mapping


def annotate_nodes(frame: pd.DataFrame, mapping: dict[str, NodeMeta]) -> pd.DataFrame:
    """Add node metadata without dropping any pricing records."""
    result = frame.copy()
    labels, regions, islands, statuses = [], [], [], []
    for code in result["node"]:
        meta = mapping.get(
            code,
            NodeMeta(str(code), "Unmapped", "Unknown", "unmatched"),
        )
        labels.append(meta.label)
        regions.append(meta.region)
        islands.append(meta.island)
        statuses.append(meta.mapping_status)
    result["node_label"] = labels
    result["region"] = regions
    result["island"] = islands
    result["mapping_status"] = statuses
    return result
