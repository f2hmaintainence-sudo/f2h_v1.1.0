import { Module } from '@nestjs/common';
import { MapTilesController } from './map-tiles.controller';
import { MapTilesService } from './map-tiles.service';
import { DirectionsService } from './directions.service';

@Module({
  controllers: [MapTilesController],
  providers: [MapTilesService, DirectionsService],
  exports: [MapTilesService, DirectionsService],
})
export class MapModule {}

