# -*- coding: utf-8 -*-
"""
Правила количества от габаритов дома (спецификация: length_m, width_m, floors).

qty_basis:
  - fixed — количество из шаблона (quantity), без L/W/F
  - perimeter — периметр основания 2*(L+W) * qty_multiplier * (этажность при qty_use_floors, иначе 1)
  - perimeter_x2_double_timber — 2*(L+W) * (2 если двойной брус, иначе 1) * множитель * этажность
  - perimeter_rooms_kit — 2*(L+W) * множитель * этажность * (1 + надбавка по комнатам) без двойного бруса
    или * (2 + надбавка) при двойном брусе (надбавка: 2→0.16, 3→0.32, 4→0.48, 5+→0.65)
  - kit_perimeter_rooms_kit — как perimeter_rooms_kit, но 2×((L−длина террасы)+W) вместо 2×(L+W)
  - linked_wall_kit_qty — равно итоговому кол-ву 3-й позиции шаблона спецификации дома (без ручного ввода)
  - area — Q = μ×L×W×lot; μ = qty_multiplier шаблона (lot при qty_use_floors, иначе 1)
  - terrace_area — St = Lt×W; Q = St или 2×St при «Терраса на втором этаже» (terrace_second_floor)
  - foundation_blocks_contour_internal — бетонные блоки: контур (шаг 1,5 м) + один внутренний ряд
    по длинной стороне; × qty_multiplier; этажность не учитывается
  - kit_floor_area — Q = μ×Sdp×lot; Sdp = Ld×Wd, Ld = L−Lt, Wd = W (μ = qty_multiplier шаблона; lot при qty_use_floors)
  - kit_area_plus_room_walls_len — Sdp + Lst×Cr×Tb
  - kit_area_plus_room_walls_area — Sds + Sst; Sds=Pd×k×Tb×lot, Sst=Lst×k×Cr×Tb
  - wall_insulation_sds — утепление стен: Sds/2 = Pd×k×Tb×lot/2; только при double_timber в спецификации

qty_use_floors: True или None — множитель этажности max(1, floors); False — не умножать на этажность (множитель 1).

Обозначения: Lt = terrace_length_m, Lbalk = balcony_length_m (из спецификации).

Итоговое количество в позиции: quantity = quantity_manual if quantity_manual is not None else quantity_auto
(для fixed quantity_auto = статическое количество из шаблона).
"""
from __future__ import annotations

import math
from decimal import Decimal
from typing import Any

FOUNDATION_BLOCK_STEP_M = 1.5
# k — высота дома для площади стен комнат (м): Sst = Lst × k; значение по умолчанию
DEFAULT_ROOM_WALL_HEIGHT_M = 2.8


def balcony_length_lbalk(balcony_length_m: Any) -> float:
    """Lbalk из спецификации (balcony_length_m), м; при отсутствии — 0."""
    if balcony_length_m is None:
        return 0.0
    try:
        v = float(balcony_length_m) if not isinstance(balcony_length_m, Decimal) else float(balcony_length_m)
    except (TypeError, ValueError):
        return 0.0
    return v if v > 0 else 0.0


def terrace_length_lt(terrace_length_m: Any) -> float:
    """Lt из спецификации (terrace_length_m), м; при отсутствии — 0."""
    if terrace_length_m is None:
        return 0.0
    try:
        v = float(terrace_length_m) if not isinstance(terrace_length_m, Decimal) else float(terrace_length_m)
    except (TypeError, ValueError):
        return 0.0
    return v if v > 0 else 0.0


def wall_height_k_m(wall_height_m: Any = None) -> float:
    """k из спецификации (wall_height_m) или DEFAULT_ROOM_WALL_HEIGHT_M."""
    if wall_height_m is None:
        return DEFAULT_ROOM_WALL_HEIGHT_M
    try:
        h = float(wall_height_m) if not isinstance(wall_height_m, Decimal) else float(wall_height_m)
    except (TypeError, ValueError):
        return DEFAULT_ROOM_WALL_HEIGHT_M
    return h if h > 0 else DEFAULT_ROOM_WALL_HEIGHT_M

