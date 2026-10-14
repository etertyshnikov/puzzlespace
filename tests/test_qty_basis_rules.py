# -*- coding: utf-8 -*-
from app.services.qty_basis_rules import (
    LINKED_ASSEMBLY_SOURCE_TEMPLATE_ROW,
    QTY_BASIS_AREA,
    QTY_BASIS_FOUNDATION_BLOCKS,
    QTY_BASIS_KIT_FLOOR_AREA,
    QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS,
    QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS_AREA,
    QTY_BASIS_WALL_INSULATION_SDS,
    QTY_BASIS_KIT_PERIMETER_ROOMS_KIT,
    QTY_BASIS_PERIMETER,
    QTY_BASIS_TERRACE_AREA,
    QTY_BASIS_PERIMETER_ROOMS_KIT,
    QTY_BASIS_PERIMETER_X2_DOUBLE_TIMBER,
    compute_foundation_blocks_contour_internal,
    compute_kit_area_plus_room_walls_quantity,
    compute_kit_area_plus_room_walls_area_quantity,
    compute_wall_insulation_sds_quantity,
    wall_height_k_m,
    kit_floor_area_m2,
    kit_perimeter_m,
    kit_wall_area_m2,
    compute_kit_perimeter_rooms_quantity,
    compute_linked_wall_kit_quantity,
    compute_quantity_auto,
    compute_terrace_area_quantity,
    points_on_segment,
    room_count_perimeter_addon,
    room_walls_area_m2,
    room_walls_length_m,
    terrace_area_floor_factor,
)


def test_perimeter_x2_double_timber_when_enabled():
    # L=5, W=6 → периметр 22, ×2 при двойном брусе → 44
    q = compute_quantity_auto(
        QTY_BASIS_PERIMETER_X2_DOUBLE_TIMBER,
        1.0,
        False,
        5,
        6,
        1,
        1.0,
        double_timber=True,
    )
    assert q == 44.0


def test_perimeter_x2_double_timber_when_disabled():
    # L=5, W=6 → периметр 22, коэффициент 1 без двойного бруса
    q = compute_quantity_auto(
        QTY_BASIS_PERIMETER_X2_DOUBLE_TIMBER,
        1.0,
        False,
        5,
        6,
        1,
        1.0,
        double_timber=False,
    )
    assert q == 22.0


def test_perimeter_unchanged():
    q = compute_quantity_auto(QTY_BASIS_PERIMETER, 1.0, False, 5, 6, 1, 1.0, double_timber=True)
    assert q == 22.0


def test_area_with_multiplier():
    q = compute_quantity_auto(QTY_BASIS_AREA, 1.5, False, 5, 6, 1, 1.0)
    assert q == 45.0
    q_floors = compute_quantity_auto(QTY_BASIS_AREA, 1.0, True, 5, 6, 2, 1.0)
    assert q_floors == 60.0


def test_kit_floor_area_sdp():
    assert kit_floor_area_m2(5, 6, 0) == 30.0
    assert kit_floor_area_m2(5, 6, 2) == 18.0
    q = compute_quantity_auto(
        QTY_BASIS_KIT_FLOOR_AREA,
        1.0,
        False,
        5,
        6,
        2,
        1.0,
        terrace_length_m=2,
    )
    assert q == 18.0
    q_floors = compute_quantity_auto(
        QTY_BASIS_KIT_FLOOR_AREA,
        1.0,
        True,
        5,
        6,
        2,
        1.0,
        terrace_length_m=0,
    )
    assert q_floors == 60.0
    q_mu = compute_quantity_auto(
        QTY_BASIS_KIT_FLOOR_AREA,
        1.5,
        False,
        5,
        6,
        1,
        1.0,
        terrace_length_m=0,
    )
    assert q_mu == 45.0


def test_kit_wall_area_sds():
    assert kit_perimeter_m(5, 6, 0) == 22.0
    assert abs(kit_wall_area_m2(5, 6, 0, wall_height_m=2.8) - 22.0 * 2.8) < 1e-9


