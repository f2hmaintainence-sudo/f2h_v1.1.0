export interface RoutePointDto {
  lat: number;
  lng: number;
}

export interface DirectionsRequestDto {
  origin: RoutePointDto;
  destination: RoutePointDto;
  intermediates?: RoutePointDto[];
  travelMode?: 'TWO_WHEELER' | 'DRIVE' | 'BICYCLE' | 'WALK';
  optimizeWaypointOrder?: boolean;
}