QTY_BASIS_FIXED = "fixed"
QTY_BASIS_PERIMETER = "perimeter"
QTY_BASIS_PERIMETER_X2_DOUBLE_TIMBER = "perimeter_x2_double_timber"
QTY_BASIS_PERIMETER_ROOMS_KIT = "perimeter_rooms_kit"
QTY_BASIS_KIT_PERIMETER_ROOMS_KIT = "kit_perimeter_rooms_kit"
QTY_BASIS_LINKED_WALL_KIT = "linked_wall_kit_qty"
QTY_BASIS_AREA = "area"
QTY_BASIS_TERRACE_AREA = "terrace_area"
QTY_BASIS_FOUNDATION_BLOCKS = "foundation_blocks_contour_internal"
QTY_BASIS_KIT_FLOOR_AREA = "kit_floor_area"
QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS = "kit_area_plus_room_walls_len"
QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS_AREA = "kit_area_plus_room_walls_area"
QTY_BASIS_WALL_INSULATION_SDS = "wall_insulation_sds"
# Номер позиции в шаблоне спецификации дома (1-based), откуда копируется количество для «Сборка домокомплекта»
LINKED_ASSEMBLY_SOURCE_TEMPLATE_ROW = 3
ALLOWED_BASES = frozenset({
    QTY_BASIS_FIXED,
    QTY_BASIS_PERIMETER,
    QTY_BASIS_PERIMETER_X2_DOUBLE_TIMBER,
    QTY_BASIS_PERIMETER_ROOMS_KIT,
    QTY_BASIS_KIT_PERIMETER_ROOMS_KIT,
    QTY_BASIS_LINKED_WALL_KIT,
    QTY_BASIS_AREA,
    QTY_BASIS_TERRACE_AREA,
    QTY_BASIS_FOUNDATION_BLOCKS,
    QTY_BASIS_KIT_FLOOR_AREA,
    QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS,
    QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS_AREA,
    QTY_BASIS_WALL_INSULATION_SDS,
})


def points_on_segment(length_m: float, step_m: float = FOUNDATION_BLOCK_STEP_M) -> int:
    """Число опор на стороне длиной length_m (включая оба конца), шаг не больше step_m."""
    L = max(0.0, float(length_m))
    S = max(1e-9, float(step_m))
    if L <= 0:
        return 0
    n = int(math.floor(L / S)) + 1
    if n > 1 and (n - 1) * S < L - 1e-6:
        n += 1
    return n


def compute_foundation_blocks_contour_internal(
    length_m: float,
    width_m: float,
    *,
    step_m: float = FOUNDATION_BLOCK_STEP_M,
    multiplier: float = 1.0,
) -> int:
    """
    Контур прямоугольника (опоры через step_m) + внутренний ряд по длинной стороне
    (середина короткой стороны); угловые точки ряда не дублируются.
    """
    L = max(0.0, float(length_m))
    W = max(0.0, float(width_m))
    if L <= 0 or W <= 0:
        return 0
    n_l = points_on_segment(L, step_m)
    n_w = points_on_segment(W, step_m)
    perimeter = 2 * n_l + 2 * n_w - 4
    long_side = max(L, W)
    n_long = points_on_segment(long_side, step_m)
    interior = max(0, n_long - 2)
    total = perimeter + interior
    return int(round(total * float(multiplier)))


def compute_linked_wall_kit_quantity(source_effective_qty: Any) -> float:
    """quantity для сборки = итоговое кол-во источника (3-я позиция шаблона), без множителя и без ручного ввода."""
    if source_effective_qty is None:
        return 0.0
    return float(source_effective_qty) if not isinstance(source_effective_qty, Decimal) else float(source_effective_qty)


def is_linked_wall_kit_basis(qty_basis: str | None) -> bool:
    return normalize_basis(qty_basis) == QTY_BASIS_LINKED_WALL_KIT


def is_wall_insulation_sds_basis(qty_basis: str | None) -> bool:
    return normalize_basis(qty_basis) == QTY_BASIS_WALL_INSULATION_SDS


def kit_wall_area_sds_m2(
    length_m: Any,
    width_m: Any,
    terrace_length_m: Any,
    *,
    double_timber: bool = False,
    wall_height_m: Any = None,
    floors_factor: float = 1.0,
) -> float:
    """Sds = Pd×k×Tb×lot (площадь стен домокомплекта)."""
    tb = 2.0 if double_timber else 1.0
    pd = kit_perimeter_m(length_m, width_m, terrace_length_m)
    if pd <= 0:
        return 0.0
    k = wall_height_k_m(wall_height_m)
    lot = float(floors_factor)
    return pd * k * tb * lot


def compute_wall_insulation_sds_quantity(
    length_m: Any,
    width_m: Any,
    *,
    terrace_length_m: Any = None,
    double_timber: bool = False,
    wall_height_m: Any = None,
    floors_factor: float = 1.0,
) -> float:
    """Утепление стен: Sds/2 (площадь стен домокомплекта в 2 раза меньше); только при double_timber."""
    if not double_timber:
        return 0.0
    sds = kit_wall_area_sds_m2(
        length_m,
        width_m,
        terrace_length_m,
        double_timber=True,
        wall_height_m=wall_height_m,
        floors_factor=floors_factor,
    )
    return sds / 2.0


