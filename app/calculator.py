from __future__ import annotations

from dataclasses import dataclass

from .schemas import CalcIn, CalcOut, Direction, Market, OptionType, SettlementType, UnderlyingType


@dataclass(frozen=True)
class _Signs:
    premium: float
    intrinsic: float


def _signs(direction: Direction) -> _Signs:
    if direction == Direction.LONG:
        return _Signs(premium=-1.0, intrinsic=+1.0)
    return _Signs(premium=+1.0, intrinsic=-1.0)


def _annualize(amount: float, base: float, days: int) -> float | None:
    if base <= 0 or days <= 0:
        return None
    return (amount / base) * (365.0 / days) * 100.0


def _breakeven(strike: float, premium_per_unit: float, option_type: OptionType) -> float:
    if option_type == OptionType.CALL:
        return strike + premium_per_unit
    return strike - premium_per_unit


def calculate(inp: CalcIn) -> CalcOut:
    days = (inp.expiry_date - inp.valuation_date).days

    # Scaling logic for VIOP FX
    strike_scale = 1.0
    premium_scale = 1.0
    
    # VIOP FX Scaling: 
    # BIST displays USDTRY strike as 44000.0 (meaning 44.0000) or user might enter 44.0
    # BIST displays USDTRY premium as 410.0 (meaning 410 TL per 1 contract of 1000 units)
    
    if inp.market == Market.VIOP and inp.underlying_type == UnderlyingType.FX:
        # Robust strike handling
        if float(inp.strike) > 1000:
            strike_actual = float(inp.strike) / 1000.0
        else:
            strike_actual = float(inp.strike)
            
        # Premium in VIOP FX is "TL per 1 contract" (multiplier units)
        # 1 contract = multiplier units. So per-unit premium = premium_input / multiplier
        premium_per_unit_tl = float(inp.premium_input) / float(inp.contract_multiplier)
        premium_gross_tl = float(inp.premium_input) * float(inp.contracts)
    elif inp.market == Market.VIOP and inp.underlying_type == UnderlyingType.EQUITY:
        # BIST Equity options (e.g. THYAO) usually use direct prices (e.g. 250.0 strike)
        # and premium is also direct (e.g. 5.50 TL)
        strike_actual = float(inp.strike)
        premium_per_unit_tl = float(inp.premium_input)
        premium_gross_tl = premium_per_unit_tl * float(inp.contracts) * float(inp.contract_multiplier)
    else:
        # OTC or other markets
        strike_actual = float(inp.strike)
        premium_per_unit_tl = float(inp.premium_input)
        premium_gross_tl = premium_per_unit_tl * float(inp.contracts) * float(inp.contract_multiplier)

    lot_amount = float(inp.contracts * inp.contract_multiplier)
    notional_tl = lot_amount * strike_actual

    # Commission logic: Based on user screenshot, it's calculated on Notional
    commission_base_tl = notional_tl
    
    commission_rate = float(inp.settings.commission_per_mille) / 1000.0
    commission_total_tl = commission_base_tl * commission_rate * (1.0 + float(inp.settings.bsmv_percent) / 100.0)

    signs = _signs(inp.direction)

    net_option_premium_tl = (signs.premium * premium_gross_tl) - commission_total_tl

    # Nema (Interest) logic: 
    # For deposit equivalent comparison, interest should be earned on the cash used for the position.
    # If SHORT, you receive premium. If LONG, you pay.
    # However, usually interest is calculated on the collateral (Notional or Margin).
    # To match user's previous results, we'll use Notional as the interest base.
    nema_gross_tl = 0.0
    if days > 0:
        nema_gross_tl = notional_tl * (float(inp.interest_rate_percent) / 100.0) * (days / 365.0)

    stopaj = float(inp.settings.stopaj_percent) / 100.0
    nema_net_tl = nema_gross_tl * (1.0 - stopaj)

    net_return_before_settlement_tl = nema_net_tl + net_option_premium_tl

    annual_equiv_net = _annualize(net_return_before_settlement_tl, notional_tl, days)
    annual_equiv_gross = None
    if annual_equiv_net is not None and stopaj < 1.0:
        annual_equiv_gross = annual_equiv_net / (1.0 - stopaj)

    breakeven_price = None
    breakeven_ex_interest_price = None
    if lot_amount > 0:
        # BE based on net premium including commission and interest
        # For a Short Put, BE = Strike - NetPremiumPerUnit
        # The _breakeven function handles the +/- based on CALL/PUT
        per_unit_net = abs(net_return_before_settlement_tl) / lot_amount
        breakeven_price = _breakeven(
            strike=strike_actual,
            premium_per_unit=per_unit_net,
            option_type=inp.option_type
        )
        
        per_unit_premium_net = abs(net_option_premium_tl) / lot_amount
        breakeven_ex_interest_price = _breakeven(
            strike=strike_actual,
            premium_per_unit=per_unit_premium_net,
            option_type=inp.option_type
        )

    settlement_cashflow_tl = None
    net_profit_after_settlement_tl = None
    annual_equiv_net_after_settlement = None
    annual_equiv_gross_after_settlement = None

    if inp.settlement_price is not None and lot_amount > 0:
        s = float(inp.settlement_price)
        k = strike_actual
        intrinsic_per_unit = 0.0
        if inp.option_type == OptionType.CALL:
            intrinsic_per_unit = max(s - k, 0.0)
        else:
            intrinsic_per_unit = max(k - s, 0.0)

        settlement_cashflow_tl = signs.intrinsic * intrinsic_per_unit * lot_amount
        
        # Physical settlement adjustment: 
        # For physical, the cash flow isn't "received" but the asset is exchanged.
        # However, the profit/loss calculation remains the same in terms of value.
        # We will keep settlement_cashflow_tl as the value of the settlement.
        
        net_profit_after_settlement_tl = net_return_before_settlement_tl + settlement_cashflow_tl

        annual_equiv_net_after_settlement = _annualize(net_profit_after_settlement_tl, notional_tl, days)
        if annual_equiv_net_after_settlement is not None and stopaj < 1.0:
            annual_equiv_gross_after_settlement = annual_equiv_net_after_settlement / (1.0 - stopaj)

    return CalcOut(
        days_to_expiry=days,
        lot_amount=lot_amount,
        notional_tl=notional_tl,
        premium_per_unit_tl=premium_per_unit_tl,
        premium_gross_tl=premium_gross_tl,
        commission_base_tl=commission_base_tl,
        commission_total_tl=commission_total_tl,
        nema_gross_tl=nema_gross_tl,
        nema_net_tl=nema_net_tl,
        net_option_premium_tl=net_option_premium_tl,
        net_return_before_settlement_tl=net_return_before_settlement_tl,
        annual_equiv_net_percent=annual_equiv_net,
        annual_equiv_gross_percent=annual_equiv_gross,
        breakeven_price_tl=breakeven_price,
        breakeven_ex_interest_price_tl=breakeven_ex_interest_price,
        settlement_cashflow_tl=settlement_cashflow_tl,
        net_profit_after_settlement_tl=net_profit_after_settlement_tl,
        annual_equiv_net_after_settlement_percent=annual_equiv_net_after_settlement,
        annual_equiv_gross_after_settlement_percent=annual_equiv_gross_after_settlement,
    )
