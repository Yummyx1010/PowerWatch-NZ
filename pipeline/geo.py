"""NZTM2000 inverse projection helpers.

Node coordinates in the Electricity Authority Network Supply Points table are
published as NZTM easting/northing. This module converts them to WGS84-style
latitude/longitude for browser map rendering, using the standard transverse
Mercator inverse series with NZGD2000 / GRS80 constants.
"""

from __future__ import annotations

from math import cos, degrees, radians, sin, sqrt, tan

A = 6_378_137.0
F = 1 / 298.257222101
E2 = F * (2 - F)
E4 = E2**2
E6 = E4 * E2
EP2 = E2 / (1 - E2)
E1 = (1 - sqrt(1 - E2)) / (1 + sqrt(1 - E2))
K0 = 0.9996
FALSE_E = 1_600_000.0
FALSE_N = 10_000_000.0
PHI0 = radians(0.0)
LAMBDA0 = radians(173.0)

_MERIDIONAL_FACTOR = A * (1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256)
M0 = A * (
    (1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256) * PHI0
    - (3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024) * sin(2 * PHI0)
    + (15 * E4 / 256 + 45 * E6 / 1024) * sin(4 * PHI0)
    - (35 * E6 / 3072) * sin(6 * PHI0)
)


def nztm_to_latlon(easting: float, northing: float) -> tuple[float, float]:
    """Return approximate (latitude, longitude) from NZTM2000 metres."""
    m = M0 + (northing - FALSE_N) / K0
    mu = m / _MERIDIONAL_FACTOR
    phi1 = (
        mu
        + (3 * E1 / 2 - 27 * E1**3 / 32) * sin(2 * mu)
        + (21 * E1**2 / 16 - 55 * E1**4 / 32) * sin(4 * mu)
        + (151 * E1**3 / 96) * sin(6 * mu)
        + (1097 * E1**4 / 512) * sin(8 * mu)
    )
    sin_phi1 = sin(phi1)
    cos_phi1 = cos(phi1)
    tan_phi1 = tan(phi1)
    c1 = E2 * cos_phi1**2 / (1 - E2)
    t1 = tan_phi1**2
    n1 = A / sqrt(1 - E2 * sin_phi1**2)
    r1 = A * (1 - E2) / (1 - E2 * sin_phi1**2) ** 1.5
    d = (easting - FALSE_E) / (n1 * K0)

    phi = phi1 - (n1 * tan_phi1 / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * EP2) * d**4 / 24
        + (61 + 90 * t1 + 45 * t1**2 + 252 * c1 - 90 * EP2) * d**6 / 720
    )
    lam = LAMBDA0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * EP2 + 24 * t1**2) * d**5 / 120
    ) / cos_phi1
    return round(degrees(phi), 6), round(degrees(lam), 6)