def kit_floor_area_m2(
    length_m: Any,
    width_m: Any,
    terrace_length_m: Any,
) -> float:
    """Sdp = Ld×Wd, Ld = L−Lt, Wd = W."""
    if length_m is None or width_m is None:
        return 0.0
    L = float(length_m) if not isinstance(length_m, Decimal) else float(length_m)
    W = float(width_m) if not isinstance(width_m, Decimal) else float(width_m)
    t_l = 0.0
    if terrace_length_m is not None:
        t_l = float(terrace_length_m) if not isinstance(terrace_length_m, Decimal) else float(terrace_length_m)
    kit_l = L - t_l
    if kit_l < 0 or W <= 0:
        return 0.0
    return kit_l * W


def kit_perimeter_m(
    length_m: Any,
    width_m: Any,
    terrace_length_m: Any,
) -> float:
    """Pd (м) = 2×(Ld + Wd)."""
    if length_m is None or width_m is None:
        return 0.0
    L = float(length_m) if not isinstance(length_m, Decimal) else float(length_m)
    W = float(width_m) if not isinstance(width_m, Decimal) else float(width_m)
    t_l = 0.0
    if terrace_length_m is not None:
        t_l = float(terrace_length_m) if not isinstance(terrace_length_m, Decimal) else float(terrace_length_m)
    kit_l = L - t_l
    if kit_l < 0 or W <= 0:
        return 0.0
    return 2.0 * (kit_l + W)


def kit_wall_area_m2(
    length_m: Any,
    width_m: Any,
    terrace_length_m: Any,
    *,
    wall_height_m: Any = None,
) -> float:
    """Pd × k (без Tb×lot; полная Sds = Pd×k×Tb×lot)."""
    return kit_perimeter_m(length_m, width_m, terrace_length_m) * wall_height_k_m(wall_height_m)


def compute_kit_perimeter_rooms_quantity(
    length_m: Any,
    width_m: Any,
    room_count: Any,
    *,
    terrace_length_m: Any = None,
    double_timber: bool = False,
    multiplier: float = 1.0,
    floors_factor: float = 1.0,
) -> float:
    """Как perimeter_rooms_kit, но периметр по габаритам домокомплекта."""
    perimeter = kit_perimeter_m(length_m, width_m, terrace_length_m)
    if perimeter <= 0:
        return 0.0
    timber_base = 2.0 if double_timber else 1.0
    room_addon = room_count_perimeter_addon(room_count)
    return perimeter * float(multiplier) * float(floors_factor) * (timber_base + room_addon)


def compute_kit_area_plus_room_walls_quantity(
    length_m: Any,
    width_m: Any,
    room_count: Any,
    *,
    terrace_length_m: Any = None,
    double_timber: bool = False,
    multiplier: float = 1.0,
) -> float:
    """μ×(Sdp+Lst): Sdp=Ld×Wd, Lst=2×(L+W)×Cr×Tb."""
    base = kit_floor_area_m2(length_m, width_m, terrace_length_m) + room_walls_length_m(
        length_m, width_m, room_count, double_timber=double_timber
    )
    return base * float(multiplier)


def compute_kit_area_plus_room_walls_area_quantity(
    length_m: Any,
    width_m: Any,
    room_count: Any,
    *,
    terrace_length_m: Any = None,
    double_timber: bool = False,
    wall_height_m: Any = None,
    floors_factor: float = 1.0,
) -> float:
    """Sds + Sst; Sds = Pd×k×Tb×lot, Sst = Lst×k×Cr×Tb (Lst = 2×(L+W), Cr от C)."""
    tb = 2.0 if double_timber else 1.0
    k = wall_height_k_m(wall_height_m)
    lot = float(floors_factor)
    pd = kit_perimeter_m(length_m, width_m, terrace_length_m)
    sds = pd * k * tb * lot
    lst = house_perimeter_m(length_m, width_m)
    cr = room_count_perimeter_addon(room_count)
    sst = lst * k * cr * tb
    return sds + sst


def house_perimeter_m(length_m: Any, width_m: Any) -> float:
    """Lst (м): 2×(L+W), без Cr и Tb."""
    if length_m is None or width_m is None:
        return 0.0
    L = float(length_m) if not isinstance(length_m, Decimal) else float(length_m)
    W = float(width_m) if not isinstance(width_m, Decimal) else float(width_m)
    if L <= 0 or W <= 0:
        return 0.0
    return 2.0 * (L + W)


