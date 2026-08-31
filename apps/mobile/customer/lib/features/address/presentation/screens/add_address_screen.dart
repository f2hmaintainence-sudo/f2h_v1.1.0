import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/features/address/data/models/profile_address.dart';
import 'package:f2h_customer/core/config/app_config.dart';
import 'package:f2h_customer/core/services/location_helper.dart';

enum MapLayerType { googleRoadmap, googleSatellite, googleTerrain }

class AddAddressScreen extends StatefulWidget {
  final AddressModel? existing;
  const AddAddressScreen({this.existing, super.key});

  @override
  State<AddAddressScreen> createState() => _AddAddressScreenState();
}

class _AddAddressScreenState extends State<AddAddressScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController contactNameController;
  late final TextEditingController contactMobileController;
  late final TextEditingController flatNoController;
  late final TextEditingController floorNoController;
  late final TextEditingController buildingNameController;
  late final TextEditingController streetController;
  late final TextEditingController areaController;
  late final TextEditingController cityController;
  late final TextEditingController stateController;
  late final TextEditingController pincodeController;
  late final TextEditingController landmarkController;
  late final TextEditingController deliveryNoteController;

  final TextEditingController _searchController = TextEditingController();

  late String addressType;
  late bool isDefault;
  bool isSaving = false;
  bool isLoadingLocation = false;
  bool isReverseGeocoding = false;
  bool _isMapExpanded = false;
  bool _isMapDragging = false;
  Timer? _mapMoveDebounce;
  String? _selectedInstruction;

  MapLayerType _currentLayer = MapLayerType.googleRoadmap;

  late double selectedLat;
  late double selectedLng;

  late final MapController _mapController;

  Timer? _searchDebounce;
  List<dynamic> _searchResults = [];

  List<dynamic> activeBranches = [];
  bool isLoadingBranches = true;

  String get _currentTileUrl {
    switch (_currentLayer) {
      case MapLayerType.googleSatellite:
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case MapLayerType.googleTerrain:
        return 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      case MapLayerType.googleRoadmap:
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  }

  String get _formattedAddress => [
    streetController.text,
    areaController.text,
    cityController.text,
    stateController.text,
    pincodeController.text,
  ].where((e) => e.trim().isNotEmpty).join(', ');

  Future<void> _loadBranches() async {
    try {
      final response = await sl<DioClient>().dio.get('/customer/bootstrap');
      final data = response.data;
      if (data != null && data['branches'] != null) {
        if (mounted) {
          setState(() {
            activeBranches = data['branches'] as List;
            isLoadingBranches = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          activeBranches = context.read<CustomerSessionCubit>().state.branches;
          isLoadingBranches = false;
        });
      }
    }
  }

  double getDistanceKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371; // radius of earth in km
    final dLat = (lat2 - lat1) * pi / 180;
    final dLon = (lon2 - lon1) * pi / 180;
    final a =
        sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180) *
            cos(lat2 * pi / 180) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return r * c;
  }

  List<LatLng> getHexagonPoints(LatLng center, double radiusKm) {
    final List<LatLng> points = [];
    final latRad = center.latitude * pi / 180.0;
    const earthRadius = 6371.0;
    final rRad = radiusKm / earthRadius;

    for (int i = 0; i < 6; i++) {
      final angle = i * pi / 3.0; // 60 degrees
      final newLat = asin(
        sin(latRad) * cos(rRad) + cos(latRad) * sin(rRad) * cos(angle),
      );
      final newLng =
          center.longitude * pi / 180.0 +
          atan2(
            sin(angle) * sin(rRad) * cos(latRad),
            cos(rRad) - sin(latRad) * sin(newLat),
          );
      points.add(LatLng(newLat * 180.0 / pi, newLng * 180.0 / pi));
    }
    return points;
  }

  List<LatLng> getSquarePoints(LatLng center, double radiusKm) {
    final List<LatLng> points = [];
    final latRad = center.latitude * pi / 180.0;
    const earthRadius = 6371.0;
    final rRad = radiusKm / earthRadius;

    final angles = [pi / 4, 3 * pi / 4, 5 * pi / 4, 7 * pi / 4];
    for (final angle in angles) {
      final newLat = asin(
        sin(latRad) * cos(rRad) + cos(latRad) * sin(rRad) * cos(angle),
      );
      final newLng =
          center.longitude * pi / 180.0 +
          atan2(
            sin(angle) * sin(rRad) * cos(latRad),
            cos(rRad) - sin(latRad) * sin(newLat),
          );
      points.add(LatLng(newLat * 180.0 / pi, newLng * 180.0 / pi));
    }
    return points;
  }

  List<LatLng> getRectanglePoints(LatLng center, double radiusKm) {
    final List<LatLng> points = [];
    final latRad = center.latitude * pi / 180.0;
    const earthRadius = 6371.0;
    final rRad = radiusKm / earthRadius;
    final cornerBearing = atan2(2.0, 1.0);

    final angles = [
      cornerBearing,
      pi - cornerBearing,
      pi + cornerBearing,
      (2 * pi) - cornerBearing,
    ];
    for (final angle in angles) {
      final newLat = asin(
        sin(latRad) * cos(rRad) + cos(latRad) * sin(rRad) * cos(angle),
      );
      final newLng =
          center.longitude * pi / 180.0 +
          atan2(
            sin(angle) * sin(rRad) * cos(latRad),
            cos(rRad) - sin(latRad) * sin(newLat),
          );
      points.add(LatLng(newLat * 180.0 / pi, newLng * 180.0 / pi));
    }
    return points;
  }

  bool isPointInPolygon(LatLng point, List<LatLng> polygon) {
    int i, j = polygon.length - 1;
    bool oddNodes = false;
    final x = point.longitude;
    final y = point.latitude;

    for (i = 0; i < polygon.length; i++) {
      if ((polygon[i].latitude < y && polygon[j].latitude >= y ||
              polygon[j].latitude < y && polygon[i].latitude >= y) &&
          (polygon[i].longitude +
                  (y - polygon[i].latitude) /
                      (polygon[j].latitude - polygon[i].latitude) *
                      (polygon[j].longitude - polygon[i].longitude) <
              x)) {
        oddNodes = !oddNodes;
      }
      j = i;
    }
    return oddNodes;
  }

  bool _isLocationAllowed() {
    if (activeBranches.isEmpty) {
      final cached = context.read<CustomerSessionCubit>().state.branches;
      if (cached.isNotEmpty) {
        activeBranches = cached;
      } else {
        return isLoadingBranches;
      }
    }

    final point = LatLng(selectedLat, selectedLng);

    for (final branch in activeBranches) {
      final bLat = double.tryParse(branch['lat']?.toString() ?? '') ?? 0.0;
      final bLng = double.tryParse(branch['lng']?.toString() ?? '') ?? 0.0;
      if (bLat == 0.0 || bLng == 0.0) continue;

      final radiusKm =
          double.tryParse(branch['delivery_radius_km']?.toString() ?? '') ??
          5.0;
      final bufferZone =
          double.tryParse(branch['buffer_zone']?.toString() ?? '') ?? 0.0;
      final allowBuffer = branch['allow_buffer_order'] == true;
      final totalRadius = allowBuffer ? (radiusKm + bufferZone) : radiusKm;

      final shape = branch['hex_shape']?.toString().toLowerCase() ?? 'circle';

      if (shape == 'hexagon') {
        final polyPoints = getHexagonPoints(LatLng(bLat, bLng), totalRadius);
        if (isPointInPolygon(point, polyPoints)) {
          return true;
        }
      } else if (shape == 'square') {
        final polyPoints = getSquarePoints(LatLng(bLat, bLng), totalRadius);
        if (isPointInPolygon(point, polyPoints)) {
          return true;
        }
      } else if (shape == 'rectangle') {
        final polyPoints = getRectanglePoints(LatLng(bLat, bLng), totalRadius);
        if (isPointInPolygon(point, polyPoints)) {
          return true;
        }
      } else {
        final dist = getDistanceKm(bLat, bLng, selectedLat, selectedLng);
        if (dist <= totalRadius) {
          return true;
        }
      }
    }
    return false;
  }

  @override
  void initState() {
    super.initState();
    _loadBranches();
    final address = widget.existing;

    final sessionCubit = context.read<CustomerSessionCubit>();
    var profile = sessionCubit.state.profile;
    if (profile == null) {
      sessionCubit.bootstrap();
    }

    String initialName = address?.contactName ?? '';
    String initialMobile = address?.contactMobile ?? '';

    if (address == null && profile != null) {
      if (initialName.isEmpty) {
        initialName = profile.name.isNotEmpty
            ? profile.name
            : '${profile.firstName} ${profile.lastName}'.trim();
      }
      if (initialMobile.isEmpty) {
        initialMobile = profile.mobile;
      }
    }

    contactNameController = TextEditingController(text: initialName);
    contactMobileController = TextEditingController(text: initialMobile);
    flatNoController = TextEditingController(text: address?.flatNo ?? '');
    floorNoController = TextEditingController(text: address?.floorNo ?? '');
    buildingNameController = TextEditingController(
      text: address?.buildingName ?? '',
    );
    streetController = TextEditingController(text: address?.street ?? '');
    areaController = TextEditingController(text: address?.area ?? '');
    cityController = TextEditingController(text: address?.city ?? 'Bengaluru');
    stateController = TextEditingController(
      text: address?.state ?? 'Karnataka',
    );
    pincodeController = TextEditingController(text: address?.pincode ?? '');
    landmarkController = TextEditingController(text: address?.landmark ?? '');
    deliveryNoteController = TextEditingController(
      text: address?.deliveryNote ?? '',
    );

    addressType = address?.addressType.toLowerCase() == 'office'
        ? 'office'
        : address?.addressType.toLowerCase() == 'other'
        ? 'other'
        : 'home';
    isDefault = address?.isDefault ?? false;

    final existingNote = address?.deliveryNote ?? '';
    if (existingNote == 'Leave at Door' ||
        existingNote == 'Ring Bell' ||
        existingNote == 'Hand to Me') {
      _selectedInstruction = existingNote;
    } else if (existingNote.isNotEmpty) {
      _selectedInstruction = 'Other';
    } else {
      _selectedInstruction = null;
    }

    _isMapExpanded = (address == null);

    if (address != null && address.latitude != 0.0) {
      selectedLat = address.latitude;
      selectedLng = address.longitude;
    } else {
      // Default to India center coordinates (e.g. Bangalore center)
      selectedLat = 12.9716;
      selectedLng = 77.5946;

      WidgetsBinding.instance.addPostFrameCallback((_) {
        _requestAndSetCurrentLocation();
      });
    }

    _mapController = MapController();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _mapMoveDebounce?.cancel();

    contactNameController.dispose();
    contactMobileController.dispose();
    flatNoController.dispose();
    floorNoController.dispose();
    buildingNameController.dispose();
    streetController.dispose();
    areaController.dispose();
    cityController.dispose();
    stateController.dispose();
    pincodeController.dispose();
    landmarkController.dispose();
    deliveryNoteController.dispose();
    _searchController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  bool isSearching = false;

  void _onSearchChanged(String query) {
    _searchDebounce?.cancel();
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults.clear();
        isSearching = false;
      });
      return;
    }
    setState(() {
      isSearching = true;
    });
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      _performSearch(query);
    });
  }

  void _parseGoogleAddressComponents(
    List? components, {
    String? formattedAddress,
    String? placeName,
    List? allResults,
  }) {
    if (components == null) return;
    String premise = '';
    String subpremise = '';
    String streetNum = '';
    String route = '';
    String sublocality2 = '';
    String sublocality1 = '';
    String neighborhood = '';
    String city = '';
    String state = '';
    String pincode = '';
    String businessOrBuilding = placeName ?? '';

    // Check allResults to find any establishment / point of interest / business name
    if (allResults != null && businessOrBuilding.isEmpty) {
      for (final r in allResults) {
        final types =
            (r['types'] as List?)?.map((e) => e.toString()).toList() ?? [];
        if (types.contains('establishment') ||
            types.contains('point_of_interest') ||
            types.contains('premise') ||
            types.contains('store') ||
            types.contains('restaurant') ||
            types.contains('school') ||
            types.contains('hospital') ||
            types.contains('lodging')) {
          final comp = (r['address_components'] as List?)?.firstOrNull;
          final name = comp?['long_name']?.toString() ?? '';
          if (name.isNotEmpty && !name.contains(RegExp(r'^\d+$'))) {
            businessOrBuilding = name;
            break;
          }
        }
      }
    }

    for (final comp in components) {
      final types =
          (comp['types'] as List?)?.map((e) => e.toString()).toList() ?? [];
      final name = comp['long_name']?.toString() ?? '';

      if (types.contains('premise') || types.contains('building')) {
        premise = name;
      } else if (types.contains('subpremise')) {
        subpremise = name;
      } else if (types.contains('street_number')) {
        streetNum = name;
      } else if (types.contains('route')) {
        route = name;
      } else if (types.contains('sublocality_level_2') ||
          types.contains('sublocality_level_3')) {
        if (sublocality2.isEmpty) sublocality2 = name;
      } else if (types.contains('sublocality_level_1') ||
          types.contains('sublocality')) {
        if (sublocality1.isEmpty) sublocality1 = name;
      } else if (types.contains('neighborhood')) {
        if (neighborhood.isEmpty) neighborhood = name;
      } else if (types.contains('locality')) {
        city = name;
      } else if (types.contains('administrative_area_level_2') && city.isEmpty) {
        city = name;
      } else if (types.contains('administrative_area_level_1')) {
        state = name;
      } else if (types.contains('postal_code')) {
        pincode = name;
      }
    }

    String streetValue = [
      streetNum,
      route,
      sublocality2,
    ].where((s) => s.isNotEmpty).join(', ');

    String areaValue = [
      sublocality1.isNotEmpty ? sublocality1 : neighborhood,
    ].where((s) => s.isNotEmpty).join(', ');

    final detectedBuilding = businessOrBuilding.isNotEmpty
        ? businessOrBuilding
        : (premise.isNotEmpty ? premise : '');

    setState(() {
      if (detectedBuilding.isNotEmpty) {
        buildingNameController.text = detectedBuilding;
        if (landmarkController.text.isEmpty) {
          landmarkController.text = 'Near $detectedBuilding';
        }
      }
      if (subpremise.isNotEmpty && flatNoController.text.isEmpty) {
        flatNoController.text = subpremise;
      }
      if (streetValue.isNotEmpty) streetController.text = streetValue;
      if (areaValue.isNotEmpty) areaController.text = areaValue;
      if (city.isNotEmpty) cityController.text = city;
      if (state.isNotEmpty) stateController.text = state;
      if (pincode.isNotEmpty) pincodeController.text = pincode;
    });
  }

  Future<void> _performSearch(String query) async {
    try {
      // 1. Try Backend Proxy API first (handles Google Places, no CORS block on Web/App)
      final dio = sl<DioClient>().dio;
      final response = await dio.get(
        '/map/places/autocomplete',
        queryParameters: {'input': query},
      );
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['status'] == 'OK' && data['predictions'] != null && mounted) {
          setState(() {
            isSearching = false;
            _searchResults = (data['predictions'] as List)
                .map(
                  (p) => {
                    'description': p['description'] ?? '',
                    'place_id': p['place_id'] ?? '',
                    'main_text': p['main_text'] ?? p['description'] ?? '',
                    'secondary_text': p['secondary_text'] ?? '',
                    'lat': p['lat'],
                    'lng': p['lng'],
                    'types': p['types'] ?? [],
                  },
                )
                .toList();
          });
          return;
        }
      }
    } catch (e) {
      debugPrint('Backend map search error: $e');
    }

    // 2. Fallback: Direct Google Places HTTP
    try {
      final apiKey = AppConfig.googleMapsApiKey;
      if (apiKey.isNotEmpty) {
        final url = Uri.parse(
          'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${Uri.encodeComponent(query)}&components=country:in&key=$apiKey',
        );
        final response = await http.get(url);
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          if (data['status'] == 'OK' &&
              data['predictions'] != null &&
              mounted) {
            setState(() {
              isSearching = false;
              _searchResults = (data['predictions'] as List)
                  .map(
                    (p) => {
                      'description': p['description'] ?? '',
                      'place_id': p['place_id'] ?? '',
                      'main_text': p['structured_formatting']?['main_text'] ?? '',
                      'secondary_text': p['structured_formatting']?['secondary_text'] ?? '',
                      'types': p['types'] ?? [],
                    },
                  )
                  .toList();
            });
            return;
          }
        }
      }
    } catch (e) {
      debugPrint('Direct Google search error: $e');
    }

    // 3. Fallback: OpenStreetMap Nominatim
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/search?format=json&q=${Uri.encodeComponent(query)}&countrycodes=in&limit=10&addressdetails=1',
      );
      final response = await http.get(
        url,
        headers: {'User-Agent': 'f2hcustomer_app/1.0'},
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (mounted) {
          setState(() {
            isSearching = false;
            _searchResults = (data as List).map((item) {
              return {
                'place_id': 'osm-${item['place_id'] ?? item['osm_id']}',
                'description': item['display_name'] ?? '',
                'main_text': item['name'] ?? (item['display_name']?.toString().split(',')[0] ?? ''),
                'secondary_text': item['display_name'] ?? '',
                'lat': double.tryParse(item['lat']?.toString() ?? ''),
                'lng': double.tryParse(item['lon']?.toString() ?? ''),
                'types': [item['type'], item['class']].where((e) => e != null).toList(),
              };
            }).toList();
          });
          return;
        }
      }
    } catch (e) {
      debugPrint('Search error: $e');
    } finally {
      if (mounted) {
        setState(() {
          isSearching = false;
        });
      }
    }
  }

  Future<void> _selectSearchResult(dynamic result) async {
    final placeId = result['place_id']?.toString() ?? '';
    final directLat = double.tryParse(result['lat']?.toString() ?? '');
    final directLng = double.tryParse(result['lng']?.toString() ?? '');

    // 1. Try Backend Proxy details
    if (placeId.isNotEmpty && !placeId.startsWith('osm-')) {
      try {
        final dio = sl<DioClient>().dio;
        final res = await dio.get(
          '/map/places/details',
          queryParameters: {'place_id': placeId},
        );
        if (res.statusCode == 200 && res.data != null) {
          final data = res.data;
          if (data['status'] == 'OK' && data['result'] != null) {
            final resObj = data['result'];
            final location = resObj['geometry']?['location'];
            final lat = (location?['lat'] as num?)?.toDouble() ?? 0.0;
            final lng = (location?['lng'] as num?)?.toDouble() ?? 0.0;
            final placeName = resObj['name']?.toString() ?? '';

            if (lat != 0.0 && lng != 0.0) {
              setState(() {
                selectedLat = lat;
                selectedLng = lng;
                _searchResults.clear();
                _searchController.clear();
              });
              _mapController.move(LatLng(lat, lng), 17.0);
              _parseGoogleAddressComponents(
                resObj['address_components'] as List?,
                formattedAddress: resObj['formatted_address']?.toString(),
                placeName: placeName,
              );
              return;
            }
          }
        }
      } catch (e) {
        debugPrint('Backend details error: $e');
      }

      // Fallback: Direct Google Place Details HTTP
      try {
        final apiKey = AppConfig.googleMapsApiKey;
        if (apiKey.isNotEmpty) {
          final detailsUrl = Uri.parse(
            'https://maps.googleapis.com/maps/api/place/details/json?place_id=$placeId&fields=name,geometry,address_components,formatted_address,types&key=$apiKey',
          );
          final res = await http.get(detailsUrl);
          if (res.statusCode == 200) {
            final data = json.decode(res.body);
            if (data['status'] == 'OK' && data['result'] != null) {
              final resObj = data['result'];
              final location = resObj['geometry']?['location'];
              final lat = (location?['lat'] as num?)?.toDouble() ?? 0.0;
              final lng = (location?['lng'] as num?)?.toDouble() ?? 0.0;
              final placeName = resObj['name']?.toString() ?? '';

              if (lat != 0.0 && lng != 0.0) {
                setState(() {
                  selectedLat = lat;
                  selectedLng = lng;
                  _searchResults.clear();
                  _searchController.clear();
                });
                _mapController.move(LatLng(lat, lng), 17.0);
                _parseGoogleAddressComponents(
                  resObj['address_components'] as List?,
                  formattedAddress: resObj['formatted_address']?.toString(),
                  placeName: placeName,
                );
                return;
              }
            }
          }
        }
      } catch (e) {
        debugPrint('Error fetching Google Place details: $e');
      }
    }

    // Direct coords from search result (e.g. OSM)
    if (directLat != null &&
        directLng != null &&
        directLat != 0.0 &&
        directLng != 0.0) {
      setState(() {
        selectedLat = directLat;
        selectedLng = directLng;
        _searchResults.clear();
        _searchController.clear();
      });
      _mapController.move(LatLng(directLat, directLng), 17.0);
      await _reverseGeocodeLocation(directLat, directLng);
      return;
    }
  }

  Future<void> _requestAndSetCurrentLocation() async {
    if (!mounted) return;
    setState(() {
      isLoadingLocation = true;
    });

    try {
      final Position? position =
          await LocationHelper.getCurrentPositionWithPrompt(context);

      if (position != null && mounted) {
        setState(() {
          selectedLat = position.latitude;
          selectedLng = position.longitude;
        });

        _mapController.move(LatLng(selectedLat, selectedLng), 16.5);
        await _reverseGeocodeLocation(selectedLat, selectedLng);
      }
    } catch (e) {
      if (mounted) {
        F2HToast.error(
          context,
          'Failed to fetch current location: ${extractErrorMessage(e)}',
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          isLoadingLocation = false;
        });
      }
    }
  }

  Future<void> _reverseGeocodeLocation(double lat, double lng) async {
    if (!mounted) return;
    setState(() {
      isReverseGeocoding = true;
    });

    try {
      // 1. Try Backend Proxy Geocoding (with business/establishment detection)
      final dio = sl<DioClient>().dio;
      final response = await dio.get(
        '/map/geocode',
        queryParameters: {'lat': lat, 'lng': lng},
      );
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        if (data['status'] == 'OK' &&
            data['results'] != null &&
            (data['results'] as List).isNotEmpty &&
            mounted) {
          final results = data['results'] as List;
          final firstResult = results[0];
          final components = firstResult['address_components'] as List?;
          final formatted = firstResult['formatted_address']?.toString();
          final businessName = data['business_name']?.toString() ?? '';

          _parseGoogleAddressComponents(
            components,
            formattedAddress: formatted,
            placeName: businessName,
            allResults: results,
          );
          return;
        }
      }
    } catch (e) {
      debugPrint('Backend geocode error: $e');
    }

    // 2. Fallback: Direct Google Geocoding
    try {
      final apiKey = AppConfig.googleMapsApiKey;
      if (apiKey.isNotEmpty) {
        final url = Uri.parse(
          'https://maps.googleapis.com/maps/api/geocode/json?latlng=$lat,$lng&region=in&key=$apiKey',
        );
        final response = await http.get(url);
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          if (data['status'] == 'OK' &&
              data['results'] != null &&
              (data['results'] as List).isNotEmpty &&
              mounted) {
            final results = data['results'] as List;
            final firstResult = results[0];
            final components = firstResult['address_components'] as List?;
            final formatted = firstResult['formatted_address']?.toString();
            _parseGoogleAddressComponents(
              components,
              formattedAddress: formatted,
              allResults: results,
            );
            return;
          }
        }
      }
    } catch (e) {
      debugPrint('Direct Google reverse geocode error: $e');
    }

    // 3. Fallback: Nominatim reverse
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=18&addressdetails=1',
      );
      final response = await http.get(
        url,
        headers: {'User-Agent': 'f2hcustomer_app/1.0'},
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final address = data['address'] as Map<String, dynamic>?;

        if (address != null && mounted) {
          final road = address['road']?.toString() ?? '';
          final suburb = address['suburb']?.toString() ?? '';
          final neighbourhood = address['neighbourhood']?.toString() ?? '';
          final cityDistrict = address['city_district']?.toString() ?? '';
          final county = address['county']?.toString() ?? '';

          final city =
              address['city']?.toString() ??
              address['town']?.toString() ??
              address['village']?.toString() ??
              address['municipality']?.toString() ??
              '';
          final state = address['state']?.toString() ?? '';
          final postcode = address['postcode']?.toString() ?? '';

          String streetValue = road.isNotEmpty
              ? road
              : (suburb.isNotEmpty ? suburb : county);
          String areaValue = neighbourhood.isNotEmpty
              ? neighbourhood
              : (cityDistrict.isNotEmpty
                    ? cityDistrict
                    : (suburb.isNotEmpty ? suburb : city));

          setState(() {
            streetController.text = streetValue;
            areaController.text = areaValue;
            cityController.text = city;
            stateController.text = state;
            pincodeController.text = postcode;
          });
        }
      }
    } catch (e) {
      debugPrint('Error reverse geocoding: $e');
    } finally {
      if (mounted) {
        setState(() {
          isReverseGeocoding = false;
        });
      }
    }
  }

  void _zoomIn() {
    final currentZoom = _mapController.camera.zoom;
    if (currentZoom < 19.5) {
      _mapController.move(LatLng(selectedLat, selectedLng), currentZoom + 1.0);
    }
  }

  void _zoomOut() {
    final currentZoom = _mapController.camera.zoom;
    if (currentZoom > 4.0) {
      _mapController.move(LatLng(selectedLat, selectedLng), currentZoom - 1.0);
    }
  }

  void _showLayerSelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Google Map Layers',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: kText,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildLayerOption(
                    type: MapLayerType.googleRoadmap,
                    label: 'Default',
                    icon: Icons.map_outlined,
                  ),
                  _buildLayerOption(
                    type: MapLayerType.googleSatellite,
                    label: 'Satellite',
                    icon: Icons.satellite_alt_outlined,
                  ),
                  _buildLayerOption(
                    type: MapLayerType.googleTerrain,
                    label: 'Terrain',
                    icon: Icons.terrain_outlined,
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLayerOption({
    required MapLayerType type,
    required String label,
    required IconData icon,
  }) {
    final isSelected = _currentLayer == type;
    return GestureDetector(
      onTap: () {
        setState(() {
          _currentLayer = type;
        });
        Navigator.pop(context);
      },
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isSelected ? kPrimary.withValues(alpha: 0.12) : kBg,
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected ? kPrimary : kBorder,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Icon(
              icon,
              color: isSelected ? kPrimary : kTextSub,
              size: 24,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
              color: isSelected ? kPrimary : kTextSub,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    if (_formKey.currentState!.validate()) {
      final name = contactNameController.text.trim();
      final mobile = contactMobileController.text.trim();
      final flat = flatNoController.text.trim();
      final building = buildingNameController.text.trim();
      final street = streetController.text.trim();
      final area = areaController.text.trim();
      final city = cityController.text.trim();
      final pincode = pincodeController.text.trim();

      if (name.isEmpty || mobile.isEmpty || flat.isEmpty) {
        F2HToast.error(context, 'Please fill all required (*) fields');
        return;
      }

      if (street.isEmpty || area.isEmpty || city.isEmpty || pincode.isEmpty) {
        F2HToast.error(
          context,
          'Please locate and pin your address on the map first.',
        );
        return;
      }

      final payload = {
        "address_type": addressType,
        "contact_name": name,
        "contact_mobile": mobile,
        "flat_no": flat,
        "floor_no": floorNoController.text.trim(),
        "building_name": building,
        "street": street,
        "area": area,
        "city": city,
        "state": stateController.text.trim(),
        "pincode": pincode,
        "landmark": landmarkController.text.trim(),
        "delivery_note": deliveryNoteController.text.trim(),
        "is_default": isDefault ? true : false,
        "latitude": selectedLat,
        "longitude": selectedLng,
      };

      setState(() {
        isSaving = true;
      });

      try {
        final sessionCubit = context.read<CustomerSessionCubit>();
        if (widget.existing != null) {
          await sessionCubit.bootstrapApi.updateAddress(
            widget.existing!.addressId!,
            payload,
          );
        } else {
          await sessionCubit.bootstrapApi.addAddress(payload);
        }
        await sessionCubit.refresh();
        if (mounted) {
          Navigator.pop(context);
          F2HToast.success(
            context,
            widget.existing != null
                ? 'Address updated successfully'
                : 'Address added successfully',
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            isSaving = false;
          });
          F2HToast.error(context, extractErrorMessage(e));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existing != null;

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kSurface,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: kText, size: 20),
          onPressed: () {
            if (_isMapExpanded && !isEdit) {
              Navigator.pop(context);
            } else if (_isMapExpanded && isEdit) {
              setState(() {
                _isMapExpanded = false;
              });
            } else {
              Navigator.pop(context);
            }
          },
        ),
        title: Text(
          _isMapExpanded
              ? 'Pin Location on Google Map'
              : (isEdit ? 'Modify Address' : 'New Address Details'),
          style: const TextStyle(
            color: kText,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        centerTitle: true,
        actions: [
          if (isEdit && !_isMapExpanded)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: kRed),
              onPressed: () async {
                final localContext = context;
                final confirm = await showDialog<bool>(
                  context: localContext,
                  builder: (c) => AlertDialog(
                    title: const Text('Delete Address'),
                    content: const Text(
                      'Are you sure you want to delete this address?',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(c, false),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(c, true),
                        child: const Text(
                          'Delete',
                          style: TextStyle(color: kRed),
                        ),
                      ),
                    ],
                  ),
                );
                if (confirm == true && localContext.mounted) {
                  setState(() {
                    isSaving = true;
                  });
                  try {
                    final sessionCubit = localContext
                        .read<CustomerSessionCubit>();
                    await sessionCubit.bootstrapApi.deleteAddress(
                      widget.existing!.addressId!,
                    );
                    await sessionCubit.refresh();
                    if (localContext.mounted) {
                      Navigator.pop(localContext);
                      F2HToast.success(
                        localContext,
                        'Address deleted successfully',
                      );
                    }
                  } catch (e) {
                    if (localContext.mounted) {
                      setState(() {
                        isSaving = false;
                      });
                      F2HToast.error(localContext, extractErrorMessage(e));
                    }
                  }
                }
              },
            ),
        ],
      ),
      body: BlocListener<CustomerSessionCubit, CustomerSessionState>(
        listener: (context, sessionState) {
          if (widget.existing == null && sessionState.profile != null) {
            final p = sessionState.profile!;
            if (contactNameController.text.trim().isEmpty) {
              final pName = p.name.isNotEmpty
                  ? p.name
                  : '${p.firstName} ${p.lastName}'.trim();
              if (pName.isNotEmpty) {
                contactNameController.text = pName;
              }
            }
            if (contactMobileController.text.trim().isEmpty &&
                p.mobile.isNotEmpty) {
              contactMobileController.text = p.mobile;
            }
          }
        },
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              // Full-screen Map view
              if (_isMapExpanded) Expanded(child: _buildMapWidget()),

              // Address Form View
              if (!_isMapExpanded) ...[
                if (!_isLocationAllowed())
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      vertical: 10,
                      horizontal: 16,
                    ),
                    decoration: BoxDecoration(
                      color: kRed.withValues(alpha: 0.08),
                      border: const Border(
                        bottom: BorderSide(color: kRed, width: 0.5),
                      ),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.error_outline_rounded,
                          color: kRed,
                          size: 18,
                        ),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Order not allowed for that location (Outside service area)',
                            style: TextStyle(
                              color: kRed,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Compact Google Map Snippet Card with Tap to Re-pin
                        Container(
                          height: 180,
                          width: double.infinity,
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: kBorder),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Stack(
                            children: [
                              FlutterMap(
                                options: MapOptions(
                                  initialCenter: LatLng(selectedLat, selectedLng),
                                  initialZoom: 16.0,
                                  interactionOptions: const InteractionOptions(
                                    flags: InteractiveFlag.none,
                                  ),
                                ),
                                children: [
                                  TileLayer(
                                    urlTemplate: _currentTileUrl,
                                    subdomains: const ['mt0', 'mt1', 'mt2', 'mt3'],
                                    userAgentPackageName: 'com.f2h.customer',
                                  ),
                                  MarkerLayer(
                                    markers: [
                                      Marker(
                                        point: LatLng(selectedLat, selectedLng),
                                        width: 36,
                                        height: 36,
                                        child: const Icon(
                                          Icons.location_on_rounded,
                                          color: Color(0xFFEA4335),
                                          size: 36,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              Positioned(
                                top: 10,
                                left: 10,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.15),
                                        blurRadius: 6,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.check_circle_rounded, color: Colors.green, size: 14),
                                      SizedBox(width: 5),
                                      Text(
                                        'Google Map Pinned',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: Colors.black87,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: 10,
                                right: 10,
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    setState(() {
                                      _isMapExpanded = true;
                                    });
                                  },
                                  icon: const Icon(Icons.edit_location_alt_rounded, size: 16),
                                  label: const Text(
                                    'Change Pin on Map',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: kPrimary,
                                    foregroundColor: Colors.white,
                                    elevation: 4,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Formatted Address summary
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: kBorder),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.pin_drop_rounded,
                                color: kPrimary,
                                size: 22,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  _formattedAddress.isNotEmpty
                                      ? _formattedAddress
                                      : 'Coordinates: ${selectedLat.toStringAsFixed(5)}, ${selectedLng.toStringAsFixed(5)}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: kText,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),

                        _sectionHeader('CONTACT DETAILS'),
                        const SizedBox(height: 10),
                        _buildField(
                          contactNameController,
                          'Full Name *',
                          Icons.person_outline,
                          validator: (v) => v!.isEmpty ? 'Name required' : null,
                        ),
                        const SizedBox(height: 12),
                        _buildField(
                          contactMobileController,
                          'Mobile Number *',
                          Icons.phone_outlined,
                          keyboard: TextInputType.phone,
                          validator: (v) =>
                              v!.length < 10 ? 'Enter valid 10-digit number' : null,
                        ),

                        const SizedBox(height: 24),
                        _sectionHeader('ADDRESS DETAILS'),
                        const SizedBox(height: 10),
                        _buildField(
                          flatNoController,
                          'Flat / House / Apartment No *',
                          Icons.home_outlined,
                          validator: (v) => v!.isEmpty
                              ? 'Flat/House number is required'
                              : null,
                        ),
                        const SizedBox(height: 12),
                        _buildField(
                          buildingNameController,
                          'Building / Apartment Name (Optional)',
                          Icons.apartment_outlined,
                        ),
                        const SizedBox(height: 12),
                        _buildField(
                          landmarkController,
                          'Landmark (Optional)',
                          Icons.pin_drop_outlined,
                        ),
                        const SizedBox(height: 12),
                        _buildField(
                          streetController,
                          'Street / Road *',
                          Icons.add_road_outlined,
                          validator: (v) => v!.isEmpty ? 'Street required' : null,
                        ),
                        const SizedBox(height: 12),
                        _buildField(
                          areaController,
                          'Area / Locality *',
                          Icons.location_city_outlined,
                          validator: (v) => v!.isEmpty ? 'Area required' : null,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _buildField(
                                cityController,
                                'City *',
                                Icons.location_city_rounded,
                                validator: (v) => v!.isEmpty ? 'City required' : null,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _buildField(
                                pincodeController,
                                'PIN Code *',
                                Icons.numbers_rounded,
                                keyboard: TextInputType.number,
                                validator: (v) => v!.isEmpty ? 'PIN required' : null,
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 24),
                        _sectionHeader('DELIVERY INSTRUCTIONS'),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            'Leave at Door',
                            'Ring Bell',
                            'Hand to Me',
                            'Other',
                          ].map((instruction) {
                            final isSel =
                                _selectedInstruction == instruction;
                            final color = isSel ? kPrimary : kTextSub;
                            final borderColor = isSel ? kPrimary : kBorder;

                            return ChoiceChip(
                              label: Text(
                                instruction,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: color,
                                ),
                              ),
                              selected: isSel,
                              selectedColor: kPrimaryPl,
                              backgroundColor: kSurface,
                              checkmarkColor: kPrimary,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                                side: BorderSide(
                                  color: borderColor,
                                  width: 1.5,
                                ),
                              ),
                              onSelected: (selected) {
                                if (selected) {
                                  setState(() {
                                    _selectedInstruction = instruction;
                                    if (instruction != 'Other') {
                                      deliveryNoteController.text =
                                          instruction;
                                    } else {
                                      final currentText =
                                          deliveryNoteController.text;
                                      if (currentText == 'Leave at Door' ||
                                          currentText == 'Ring Bell' ||
                                          currentText == 'Hand to Me') {
                                        deliveryNoteController.clear();
                                      }
                                    }
                                  });
                                } else {
                                  setState(() {
                                    _selectedInstruction = null;
                                    deliveryNoteController.clear();
                                  });
                                }
                              },
                            );
                          }).toList(),
                        ),
                        if (_selectedInstruction == 'Other') ...[
                          const SizedBox(height: 12),
                          _buildField(
                            deliveryNoteController,
                            'Custom delivery instructions (e.g. Leave with security)',
                            Icons.note_add_outlined,
                          ),
                        ],

                        const SizedBox(height: 24),
                        _sectionHeader('SAVE AS'),
                        const SizedBox(height: 10),

                        Row(
                          children: ['home', 'office', 'other'].map((type) {
                            final isSel = addressType == type;
                            final label =
                                type[0].toUpperCase() + type.substring(1);
                            final color = isSel ? kPrimary : kTextSub;
                            final bgColor = isSel ? kPrimaryPl : kSurface;

                            return Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => addressType = type),
                                child: Container(
                                  margin: const EdgeInsets.symmetric(
                                    horizontal: 4,
                                  ),
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                  decoration: BoxDecoration(
                                    color: bgColor,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: isSel ? kPrimary : kBorder,
                                      width: 1.5,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        _getTypeIcon(type),
                                        size: 16,
                                        color: color,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        label,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                          color: color,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),

                        const SizedBox(height: 20),

                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: kBorder),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.bookmark_added_outlined,
                                color: kPrimaryMid,
                                size: 20,
                              ),
                              const SizedBox(width: 12),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Set as Default Address',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 13,
                                        color: kText,
                                      ),
                                    ),
                                    SizedBox(height: 2),
                                    Text(
                                      'Deliveries will go to this address by default',
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: kTextSub,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Switch(
                                value: isDefault,
                                activeThumbColor: kPrimary,
                                onChanged: (val) =>
                                    setState(() => isDefault = val),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 40),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
      bottomNavigationBar: _isMapExpanded
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: ElevatedButton(
                  onPressed: (isSaving || !_isLocationAllowed()) ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 0,
                  ),
                  child: isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : !_isLocationAllowed()
                      ? const Text(
                          'LOCATION OUTSIDE SERVICE AREA',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                            fontSize: 13,
                          ),
                        )
                      : Text(
                          isEdit ? 'SAVE CHANGES' : 'SAVE ADDRESS',
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                            fontSize: 13,
                          ),
                        ),
                ),
              ),
            ),
    );
  }

  IconData _getPlaceTypeIcon(List types) {
    final typeStrings = types.map((e) => e.toString().toLowerCase()).toList();
    if (typeStrings.any((t) =>
        t.contains('school') ||
        t.contains('university') ||
        t.contains('college'))) {
      return Icons.school_rounded;
    }
    if (typeStrings.any((t) => t.contains('hotel') || t.contains('lodging'))) {
      return Icons.hotel_rounded;
    }
    if (typeStrings.any((t) =>
        t.contains('hospital') ||
        t.contains('doctor') ||
        t.contains('health'))) {
      return Icons.local_hospital_rounded;
    }
    if (typeStrings.any((t) =>
        t.contains('restaurant') ||
        t.contains('food') ||
        t.contains('cafe'))) {
      return Icons.restaurant_rounded;
    }
    if (typeStrings.any((t) =>
        t.contains('store') ||
        t.contains('shop') ||
        t.contains('mall'))) {
      return Icons.storefront_rounded;
    }
    if (typeStrings.any((t) =>
        t.contains('business') ||
        t.contains('establishment') ||
        t.contains('office'))) {
      return Icons.business_rounded;
    }
    if (typeStrings.any((t) =>
        t.contains('sublocality') ||
        t.contains('neighborhood') ||
        t.contains('colony') ||
        t.contains('residential'))) {
      return Icons.home_work_rounded;
    }
    return Icons.location_on_rounded;
  }

  Widget _buildMapWidget() {
    final isDeliverable = _isLocationAllowed();

    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: LatLng(selectedLat, selectedLng),
            initialZoom: 16.5,
            minZoom: 4.0,
            maxZoom: 19.5,
            onTap: (tapPosition, point) {
              setState(() {
                selectedLat = point.latitude;
                selectedLng = point.longitude;
              });
              _mapController.move(point, _mapController.camera.zoom);
              _mapMoveDebounce?.cancel();
              _mapMoveDebounce = Timer(const Duration(milliseconds: 500), () {
                _reverseGeocodeLocation(point.latitude, point.longitude);
              });
            },
            onPositionChanged: (position, hasGesture) {
              if (hasGesture) {
                final center = position.center;
                setState(() {
                  _isMapDragging = true;
                  selectedLat = center.latitude;
                  selectedLng = center.longitude;
                });
                _mapMoveDebounce?.cancel();
                _mapMoveDebounce = Timer(
                  const Duration(milliseconds: 600),
                  () {
                    if (mounted) {
                      setState(() {
                        _isMapDragging = false;
                      });
                      _reverseGeocodeLocation(selectedLat, selectedLng);
                    }
                  },
                );
              }
            },
          ),
          children: [
            TileLayer(
              urlTemplate: _currentTileUrl,
              subdomains: const ['mt0', 'mt1', 'mt2', 'mt3'],
              userAgentPackageName: 'com.f2h.customer',
              maxZoom: 20,
            ),
            CircleLayer(
              circles: activeBranches
                  .where((branch) {
                    final shape =
                        branch['hex_shape']?.toString().toLowerCase() ??
                        'circle';
                    return shape == 'circle';
                  })
                  .map((branch) {
                    final bLat =
                        double.tryParse(branch['lat']?.toString() ?? '') ??
                        0.0;
                    final bLng =
                        double.tryParse(branch['lng']?.toString() ?? '') ??
                        0.0;
                    final radiusKm =
                        double.tryParse(
                          branch['delivery_radius_km']?.toString() ?? '',
                        ) ??
                        5.0;
                    return CircleMarker(
                      point: LatLng(bLat, bLng),
                      radius: radiusKm * 1000,
                      useRadiusInMeter: true,
                      color: kPrimary.withValues(alpha: 0.12),
                      borderColor: kPrimary.withValues(alpha: 0.6),
                      borderStrokeWidth: 2,
                    );
                  })
                  .toList(),
            ),
            PolygonLayer(
              polygons: activeBranches
                  .where((branch) {
                    final shape =
                        branch['hex_shape']?.toString().toLowerCase() ??
                        'circle';
                    return shape == 'hexagon' ||
                        shape == 'square' ||
                        shape == 'rectangle';
                  })
                  .map((branch) {
                    final bLat =
                        double.tryParse(branch['lat']?.toString() ?? '') ??
                        0.0;
                    final bLng =
                        double.tryParse(branch['lng']?.toString() ?? '') ??
                        0.0;
                    final radiusKm =
                        double.tryParse(
                          branch['delivery_radius_km']?.toString() ?? '',
                        ) ??
                        5.0;
                    final shape =
                        branch['hex_shape']?.toString().toLowerCase() ??
                        'circle';
                    final points = shape == 'hexagon'
                        ? getHexagonPoints(LatLng(bLat, bLng), radiusKm)
                        : shape == 'rectangle'
                        ? getRectanglePoints(LatLng(bLat, bLng), radiusKm)
                        : getSquarePoints(LatLng(bLat, bLng), radiusKm);
                    return Polygon(
                      points: points,
                      color: kPrimary.withValues(alpha: 0.12),
                      borderColor: kPrimary.withValues(alpha: 0.6),
                      borderStrokeWidth: 2,
                    );
                  })
                  .toList(),
            ),
          ],
        ),

        // Center Pin & Floating Tooltip (Google Maps Pin Placement)
        Positioned.fill(
          child: IgnorePointer(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 38),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Floating Badge
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      transform: Matrix4.translationValues(
                        0,
                        _isMapDragging ? -10 : 0,
                        0,
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(
                              alpha: _isMapDragging ? 0.25 : 0.15,
                            ),
                            blurRadius: _isMapDragging ? 14 : 8,
                            offset: Offset(0, _isMapDragging ? 6 : 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (isReverseGeocoding)
                            const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: kPrimary,
                              ),
                            )
                          else
                            Icon(
                              isDeliverable
                                  ? Icons.local_shipping_rounded
                                  : Icons.info_outline_rounded,
                              color: isDeliverable ? Colors.green : Colors.orange,
                              size: 16,
                            ),
                          const SizedBox(width: 8),
                          Text(
                            _isMapDragging
                                ? 'Pinning location...'
                                : (isReverseGeocoding
                                    ? 'Locating address...'
                                    : (isDeliverable
                                        ? 'Products delivered here'
                                        : 'Outside standard zone')),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),

                    // Google Map Marker Icon
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      transform: Matrix4.translationValues(
                        0,
                        _isMapDragging ? -12 : 0,
                        0,
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          const Icon(
                            Icons.location_on_rounded,
                            color: Color(0xFFEA4335), // Google Map Pin Red
                            size: 46,
                          ),
                          Positioned(
                            top: 10,
                            child: Container(
                              width: 11,
                              height: 11,
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Ground Shadow
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: _isMapDragging ? 8 : 14,
                      height: _isMapDragging ? 3 : 5,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(
                          alpha: _isMapDragging ? 0.15 : 0.4,
                        ),
                        borderRadius: BorderRadius.all(
                          Radius.elliptical(
                            _isMapDragging ? 8 : 14,
                            _isMapDragging ? 3 : 5,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // Floating Search Bar with India Google Places Autocomplete
        Positioned(
          top: 12,
          left: 12,
          right: 12,
          child: Column(
            children: [
              Container(
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(30),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search place, colony, building, school, hotel...',
                    hintStyle: const TextStyle(
                      color: kMuted,
                      fontSize: 13,
                    ),
                    prefixIcon: const Icon(Icons.search_rounded, color: kPrimary),
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (isSearching)
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 8.0),
                            child: SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: kPrimary,
                              ),
                            ),
                          ),
                        if (_searchController.text.isNotEmpty)
                          IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {
                                _searchResults.clear();
                                isSearching = false;
                              });
                            },
                          ),
                      ],
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                  ),
                  onChanged: _onSearchChanged,
                ),
              ),
              if (_searchResults.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  constraints: const BoxConstraints(maxHeight: 240),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.18),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    shrinkWrap: true,
                    itemCount: _searchResults.length,
                    separatorBuilder: (ctx, idx) =>
                        const Divider(height: 1, color: kBorderLt),
                    itemBuilder: (context, index) {
                      final result = _searchResults[index];
                      final mainText = result['main_text']?.toString() ?? '';
                      final desc =
                          result['display_name'] ?? result['description'] ?? '';
                      final secondaryText =
                          result['secondary_text']?.toString() ?? desc;
                      final types = (result['types'] as List?) ?? [];

                      return ListTile(
                        dense: true,
                        leading: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: kPrimary.withValues(alpha: 0.08),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _getPlaceTypeIcon(types),
                            color: kPrimary,
                            size: 18,
                          ),
                        ),
                        title: Text(
                          mainText.isNotEmpty ? mainText : desc,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: kText,
                          ),
                        ),
                        subtitle: mainText.isNotEmpty &&
                                secondaryText.isNotEmpty &&
                                secondaryText != mainText
                            ? Text(
                                secondaryText,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: kTextSub,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              )
                            : null,
                        onTap: () => _selectSearchResult(result),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),

        // Floating Map Controls (Right Side)
        Positioned(
          top: 72,
          right: 12,
          child: Column(
            children: [
              // Layer Switcher (Google Map Layers)
              FloatingActionButton.small(
                heroTag: 'layer_btn_add_address',
                onPressed: _showLayerSelector,
                backgroundColor: kSurface,
                foregroundColor: kPrimary,
                elevation: 3,
                tooltip: 'Map Layers',
                child: const Icon(Icons.layers_rounded, size: 20),
              ),
              const SizedBox(height: 8),

              // Zoom In
              FloatingActionButton.small(
                heroTag: 'zoom_in_add_address',
                onPressed: _zoomIn,
                backgroundColor: kSurface,
                foregroundColor: kText,
                elevation: 3,
                tooltip: 'Zoom In',
                child: const Icon(Icons.add_rounded, size: 20),
              ),
              const SizedBox(height: 8),

              // Zoom Out
              FloatingActionButton.small(
                heroTag: 'zoom_out_add_address',
                onPressed: _zoomOut,
                backgroundColor: kSurface,
                foregroundColor: kText,
                elevation: 3,
                tooltip: 'Zoom Out',
                child: const Icon(Icons.remove_rounded, size: 20),
              ),
              const SizedBox(height: 8),

              // GPS Current Location Button
              FloatingActionButton.small(
                heroTag: 'gps_fab_add_address',
                onPressed: isLoadingLocation ? null : _requestAndSetCurrentLocation,
                backgroundColor: kSurface,
                foregroundColor: kPrimary,
                elevation: 3,
                tooltip: 'Current GPS Location',
                child: isLoadingLocation
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: kPrimary,
                        ),
                      )
                    : const Icon(Icons.my_location_rounded, size: 20),
              ),
            ],
          ),
        ),

        // Bottom Confirmation Panel (when expanded in full-screen map mode)
        if (_isMapExpanded)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.12),
                    blurRadius: 16,
                    offset: const Offset(0, -4),
                  ),
                ],
              ),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: kPrimary.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.place_rounded,
                            color: kPrimary,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'SELECTED LOCATION',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: kTextSub,
                                  letterSpacing: 0.8,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _formattedAddress.isNotEmpty
                                    ? _formattedAddress
                                    : 'Pin at ${selectedLat.toStringAsFixed(5)}, ${selectedLng.toStringAsFixed(5)}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: kText,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Serviceability Pill
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDeliverable
                            ? Colors.green.withValues(alpha: 0.08)
                            : Colors.orange.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isDeliverable
                              ? Colors.green.withValues(alpha: 0.3)
                              : Colors.orange.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isDeliverable
                                ? Icons.check_circle_rounded
                                : Icons.warning_amber_rounded,
                            color: isDeliverable ? Colors.green : Colors.orange.shade800,
                            size: 14,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isDeliverable
                                ? 'Deliverable location in service area'
                                : 'Location is outside current service boundary',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: isDeliverable
                                  ? Colors.green.shade800
                                  : Colors.orange.shade900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Lock & Proceed Button
                    ElevatedButton(
                      onPressed: () {
                        setState(() {
                          _isMapExpanded = false;
                        });
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_rounded, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'CONFIRM PIN LOCATION & ENTER DETAILS',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _sectionHeader(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w800,
        color: kTextSub,
        letterSpacing: 1.0,
      ),
    );
  }

  Widget _buildField(
    TextEditingController ctrl,
    String hint,
    IconData icon, {
    TextInputType keyboard = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: kBorder),
      ),
      child: TextFormField(
        controller: ctrl,
        keyboardType: keyboard,
        validator: validator,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: kText,
        ),
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: kMuted, size: 18),
          hintText: hint,
          hintStyle: const TextStyle(
            color: kMuted,
            fontSize: 13,
            fontWeight: FontWeight.w400,
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 12,
          ),
        ),
      ),
    );
  }

  IconData _getTypeIcon(String type) {
    switch (type) {
      case 'home':
        return Icons.home_rounded;
      case 'office':
        return Icons.business_rounded;
      default:
        return Icons.place_rounded;
    }
  }
}
