#!/usr/bin/env python3
"""Price a project two ways and build three packages from the result.

    python3 pricing.py --hours 45 --rate 50 --monthly-benefit 1475 \\
        --services-cost 60 --support 400

Cost floor   = hours x rate x (1 + buffer)
Value band   = 10% to 30% of the client's yearly benefit
The main package sits inside the value band and never below the cost floor.
When the floor is above the band the project does not pay back as scoped,
and the script says so instead of producing a price.
"""
import argparse
import json
import math
import sys


def to_step(value, step=50):
    return int(round(value / float(step)) * step)


def up_to_step(value, step=50):
    return int(math.ceil(value / float(step)) * step)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--hours", type=float, required=True, help="часов работы над проектом")
    parser.add_argument("--rate", type=float, required=True, help="ваша ставка в час")
    parser.add_argument("--monthly-benefit", type=float, required=True, help="выгода клиента в месяц, согласованная с ним")
    parser.add_argument("--buffer", type=float, default=30, help="запас на правки и общение, %%")
    parser.add_argument("--services-cost", type=float, default=0, help="расходы клиента на сервисы в месяц")
    parser.add_argument("--support", type=float, default=0, help="поддержка в месяц")
    parser.add_argument("--price", type=float, default=None, help="своя цена основного пакета вместо расчётной")
    args = parser.parse_args()

    if args.monthly_benefit <= 0 or args.hours <= 0 or args.rate <= 0:
        raise SystemExit("hours, rate и monthly-benefit должны быть больше нуля")

    annual = args.monthly_benefit * 12
    floor = args.hours * args.rate * (1 + args.buffer / 100.0)
    low, high = annual * 0.10, annual * 0.30
    warnings = []

    if args.price is not None:
        main_price = args.price
    elif floor > high:
        main_price = floor
        warnings.append(
            "Себестоимость (%d) выше 30%% годовой выгоды клиента (%d). В таком объёме проект "
            "окупается плохо: сократите объём до одного процесса или пересчитайте выгоду." % (floor, high)
        )
    else:
        main_price = max(floor, (low + high) / 2.0)

    # Rounding must never push a price that sits on the floor below it.
    main_price = to_step(main_price) if args.price is not None else max(to_step(main_price), up_to_step(min(main_price, floor)))
    start = to_step(max(main_price * 0.55, floor * 0.6))
    full = to_step(main_price * 2.2)
    payback = main_price / args.monthly_benefit
    first_year_net = annual - main_price - args.services_cost * 12 - args.support * 11
    effective_rate = main_price / args.hours

    if main_price < floor:
        warnings.append("Цена ниже себестоимости: вы работаете в минус.")
    if payback > 6:
        warnings.append("Окупаемость больше 6 месяцев: клиенту будет трудно согласовать.")
    if first_year_net <= 0:
        warnings.append("За первый год клиент не выходит в плюс с учётом сервисов и поддержки.")
    if args.support and args.support > args.monthly_benefit * 0.4:
        warnings.append("Поддержка забирает больше 40% месячной выгоды клиента.")

    print(json.dumps({
        "annual_benefit": round(annual),
        "cost_floor": round(floor),
        "value_band": {"low": round(low), "high": round(high)},
        "packages": {
            "start": {"price": start, "idea": "один процесс, один канал, поддержка 14 дней"},
            "main": {"price": main_price, "idea": "согласованный объём, обучение, поддержка 30 дней"},
            "full": {"price": full, "idea": "основной + отчёт руководителю + поддержка 90 дней"},
        },
        "payback_months": round(payback, 1),
        "client_first_year_net": round(first_year_net),
        "your_effective_rate": round(effective_rate),
        "payment": {"upfront": up_to_step(main_price / 2.0), "on_launch": main_price - up_to_step(main_price / 2.0)},
        "warnings": warnings,
        "note": "Множители пакетов (0,55 и 2,2) — отправная точка. Меняйте объём пакетов, а не только цену.",
    }, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