def room_walls_length_base_m(length_m: Any, width_m: Any, room_count: Any) -> float:
    """Алиас: Lst×Cr = 2×(L+W)×Cr (длина с коэф. по комнатам C)."""
    return house_perimeter_m(length_m, width_m) * room_count_perimeter_addon(room_count)


def room_walls_length_m(
    length_m: Any,
    width_m: Any,
    room_count: Any,
    *,
    double_timber: bool = False,
) -> float:
    """2×(L+W) × Cr × Tb."""
    timber_factor = 2.0 if double_timber else 1.0
    return house_perimeter_m(length_m, width_m) * room_count_perimeter_addon(room_count) * timber_factor


def room_walls_area_m2(
    length_m: Any,
    width_m: Any,
    room_count: Any,
    *,
    double_timber: bool = False,
    wall_height_m: Any = None,
) -> float:
    """Sst (м²) = Lst × k × Cr × Tb."""
    tb = 2.0 if double_timber else 1.0
    k = wall_height_k_m(wall_height_m)
    lst = house_perimeter_m(length_m, width_m)
    cr = room_count_perimeter_addon(room_count)
    return lst * k * cr * tb


def room_count_perimeter_addon(room_count: Any) -> float:
    """Доп. коэффициент к периметру по числу комнат (1 комната — без надбавки)."""
    try:
        rc = int(room_count) if room_count is not None else 1
    except (TypeError, ValueError):
        rc = 1
    if rc < 1:
        rc = 1
    if rc == 1:
        return 0.0
    if rc == 2:
        return 0.16
    if rc == 3:
        return 0.32
    if rc == 4:
        return 0.48
    return 0.65


def terrace_area_second_floor_factor(terrace_second_floor: bool) -> float:
    """×2 при «Терраса на втором этаже», иначе ×1 (St или 2St)."""
    return 2.0 if terrace_second_floor else 1.0


def terrace_area_floor_factor(floors: Any, terrace_second_floor: bool) -> float:
    """Алиас для обратной совместимости; этажность не влияет — только terrace_second_floor."""
    return terrace_area_second_floor_factor(terrace_second_floor)


def compute_terrace_area_quantity(
    house_width_m: Any,
    terrace_length_m: Any,
    *,
    floors: Any = 1,
    terrace_second_floor: bool = False,
    multiplier: float = 1.0,
) -> float:
    if house_width_m is None or terrace_length_m is None:
        return 0.0
    w = float(house_width_m) if not isinstance(house_width_m, Decimal) else float(house_width_m)
    t_l = float(terrace_length_m) if not isinstance(terrace_length_m, Decimal) else float(terrace_length_m)
    if w <= 0 or t_l <= 0:
        return 0.0
    return w * t_l * float(multiplier) * terrace_area_second_floor_factor(terrace_second_floor)


def template_qty_multiplier(qty_multiplier: Any) -> float:
    """μ из qty_multiplier шаблона; при отсутствии или невалидном значении — 1."""
    if qty_multiplier is None:
        return 1.0
    try:
        m = float(qty_multiplier) if not isinstance(qty_multiplier, Decimal) else float(qty_multiplier)
    except (TypeError, ValueError):
        return 1.0
    return m if m > 0 else 1.0


def normalize_basis(basis: str | None) -> str:
    if not basis or not str(basis).strip():
        return QTY_BASIS_FIXED
    b = str(basis).strip().lower()
    return b if b in ALLOWED_BASES else QTY_BASIS_FIXED


