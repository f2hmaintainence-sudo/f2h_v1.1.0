import {
  BranchCoverageArea,
  BranchCoverageOverlapService,
  coverageAreasOverlap,
} from './branch-coverage-overlap.service';

const EARTH_RADIUS_KM = 6371;
const TEST_LATITUDE = 12;

function longitudeForEastwardDistance(distanceKm: number): number {
  return (
    distanceKm /
    (EARTH_RADIUS_KM *
      (Math.PI / 180) *
      Math.cos(TEST_LATITUDE * (Math.PI / 180)))
  );
}

function coverage(
  overrides: Partial<BranchCoverageArea> = {},
): BranchCoverageArea {
  return {
    branch_id: 'BRANCH_A',
    branch_name: 'Branch A',
    lat: TEST_LATITUDE,
    lng: 77,
    delivery_radius_km: 1,
    buffer_zone: 0,
    allow_buffer_order: false,
    is_active: true,
    hex_shape: 'circle',
    ...overrides,
  };
}

describe('branch coverage geometry', () => {
  it('allows separated coverage areas', () => {
    const first = coverage();
    const second = coverage({
      branch_id: 'BRANCH_B',
      lng: 77 + longitudeForEastwardDistance(2.1),
    });

    expect(coverageAreasOverlap(first, second)).toBe(false);
  });

  it('treats touching circle boundaries as a conflict', () => {
    const first = coverage();
    const second = coverage({
      branch_id: 'BRANCH_B',
      lng: 77 + longitudeForEastwardDistance(2),
    });

    expect(coverageAreasOverlap(first, second)).toBe(true);
  });

  it('detects overlap between a circle and a polygon', () => {
    const circle = coverage({ delivery_radius_km: 0.5 });
    const square = coverage({
      branch_id: 'BRANCH_B',
      hex_shape: 'square',
      lng: 77 + longitudeForEastwardDistance(1),
    });

    expect(coverageAreasOverlap(circle, square)).toBe(true);
  });

  it('detects intersecting polygon edges and full containment', () => {
    const square = coverage({ hex_shape: 'square' });
    const crossingRectangle = coverage({
      branch_id: 'BRANCH_B',
      hex_shape: 'rectangle',
      lng: 77 + longitudeForEastwardDistance(1),
    });
    const containedHexagon = coverage({
      branch_id: 'BRANCH_C',
      hex_shape: 'hexagon',
      delivery_radius_km: 0.25,
    });

    expect(coverageAreasOverlap(square, crossingRectangle)).toBe(true);
    expect(coverageAreasOverlap(square, containedHexagon)).toBe(true);
  });

  it('counts a buffer only when buffer orders are enabled', () => {
    const candidate = coverage({
      buffer_zone: 1,
      allow_buffer_order: false,
    });
    const nearby = coverage({
      branch_id: 'BRANCH_B',
      lng: 77 + longitudeForEastwardDistance(2.5),
    });

    expect(coverageAreasOverlap(candidate, nearby)).toBe(false);
    expect(
      coverageAreasOverlap({ ...candidate, allow_buffer_order: true }, nearby),
    ).toBe(true);
  });
});

describe('BranchCoverageOverlapService', () => {
  it('serializes checks and excludes the branch being edited', async () => {
    const transaction = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([
          [
            coverage({
              branch_id: 'BRANCH_B',
              branch_name: 'Branch B',
              lng: 77 + longitudeForEastwardDistance(1),
            }),
          ],
        ]),
    };
    const service = new BranchCoverageOverlapService();

    const conflict = await service.findConflict(
      transaction,
      coverage(),
      'BRANCH_A',
    );

    expect(transaction.query).toHaveBeenCalledTimes(2);
    expect(transaction.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('pg_advisory_xact_lock'),
      ['branch-coverage'],
    );
    expect(transaction.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/is_active = true[\s\S]*branch_id <> \$1/),
      ['BRANCH_A'],
    );
    expect(conflict).toEqual({
      branch_id: 'BRANCH_B',
      branch_name: 'Branch B',
    });
  });

  it('does not query coverage for an inactive candidate', async () => {
    const transaction = { query: jest.fn() };
    const service = new BranchCoverageOverlapService();

    const conflict = await service.findConflict(
      transaction,
      coverage({ is_active: false }),
    );

    expect(conflict).toBeNull();
    expect(transaction.query).not.toHaveBeenCalled();
  });

  it('does not query coverage until coordinates are configured', async () => {
    const transaction = { query: jest.fn() };
    const service = new BranchCoverageOverlapService();

    const conflict = await service.findConflict(
      transaction,
      coverage({ lat: null, lng: null }),
    );

    expect(conflict).toBeNull();
    expect(transaction.query).not.toHaveBeenCalled();
  });
});
