import { Module } from '@nestjs/common';
import { DirectionsController } from './directions.controller';
import { DirectionsService } from './directions.service';
import { MapTilesController } from './map-tiles.controller';
import { MapTilesService } from './map-tiles.service';

@Module({
  controllers: [MapTilesController, DirectionsController],
  providers: [MapTilesService, DirectionsService],
})
export class MapModule {}
