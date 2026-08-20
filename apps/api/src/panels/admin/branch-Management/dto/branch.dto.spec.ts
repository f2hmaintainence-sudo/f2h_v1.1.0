import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BranchConfigController } from '../branch-config.controller';
import { BranchController } from '../controllers/branch.controller';
import { UpdateBranchDto, UpdateBranchRadiusDto } from './branch.dto';

type DtoConstructor = new () => object;

function methodParameterTypes(target: object, methodName: string): unknown[] {
  const metadata = Reflect.getMetadata(
    'design:paramtypes',
    target,
    methodName,
  ) as unknown;
  return Array.isArray(metadata) ? metadata : [];
}

async function invalidProperties(
  Dto: DtoConstructor,
  payload: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(Dto, payload);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('branch coverage update DTOs', () => {
  it('uses concrete DTOs at both update request boundaries', () => {
    const editParameterTypes = methodParameterTypes(
      BranchController.prototype,
      'saveBranchEdit',
    );
    const radiusParameterTypes = methodParameterTypes(
      BranchConfigController.prototype,
      'updateRadiusConfig',
    );

    expect(editParameterTypes[1]).toBe(UpdateBranchDto);
    expect(radiusParameterTypes[1]).toBe(UpdateBranchRadiusDto);
  });

  it.each([
    ['zero radius', { delivery_radius_km: 0 }, 'delivery_radius_km'],
    ['negative radius', { delivery_radius_km: -1 }, 'delivery_radius_km'],
    ['latitude above 90', { lat: 91 }, 'lat'],
    ['latitude below -90', { lat: -91 }, 'lat'],
    ['longitude above 180', { lng: 181 }, 'lng'],
    ['longitude below -180', { lng: -181 }, 'lng'],
  ])('rejects %s on branch edit', async (_caseName, payload, property) => {
    await expect(
      invalidProperties(UpdateBranchDto, payload),
    ).resolves.toContain(property);
  });

  it.each([
    ['zero radius', { radius_km: 0 }, 'radius_km'],
    ['negative radius', { radius_km: -1 }, 'radius_km'],
    ['latitude above 90', { center_lat: 91 }, 'center_lat'],
    ['latitude below -90', { center_lat: -91 }, 'center_lat'],
    ['longitude above 180', { center_lng: 181 }, 'center_lng'],
    ['longitude below -180', { center_lng: -181 }, 'center_lng'],
  ])('rejects %s on radius config', async (_caseName, payload, property) => {
    await expect(
      invalidProperties(UpdateBranchRadiusDto, payload),
    ).resolves.toContain(property);
  });
});
