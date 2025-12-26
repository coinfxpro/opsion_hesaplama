from __future__ import annotations

from datetime import date
from enum import Enum
from pydantic import BaseModel, Field, model_validator


class Market(str, Enum):
    VIOP = "VIOP"
    OTC = "TEZGAHUSTU"


class UnderlyingType(str, Enum):
    EQUITY = "EQUITY"
    FX = "FX"


class OptionType(str, Enum):
    CALL = "CALL"
    PUT = "PUT"


class Direction(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class SettingsIn(BaseModel):
    commission_per_mille: float = Field(5.0, ge=0)
    bsmv_percent: float = Field(5.0, ge=0)
    stopaj_percent: float = Field(17.5, ge=0, le=100)
    fx_premium_scale: float = Field(0.01, gt=0)


class CalcIn(BaseModel):
    market: Market

    underlying: str = Field(min_length=1)
    underlying_type: UnderlyingType

    valuation_date: date
    expiry_date: date

    spot: float = Field(gt=0)
    strike: float = Field(gt=0)

    option_type: OptionType
    direction: Direction

    contracts: int = Field(gt=0)
    contract_multiplier: int = Field(gt=0)

    premium_input: float = Field(ge=0)
    interest_rate_percent: float = Field(ge=0)

    settlement_price: float | None = Field(default=None, gt=0)

    settings: SettingsIn = Field(default_factory=SettingsIn)

    @model_validator(mode="after")
    def _validate_dates(self):
        if self.expiry_date < self.valuation_date:
            raise ValueError("expiry_date valuation_date'ten küçük olamaz")
        return self


class CalcOut(BaseModel):
    days_to_expiry: int

    lot_amount: float
    notional_tl: float

    premium_per_unit_tl: float
    premium_gross_tl: float

    commission_base_tl: float
    commission_total_tl: float

    nema_gross_tl: float
    nema_net_tl: float

    net_option_premium_tl: float
    net_return_before_settlement_tl: float

    annual_equiv_net_percent: float | None
    annual_equiv_gross_percent: float | None

    breakeven_price_tl: float | None
    breakeven_ex_interest_price_tl: float | None

    settlement_cashflow_tl: float | None
    net_profit_after_settlement_tl: float | None

    annual_equiv_net_after_settlement_percent: float | None
    annual_equiv_gross_after_settlement_percent: float | None