def test_wall_insulation_sds_requires_double_timber():
    assert compute_wall_insulation_sds_quantity(5, 6, double_timber=False, floors_factor=2) == 0.0
    q_off = compute_quantity_auto(
        QTY_BASIS_WALL_INSULATION_SDS,
        1.0,
        True,
        5,
        6,
        2,
        1.0,
        double_timber=False,
        terrace_length_m=0,
        wall_height_m=2.8,
    )
    assert q_off == 0.0
    q = compute_quantity_auto(
        QTY_BASIS_WALL_INSULATION_SDS,
        1.0,
        True,
        5,
        6,
        2,
        1.0,
        double_timber=True,
        terrace_length_m=0,
        wall_height_m=2.8,
    )
    # Sds=246.4, утепление = Sds/2 = 123.2
    assert abs(q - 123.2) < 1e-6


def test_kit_area_plus_room_walls():
    assert kit_floor_area_m2(5, 6, 0) == 30.0
    assert abs(compute_kit_area_plus_room_walls_quantity(5, 6, 3, terrace_length_m=0) - 37.04) < 1e-9
    q = compute_quantity_auto(
        QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS,
        1.0,
        False,
        5,
        6,
        2,
        1.0,
        room_count=3,
        terrace_length_m=2,
    )
    assert abs(q - 25.04) < 1e-9


def test_kit_area_plus_room_walls_area():
    # Sds=22*2.8=61.6, Sst=7.04*2.8=19.712 → 81.312
    assert abs(compute_kit_area_plus_room_walls_area_quantity(5, 6, 3, terrace_length_m=0) - 81.312) < 1e-9
    q = compute_quantity_auto(
        QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS_AREA,
        1.0,
        False,
        5,
        6,
        1,
        1.0,
        room_count=3,
        terrace_length_m=0,
        double_timber=False,
    )
    assert abs(q - 81.312) < 1e-9


def test_kit_area_plus_room_walls_area_double_timber_two_floors():
    # Sds*2*2 + Sst*2 = 61.6*4 + 19.712*2 = 285.824
    q = compute_quantity_auto(
        QTY_BASIS_KIT_AREA_PLUS_ROOM_WALLS_AREA,
        1.0,
        True,
        5,
        6,
        2,
        1.0,
        room_count=3,
        terrace_length_m=0,
        double_timber=True,
    )
    assert abs(q - 285.824) < 1e-9


def test_room_walls_length_and_area():
    assert room_walls_length_m(5, 6, 1) == 0.0
    assert room_walls_area_m2(5, 6, 1) == 0.0
    # периметр 22; 22 * 0.32 = 7.04
    assert abs(room_walls_length_m(5, 6, 3) - 7.04) < 1e-9
    assert abs(room_walls_length_m(5, 6, 3, double_timber=True) - 14.08) < 1e-9
    assert abs(room_walls_area_m2(5, 6, 3) - 7.04 * 2.8) < 1e-9
    assert abs(room_walls_area_m2(5, 6, 3, double_timber=True) - 14.08 * 2.8) < 1e-9


def test_room_walls_area_uses_wall_height_k():
    assert wall_height_k_m(None) == 2.8
    assert abs(room_walls_area_m2(5, 6, 3, wall_height_m=3.0) - 7.04 * 3.0) < 1e-9
    assert abs(compute_kit_area_plus_room_walls_area_quantity(5, 6, 3, terrace_length_m=0, wall_height_m=3.0) - 87.12) < 1e-9


def test_room_count_addon_coefficients():
    assert room_count_perimeter_addon(1) == 0.0
    assert room_count_perimeter_addon(2) == 0.16
    assert room_count_perimeter_addon(3) == 0.32
    assert room_count_perimeter_addon(4) == 0.48
    assert room_count_perimeter_addon(5) == 0.65
    assert room_count_perimeter_addon(10) == 0.65


def test_perimeter_rooms_kit_one_room_same_as_perimeter():
    q = compute_quantity_auto(QTY_BASIS_PERIMETER_ROOMS_KIT, 1.0, False, 5, 6, 1, 1.0, room_count=1)
    assert q == 22.0


def test_linked_wall_kit_quantity():
    assert compute_linked_wall_kit_quantity(51.04) == 51.04
    assert compute_linked_wall_kit_quantity(22.0) == 22.0
    assert compute_linked_wall_kit_quantity(None) == 0.0


def test_linked_assembly_source_row_index():
    assert LINKED_ASSEMBLY_SOURCE_TEMPLATE_ROW == 3


