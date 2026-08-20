import { Test } from '@nestjs/testing';
import { FormHelper } from '../../../helpers/FormHelper';
import { DataService } from '../../../shared/database/Data.service';
import { DatabaseService } from '../../../shared/database/Database.service';
import { DeveloperService } from '../../../shared/logger/Developer.service';
import { DeliveryManagementService } from '../delivery/delivery.service';
import { BranchConfigService } from './branch-config.service';
import { SectorService } from './ModuleServices/sector.service';
import { BranchCoverageOverlapService } from './services/branch-coverage-overlap.service';
import { BranchSaveEditService } from './services/saveEdit.service';
import { BranchShowAddService } from './services/showAdd.service';
import { BranchShowEditService } from './services/showEdit.service';

const CURRENT_BRANCH = {
  branch_id: 'BRANCH_A',
  branch_name: 'Branch A',
  branch_code: 'A',
  city: 'Kuppam',
  state: 'Andhra Pradesh',
  is_active: true,
  allow_buffer_order: false,
  lat: 12,
  lng: 77,
  delivery_radius_km: 1,
  buffer_zone: 0,
  hex_shape: 'circle',
};

type TransactionWork = (transaction: { query: jest.Mock }) => Promise<unknown>;

describe('branch coverage write serialization', () => {
  it('locks coverage before reading the branch during an edit', async () => {
    const events: string[] = [];
    const transaction = {
      query: jest.fn((sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) {
          events.push('coverage-lock');
          return Promise.resolve([[]]);
        }
        if (/FROM branches[\s\S]*WHERE branch_id = \$1/.test(sql)) {
          events.push('current-state-read');
          return Promise.resolve([[CURRENT_BRANCH]]);
        }
        if (sql.includes('is_active = true')) {
          events.push('conflict-read');
          return Promise.resolve([[]]);
        }
        if (sql.includes('UPDATE branches')) {
          events.push('branch-update');
        }
        return Promise.resolve([[]]);
      }),
    };
    const database = {
      query: jest.fn((sql: string) => {
        if (/FROM branches WHERE branch_id = \$1/.test(sql)) {
          events.push('current-state-read');
        }
        return Promise.resolve([CURRENT_BRANCH]);
      }),
    };
    const dataService = {
      executeTransaction: jest.fn((work: TransactionWork) => work(transaction)),
      insert: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        BranchSaveEditService,
        BranchCoverageOverlapService,
        { provide: FormHelper, useValue: {} },
        { provide: DataService, useValue: dataService },
        { provide: DatabaseService, useValue: database },
        {
          provide: DeveloperService,
          useValue: { error: jest.fn(), warn: jest.fn() },
        },
        { provide: BranchShowAddService, useValue: {} },
        { provide: BranchShowEditService, useValue: {} },
        { provide: SectorService, useValue: {} },
      ],
    }).compile();

    await module
      .get(BranchSaveEditService)
      .saveBranch('BRANCH_A', { delivery_radius_km: 2 }, 'ADMIN_A');

    expect(events).toEqual(
      expect.arrayContaining(['coverage-lock', 'current-state-read']),
    );
    expect(events.indexOf('coverage-lock')).toBeLessThan(
      events.indexOf('current-state-read'),
    );
  });

  it('locks coverage before reading the branch during a radius update', async () => {
    const events: string[] = [];
    const transaction = {
      query: jest.fn((sql: string) => {
        if (sql.includes('pg_advisory_xact_lock')) {
          events.push('coverage-lock');
          return Promise.resolve([[]]);
        }
        if (/FROM branches[\s\S]*WHERE branch_id = \$1/.test(sql)) {
          events.push('current-state-read');
          return Promise.resolve([[CURRENT_BRANCH]]);
        }
        if (sql.includes('is_active = true')) {
          events.push('conflict-read');
          return Promise.resolve([[]]);
        }
        if (sql.includes('UPDATE branches')) {
          events.push('branch-update');
        }
        return Promise.resolve([[]]);
      }),
    };
    const dataService = {
      executeTransaction: jest.fn((work: TransactionWork) => work(transaction)),
    };
    const module = await Test.createTestingModule({
      providers: [
        BranchConfigService,
        BranchCoverageOverlapService,
        { provide: DatabaseService, useValue: { query: jest.fn() } },
        { provide: DataService, useValue: dataService },
        {
          provide: DeveloperService,
          useValue: { error: jest.fn(), warn: jest.fn() },
        },
        { provide: DeliveryManagementService, useValue: {} },
      ],
    }).compile();

    await module
      .get(BranchConfigService)
      .updateRadiusConfig('BRANCH_A', { radius_km: 2 });

    expect(events).toEqual(
      expect.arrayContaining(['coverage-lock', 'current-state-read']),
    );
    expect(events.indexOf('coverage-lock')).toBeLessThan(
      events.indexOf('current-state-read'),
    );
    expect(transaction.query).toHaveBeenCalledWith(
      expect.stringContaining('delivery_radius_km = $2'),
      ['BRANCH_A', 2],
    );
  });
});
