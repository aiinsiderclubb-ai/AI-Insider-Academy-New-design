#!/usr/bin/env python3
"""Arithmetic for a sales call, done by a program so the numbers are not guessed.

Price of the problem:
    python3 deal_math.py cost --tasks 300 --minutes 12 --hourly 15 \\
        --errors 10 --error-cost 40 --lost 40 --conversion 10 --check 200 \\
        --automation-share 75

Qualification score, ten criteria scored 0, 1 or 2 in this order:
pain, volume, repeatability, number, decision_maker, budget, deadline,
systems, past_attempts, next_step
    python3 deal_math.py score --answers 2,1,2,2,1,1,0,2,1,2
"""
import argparse
import json
import sys

CRITERIA = [
    ("pain", "Боль"),
    ("volume", "Объём"),
    ("repeatability", "Повторяемость"),
    ("number", "Цифра проблемы"),
    ("decision_maker", "Лицо, принимающее решение"),
    ("budget", "Бюджет"),
    ("deadline", "Срок"),
    ("systems", "Системы и доступы"),
    ("past_attempts", "Прошлые попытки"),
    ("next_step", "Следующий шаг"),
]


def money(value):
    return round(value, 2)


def cost(args):
    hours = args.tasks * args.minutes / 60.0
    labour = hours * args.hourly
    error_loss = args.errors * args.error_cost
    lost_revenue = args.lost * args.conversion / 100.0 * args.check
    total = labour + error_loss + lost_revenue
    share = args.automation_share / 100.0
    saving = labour * share + error_loss * share + lost_revenue
    notes = []
    if args.tasks < 20:
        notes.append("Меньше 20 задач в месяц: автоматизация обычно не окупается, проверьте объём.")
    if not args.errors and not args.lost:
        notes.append("Учтено только время. Спросите клиента об ошибках и потерянных заявках.")
    if args.automation_share > 85:
        notes.append("Доля автоматизации выше 85% встречается редко — обоснуйте её.")
    return {
        "inputs": vars(args),
        "hours_per_month": round(hours, 1),
        "labour_cost_per_month": money(labour),
        "error_loss_per_month": money(error_loss),
        "lost_revenue_per_month": money(lost_revenue),
        "problem_cost_per_month": money(total),
        "problem_cost_per_year": money(total * 12),
        "hours_saved_per_month": round(hours * share, 1),
        "saving_per_month": money(saving),
        "saving_per_year": money(saving * 12),
        "notes": notes,
    }


def score(args):
    try:
        values = [int(part) for part in args.answers.split(",")]
    except ValueError:
        raise SystemExit("answers: десять чисел 0, 1 или 2 через запятую")
    if len(values) != len(CRITERIA) or any(v not in (0, 1, 2) for v in values):
        raise SystemExit("answers: нужно ровно %d оценок, каждая 0, 1 или 2" % len(CRITERIA))
    total = sum(values)
    if total <= 8:
        band, advice = "не готов", "Не тратьте время на предложение. Договоритесь о дате возврата."
    elif total <= 14:
        band, advice = "пилот", "Предложите пилот на один процесс с фиксированным объёмом."
    else:
        band, advice = "готов", "Полное предложение в течение суток и дата встречи-разбора."
    weakest = [label for (_, label), value in zip(CRITERIA, values) if value == 0]
    blockers = []
    by_key = dict(zip([key for key, _ in CRITERIA], values))
    if by_key["decision_maker"] == 0:
        blockers.append("Неизвестно, кто принимает решение, — выясните до предложения.")
    if by_key["number"] == 0:
        blockers.append("Клиент не назвал цифру проблемы — любая цена покажется высокой.")
    if by_key["next_step"] == 0:
        blockers.append("Нет назначенного следующего шага.")
    return {
        "scores": {label: value for (_, label), value in zip(CRITERIA, values)},
        "total": total,
        "max": len(CRITERIA) * 2,
        "band": band,
        "advice": advice,
        "weakest": weakest,
        "blockers": blockers,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command")

    c = sub.add_parser("cost")
    c.add_argument("--tasks", type=float, required=True, help="задач в месяц")
    c.add_argument("--minutes", type=float, required=True, help="минут на одну задачу")
    c.add_argument("--hourly", type=float, required=True, help="стоимость часа сотрудника")
    c.add_argument("--errors", type=float, default=0, help="ошибок в месяц")
    c.add_argument("--error-cost", type=float, default=0, help="цена одной ошибки")
    c.add_argument("--lost", type=float, default=0, help="потерянных заявок в месяц")
    c.add_argument("--conversion", type=float, default=0, help="конверсия заявки в продажу, %%")
    c.add_argument("--check", type=float, default=0, help="средний чек")
    c.add_argument("--automation-share", type=float, default=75, help="доля, которую снимет автоматизация, %%")

    s = sub.add_parser("score")
    s.add_argument("--answers", required=True, help="десять оценок через запятую")

    args = parser.parse_args()
    if args.command == "cost":
        result = cost(args)
    elif args.command == "score":
        result = score(args)
    else:
        parser.print_help()
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