def compute_quantity_auto(
    qty_basis: str | None,
    qty_multiplier: Any,
    qty_use_floors: bool | None,
    length_m: Any,
    width_m: Any,
    floors: Any,
    fixed_quantity: Any,
    *,
    double_timber: bool = False,
    room_count: Any = 1,
    terrace_length_m: Any = None,
    terrace_width_m: Any = None,
    terrace_second_floor: bool = False,
    wall_height_m: Any = None,
) -> float:
    """
    Возвращает quantity_auto (без учёта ручного override).
    fixed_quantity — значение quantity из шаблона для режима fixed.
    """
    basis = normalize_basis(qty_basis)
    # Множитель шаблона (qty_multiplier) в формулы не входит
    mult = 1.0
    use_floors = True if qty_use_floors is None else bool(qty_use_floors)

    if basis == QTY_BASIS_FIXED:
        q = fixed_quantity
        if q is None:
            return 1.0
        return float(q) if not isinstance(q, Decimal) else float(q)

    f_raw = floors
    try:
        f_int = int(f_raw) if f_raw is not None else 1
    except (TypeError, ValueError):
        f_int = 1
    if f_int < 1:
        f_int = 1
    floors_factor = float(f_int) if use_floors else 1.0

    if basis == QTY_BASIS_TERRACE_AREA:
        return compute_terrace_area_quantity(
            width_m,
            terrace_length_m,
            floors=floors,
            terrace_second_floor=terrace_second_floor,
            multiplier=mult,
        )

    if length_m is None or width_m is None:
        return 0.0
    L = float(length_m) if not isinstance(length_m, Decimal) else float(length_m)
    W = float(width_m) if not isinstance(width_m, Decimal) else float(width_m)

    if basis == QTY_BASIS_PERIMETER:
        perimeter = 2.0 * (L + W)
        return perimeter * mult * floors_factor
    if basis == QTY_BASIS_PERIMETER_X2_DOUBLE_TIMBER:
        perimeter = 2.0 * (L + W)
        timber_factor = 2.0 if double_timber else 1.0
        return perimeter * timber_factor * mult * floors_factor
    if basis == QTY_BASIS_PERIMETER_ROOMS_KIT:
        perimeter = 2.0 * (L + W)
        timber_base = 2.0 if double_timber else 1.0
        room_addon = room_count_perimeter_addon(room_count)
        return perimeter * mult * floors_factor * (timber_base + room_addon)
    if basis == QTY_BASIS_KIT_PERIMETER_ROOMS_KIT:
        return compute_kit_perimeter_rooms_quantity(
            L,
            W,
            room_count,
            terrace_length_m=terrace_length_m,
            double_timber=double_timber,
            multiplier=mult,
            floors_factor=floors_factor,
        )
    if basis == QTY_BASIS_AREA:
        mu = template_qty_multiplier(qty_multiplier)
        return L * W * mu * floors_factor
    if basis == QTY_BASIS_FOUNDATION_BLOCKS:
        return float(
            compute_foundation_blocks_contour_internal(L, W, step_m=FOUNDATION_BLOCK_STEP_M, multiplier=mult)
        )
    if basis == QTY_BASIS_KIT_FLOOR_AREA:
        mu = template_qty_multiplier(qty_multiplier)
        return kit_floor_area_m2(L, W, terrace_length_m) * floors_factor * mu
    if basis == QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS:
        return compute_kit_area_plus_room_walls_quantity(
            L,
            W,
            room_count,
            terrace_length_m=terrace_length_m,
            double_timber=double_timber,
            multiplier=mult,
        )
    if basis == QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS_AREA:
        return compute_kit_area_plus_room_walls_area_quantity(
            L,
            W,
            room_count,
            terrace_length_m=terrace_length_m,
            double_timber=double_timber,
            wall_height_m=wall_height_m,
            floors_factor=floors_factor,
        )
    if basis == QTY_BASIS_WALL_INSULATION_SDS:
        return compute_wall_insulation_sds_quantity(
            L,
            W,
            terrace_length_m=terrace_length_m,
            double_timber=double_timber,
            wall_height_m=wall_height_m,
            floors_factor=floors_factor,
        )
    return 1.0


def effective_quantity(
    quantity_manual: Any,
    quantity_auto: Any,
    *,
    fallback_quantity: Any = None,
) -> float:
    """Итоговое количество: ручное, иначе авто, иначе fallback (например текущее quantity для строк без правил)."""
    if quantity_manual is not None:
        return float(quantity_manual) if not isinstance(quantity_manual, Decimal) else float(quantity_manual)
    if quantity_auto is not None:
        return float(quantity_auto) if not isinstance(quantity_auto, Decimal) else float(quantity_auto)
    if fallback_quantity is not None:
        return float(fallback_quantity) if not isinstance(fallback_quantity, Decimal) else float(fallback_quantity)
    return 1.0


def has_qty_rule(qty_basis: str | None) -> bool:
    return bool(qty_basis and str(qty_basis).strip())


def needs_recalc_on_spec_dimensions(qty_basis: str | None) -> bool:
    b = normalize_basis(qty_basis)
    return b in (
        QTY_BASIS_PERIMETER,
        QTY_BASIS_PERIMETER_X2_DOUBLE_TIMBER,
        QTY_BASIS_PERIMETER_ROOMS_KIT,
        QTY_BASIS_KIT_PERIMETER_ROOMS_KIT,
        QTY_BASIS_AREA,
        QTY_BASIS_TERRACE_AREA,
        QTY_BASIS_FOUNDATION_BLOCKS,
        QTY_BASIS_KIT_FLOOR_AREA,
        QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS,
        QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS_AREA,
        QTY_BASIS_WALL_INSULATION_SDS,
    )