def test_kit_perimeter_rooms_kit():
    assert kit_perimeter_m(5, 6, 0) == 22.0
    assert kit_perimeter_m(5, 6, 2) == 18.0
    # 18 * 2 этажа * (1 + 0.32) = 47.52
    q = compute_quantity_auto(
        QTY_BASIS_KIT_PERIMETER_ROOMS_KIT,
        1.0,
        True,
        5,
        6,
        2,
        1.0,
        room_count=3,
        terrace_length_m=2,
    )
    assert abs(q - 47.52) < 1e-9
    assert abs(compute_kit_perimeter_rooms_quantity(5, 6, 3, terrace_length_m=2, floors_factor=2) - 47.52) < 1e-9


def test_perimeter_rooms_kit_three_rooms_two_floors():
    # периметр 22; 22 * 2 этажа * (1 + 0.32) = 58.08
    q = compute_quantity_auto(
        QTY_BASIS_PERIMETER_ROOMS_KIT, 1.0, True, 5, 6, 2, 1.0, room_count=3
    )
    assert abs(q - 58.08) < 1e-9


def test_perimeter_rooms_kit_double_timber_three_rooms_two_floors():
    # 22 * 2 * (2 + 0.32) = 102.08
    q = compute_quantity_auto(
        QTY_BASIS_PERIMETER_ROOMS_KIT,
        1.0,
        True,
        5,
        6,
        2,
        1.0,
        room_count=3,
        double_timber=True,
    )
    assert abs(q - 102.08) < 1e-9


def test_perimeter_rooms_kit_one_room_double_timber():
    q = compute_quantity_auto(
        QTY_BASIS_PERIMETER_ROOMS_KIT, 1.0, False, 5, 6, 1, 1.0, room_count=1, double_timber=True
    )
    assert q == 44.0


def test_terrace_area_house_width_times_length():
  # ширина дома 6, длина террасы 4, 1 этаж → 24
    q = compute_quantity_auto(
        QTY_BASIS_TERRACE_AREA,
        1.0,
        False,
        5,
        6,
        1,
        1.0,
        terrace_length_m=4,
    )
    assert q == 24.0


def test_terrace_area_second_floor_doubles():
    q = compute_quantity_auto(
        QTY_BASIS_TERRACE_AREA,
        1.0,
        False,
        5,
        6,
        2,
        1.0,
        terrace_length_m=4,
        terrace_second_floor=True,
    )
    assert q == 48.0


def test_terrace_area_second_floor_doubles_on_one_floor():
    assert compute_terrace_area_quantity(6, 4, floors=1, terrace_second_floor=True) == 48.0


def test_terrace_area_missing_dims():
    q = compute_quantity_auto(
        QTY_BASIS_TERRACE_AREA,
        1.0,
        False,
        5,
        6,
        1,
        1.0,
        terrace_length_m=None,
    )
    assert q == 0.0


def test_terrace_area_floor_factor():
    assert terrace_area_floor_factor(2, True) == 2.0
    assert terrace_area_floor_factor(2, False) == 1.0
    assert terrace_area_floor_factor(1, True) == 2.0
    assert terrace_area_floor_factor(1, False) == 1.0


def test_foundation_blocks_contour_internal_5x6():
    assert points_on_segment(5) == 5
    assert points_on_segment(6) == 5
    assert compute_foundation_blocks_contour_internal(5, 6) == 19
    q = compute_quantity_auto(QTY_BASIS_FOUNDATION_BLOCKS, 1.0, True, 5, 6, 2, 1.0)
    assert q == 19.0


def test_foundation_blocks_multiplier():
    assert compute_foundation_blocks_contour_internal(5, 6, multiplier=1.1) == 21


def test_foundation_blocks_ignores_floors_flag():
    q = compute_quantity_auto(QTY_BASIS_FOUNDATION_BLOCKS, 1.0, True, 5, 6, 3, 1.0)
    assert q == 19.0


def test_perimeter_rooms_kit_matches_perimeter_with_one_room_and_floors():
    kwargs = dict(qty_multiplier=1.0, qty_use_floors=True, length_m=5, width_m=6, floors=2, fixed_quantity=1.0)
    q_perim = compute_quantity_auto(QTY_BASIS_PERIMETER, room_count=1, **kwargs)
    q_kit = compute_quantity_auto(QTY_BASIS_PERIMETER_ROOMS_KIT, room_count=1, **kwargs)
    assert q_perim == 44.0
    assert q_kit == q_perim
