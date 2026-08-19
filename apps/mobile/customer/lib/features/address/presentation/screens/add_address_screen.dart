import 'dart:async';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import 'package:f2h_customer/theme/app_colors.dart';
import 'package:f2h_customer/core/widgets/hot_toast.dart';
import 'package:f2h_customer/core/di/injection.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/features/address/data/models/profile_address.dart';
import 'package:f2h_customer/core/config/app_config.dart';

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
  Timer? _mapMoveDebounce;
  String? _selectedInstruction;

  late double selectedLat;
  late double selectedLng;

  late final MapController _mapController;


  Timer? _searchDebounce;
  List<dynamic> _searchResults = [];

  List<dynamic> activeBranches = [];
  bool isLoadingBranches = true;

  String get _formattedAddress => [
      streetController.text,
      areaController.text,
      cityController.text,
      stateController.text,
      pincodeController.text,
    ]
        .where((e) => e.trim().isNotEmpty)
        .join(', ');

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
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180) * cos(lat2 * pi / 180) * sin(dLon / 2) * sin(dLon / 2);
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
      final newLat = asin(sin(latRad) * cos(rRad) + cos(latRad) * sin(rRad) * cos(angle));
      final newLng = center.longitude * pi / 180.0 + atan2(sin(angle) * sin(rRad) * cos(latRad), cos(rRad) - sin(latRad) * sin(newLat));
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
      final newLat = asin(sin(latRad) * cos(rRad) + cos(latRad) * sin(rRad) * cos(angle));
      final newLng = center.longitude * pi / 180.0 + atan2(sin(angle) * sin(rRad) * cos(latRad), cos(rRad) - sin(latRad) * sin(newLat));
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
      // If still loading and we have a cached copy in session, use it
      final cached = context.read<CustomerSessionCubit>().state.branches;
      if (cached.isNotEmpty) {
        activeBranches = cached;
      } else {
        return isLoadingBranches; // Allow during initial load, block if loaded and empty
      }
    }

    final point = LatLng(selectedLat, selectedLng);

    for (final branch in activeBranches) {
      final bLat = double.tryParse(branch['lat']?.toString() ?? '') ?? 0.0;
      final bLng = double.tryParse(branch['lng']?.toString() ?? '') ?? 0.0;
      if (bLat == 0.0 || bLng == 0.0) continue;

      final radiusKm = double.tryParse(branch['delivery_radius_km']?.toString() ?? '') ?? 5.0;
      final bufferZone = double.tryParse(branch['buffer_zone']?.toString() ?? '') ?? 0.0;
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
      } else {
        // default circle
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
    buildingNameController = TextEditingController(text: address?.buildingName ?? '');
    streetController = TextEditingController(text: address?.street ?? '');
    areaController = TextEditingController(text: address?.area ?? '');
    cityController = TextEditingController(text: address?.city ?? 'Bengaluru');
    stateController = TextEditingController(text: address?.state ?? 'Karnataka');
    pincodeController = TextEditingController(text: address?.pincode ?? '');
    landmarkController = TextEditingController(text: address?.landmark ?? '');
    deliveryNoteController = TextEditingController(text: address?.deliveryNote ?? '');

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

  void _onSearchChanged(String query) {
    _searchDebounce?.cancel();
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults.clear();
      });
      return;
    }
    _searchDebounce = Timer(const Duration(milliseconds: 800), () {
      _performSearch(query);
    });
  }

  void _parseGoogleAddressComponents(List? components) {
    if (components == null) return;
    String streetNum = '';
    String route = '';
    String area = '';
    String city = '';
    String state = '';
    String pincode = '';

    for (final comp in components) {
      final types = (comp['types'] as List?)?.map((e) => e.toString()).toList() ?? [];
      final name = comp['long_name']?.toString() ?? '';

      if (types.contains('street_number')) {
        streetNum = name;
      } else if (types.contains('route')) {
        route = name;
      } else if (types.contains('sublocality_level_1') || types.contains('sublocality') || types.contains('neighborhood')) {
        if (area.isEmpty) area = name;
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

    String streetValue = [streetNum, route].where((s) => s.isNotEmpty).join(' ');

    setState(() {
      if (streetValue.isNotEmpty) streetController.text = streetValue;
      if (area.isNotEmpty) areaController.text = area;
      if (city.isNotEmpty) cityController.text = city;
      if (state.isNotEmpty) stateController.text = state;
      if (pincode.isNotEmpty) pincodeController.text = pincode;
    });
  }

  Future<void> _performSearch(String query) async {
    try {
      final apiKey = AppConfig.googleMapsApiKey;
      if (apiKey.isNotEmpty) {
        final url = Uri.parse(
          'https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${Uri.encodeComponent(query)}&key=$apiKey',
        );
        final response = await http.get(url);
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          if (data['status'] == 'OK' && data['predictions'] != null && mounted) {
            setState(() {
              _searchResults = (data['predictions'] as List).map((p) => {
                'description': p['description'] ?? '',
                'place_id': p['place_id'] ?? '',
              }).toList();
            });
            return;
          }
        }
      }

      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/search?format=json&q=${Uri.encodeComponent(query)}&limit=5&addressdetails=1',
      );
      final response = await http.get(
        url,
        headers: {
          'User-Agent': 'f2hcustomer_app/1.0',
        },
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (mounted) {
          setState(() {
            _searchResults = data as List;
          });
        }
      }
    } catch (e) {
      debugPrint('Search error: $e');
    }
  }

  Future<void> _selectSearchResult(dynamic result) async {
    final apiKey = AppConfig.googleMapsApiKey;
    final placeId = result['place_id']?.toString() ?? '';

    if (apiKey.isNotEmpty && placeId.isNotEmpty) {
      try {
        final detailsUrl = Uri.parse(
          'https://maps.googleapis.com/maps/api/place/details/json?place_id=$placeId&fields=geometry,address_components,formatted_address&key=$apiKey',
        );
        final res = await http.get(detailsUrl);
        if (res.statusCode == 200) {
          final data = json.decode(res.body);
          if (data['status'] == 'OK' && data['result'] != null) {
            final resObj = data['result'];
            final location = resObj['geometry']?['location'];
            final lat = (location?['lat'] as num?)?.toDouble() ?? 0.0;
            final lng = (location?['lng'] as num?)?.toDouble() ?? 0.0;

            if (lat != 0.0 && lng != 0.0) {
              setState(() {
                selectedLat = lat;
                selectedLng = lng;
                _searchResults.clear();
                _searchController.clear();
              });
              _mapController.move(LatLng(lat, lng), 16.0);
              _parseGoogleAddressComponents(resObj['address_components'] as List?);
              return;
            }
          }
        }
      } catch (e) {
        debugPrint('Error fetching Google Place details: $e');
      }
    }

    final lat = double.tryParse(result['lat']?.toString() ?? '') ?? 0.0;
    final lon = double.tryParse(result['lon']?.toString() ?? '') ?? 0.0;
    if (lat != 0.0 && lon != 0.0) {
      setState(() {
        selectedLat = lat;
        selectedLng = lon;
        _searchResults.clear();
        _searchController.clear();
      });
      _mapController.move(LatLng(lat, lon), 16.0);

      final address = result['address'] as Map<String, dynamic>?;
      if (address != null) {
        final road = address['road']?.toString() ?? '';
        final suburb = address['suburb']?.toString() ?? '';
        final neighbourhood = address['neighbourhood']?.toString() ?? '';
        final cityDistrict = address['city_district']?.toString() ?? '';
        final county = address['county']?.toString() ?? '';

        final city = address['city']?.toString() ??
            address['town']?.toString() ??
            address['village']?.toString() ??
            address['municipality']?.toString() ??
            '';
        final state = address['state']?.toString() ?? '';
        final postcode = address['postcode']?.toString() ?? '';

        String streetValue = road.isNotEmpty ? road : (suburb.isNotEmpty ? suburb : county);
        String areaValue = neighbourhood.isNotEmpty
            ? neighbourhood
            : (cityDistrict.isNotEmpty ? cityDistrict : (suburb.isNotEmpty ? suburb : city));

        setState(() {
          streetController.text = streetValue;
          areaController.text = areaValue;
          cityController.text = city;
          stateController.text = state;
          pincodeController.text = postcode;
        });
      } else {
        _reverseGeocodeLocation(lat, lon);
      }
    }
  }

  Future<void> _requestAndSetCurrentLocation() async {
    if (!mounted) return;
    setState(() {
      isLoadingLocation = true;
    });

    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) {
          F2HToast.error(context, 'Location services are disabled on your device.');
        }
        setState(() => isLoadingLocation = false);
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (mounted) {
            F2HToast.error(context, 'Location permission denied.');
          }
          setState(() => isLoadingLocation = false);
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        if (mounted) {
          F2HToast.error(context, 'Location permission is permanently denied.');
        }
        setState(() => isLoadingLocation = false);
        return;
      }

      Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      if (mounted) {
        setState(() {
          selectedLat = position.latitude;
          selectedLng = position.longitude;
        });

        _mapController.move(LatLng(selectedLat, selectedLng), 16.0);
        await _reverseGeocodeLocation(selectedLat, selectedLng);
      }
    } catch (e) {
      if (mounted) {
        F2HToast.error(context, 'Failed to fetch current location: ${extractErrorMessage(e)}');
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
      final apiKey = AppConfig.googleMapsApiKey;
      if (apiKey.isNotEmpty) {
        final url = Uri.parse(
          'https://maps.googleapis.com/maps/api/geocode/json?latlng=$lat,$lng&key=$apiKey',
        );
        final response = await http.get(url);
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          if (data['status'] == 'OK' && data['results'] != null && (data['results'] as List).isNotEmpty && mounted) {
            final firstResult = data['results'][0];
            final components = firstResult['address_components'] as List?;
            _parseGoogleAddressComponents(components);
            return;
          }
        }
      }

      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=$lat&lon=$lng&zoom=18&addressdetails=1',
      );
      final response = await http.get(
        url,
        headers: {
          'User-Agent': 'f2hcustomer_app/1.0',
        },
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

          final city = address['city']?.toString() ??
              address['town']?.toString() ??
              address['village']?.toString() ??
              address['municipality']?.toString() ??
              '';
          final state = address['state']?.toString() ?? '';
          final postcode = address['postcode']?.toString() ?? '';

          String streetValue = road.isNotEmpty ? road : (suburb.isNotEmpty ? suburb : county);
          String areaValue = neighbourhood.isNotEmpty
              ? neighbourhood
              : (cityDistrict.isNotEmpty ? cityDistrict : (suburb.isNotEmpty ? suburb : city));

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
        F2HToast.error(context, 'Please locate and pin your address on the map first.');
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
          await sessionCubit.bootstrapApi.updateAddress(widget.existing!.addressId!, payload);
        } else {
          await sessionCubit.bootstrapApi.addAddress(payload);
        }
        await sessionCubit.refresh();
        if (mounted) {
          Navigator.pop(context);
          F2HToast.success(
            context,
            widget.existing != null ? 'Address updated successfully' : 'Address added successfully',
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
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isEdit ? 'Modify Address' : 'New Address Details',
          style: const TextStyle(color: kText, fontSize: 18, fontWeight: FontWeight.w800),
        ),
        centerTitle: true,
        actions: [
          if (isEdit)
            IconButton(
              icon: const Icon(Icons.delete_outline, color: kRed),
              onPressed: () async {
                final localContext = context;
                final confirm = await showDialog<bool>(
                  context: localContext,
                  builder: (c) => AlertDialog(
                    title: const Text('Delete Address'),
                    content: const Text('Are you sure you want to delete this address?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                      TextButton(
                        onPressed: () => Navigator.pop(c, true),
                        child: const Text('Delete', style: TextStyle(color: kRed)),
                      ),
                    ],
                  ),
                );
                if (confirm == true && localContext.mounted) {
                  setState(() {
                    isSaving = true;
                  });
                  try {
                    final sessionCubit = localContext.read<CustomerSessionCubit>();
                    await sessionCubit.bootstrapApi.deleteAddress(widget.existing!.addressId!);
                    await sessionCubit.refresh();
                    if (localContext.mounted) {
                      Navigator.pop(localContext);
                      F2HToast.success(localContext, 'Address deleted successfully');
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
            if (contactMobileController.text.trim().isEmpty && p.mobile.isNotEmpty) {
              contactMobileController.text = p.mobile;
            }
          }
        },
        child: Form(
          key: _formKey,
          child: Column(
          children: [
            // Map view container
            if (_isMapExpanded)
              Expanded(
                child: _buildMapWidget(),
              ),

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
                      bottom: BorderSide(
                        color: kRed,
                        width: 0.5,
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: kRed, size: 18),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'order not allowed for that location',
                          style: TextStyle(
                            color: kRed,
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Re-pin / Map location summary card
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
                        decoration: BoxDecoration(
                          color: kSurface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: kBorder),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: kPrimary.withValues(alpha: 0.08),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.location_on_rounded,
                                    color: kPrimary,
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Map Location Pinned',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                          color: kText,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _formattedAddress.isNotEmpty
                                            ? _formattedAddress
                                            : 'Coordinates: ${selectedLat.toStringAsFixed(5)}, ${selectedLng.toStringAsFixed(5)}',
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: kTextSub,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: () {
                                setState(() {
                                  _isMapExpanded = true;
                                });
                              },
                              icon: const Icon(Icons.map_outlined, size: 18),
                              label: const Text(
                                'OPEN FULL MAP TO RE-PIN',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: kPrimaryPl,
                                foregroundColor: kPrimary,
                                minimumSize: const Size(double.infinity, 44),
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      _sectionHeader('CONTACT DETAILS'),
                      const SizedBox(height: 10),
                      _buildField(contactNameController, 'Full Name *', Icons.person_outline, validator: (v) => v!.isEmpty ? 'Name required' : null),
                      const SizedBox(height: 12),
                      _buildField(contactMobileController, 'Mobile Number *', Icons.phone_outlined, keyboard: TextInputType.phone, validator: (v) => v!.length < 10 ? 'Enter valid number' : null),

                      const SizedBox(height: 24),
                      _sectionHeader('ADDRESS DETAILS'),
                      const SizedBox(height: 10),
                      _buildField(flatNoController, 'Flat / House / Apartment No *', Icons.home_outlined, validator: (v) => v!.isEmpty ? 'Flat/House number is required' : null),
                      const SizedBox(height: 12),
                      _buildField(landmarkController, 'Landmark (Optional)', Icons.pin_drop_outlined),

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
                          'Other'
                        ].map((instruction) {
                          final isSel = _selectedInstruction == instruction;
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
                              side: BorderSide(color: borderColor, width: 1.5),
                            ),
                            onSelected: (selected) {
                              if (selected) {
                                setState(() {
                                  _selectedInstruction = instruction;
                                  if (instruction != 'Other') {
                                    deliveryNoteController.text = instruction;
                                  } else {
                                    final currentText = deliveryNoteController.text;
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
                          final label = type[0].toUpperCase() + type.substring(1);
                          final color = isSel ? kPrimary : kTextSub;
                          final bgColor = isSel ? kPrimaryPl : kSurface;

                          return Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => addressType = type),
                              child: Container(
                                margin: const EdgeInsets.symmetric(horizontal: 4),
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  color: bgColor,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: isSel ? kPrimary : kBorder, width: 1.5),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(_getTypeIcon(type), size: 16, color: color),
                                    const SizedBox(width: 6),
                                    Text(
                                      label,
                                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color),
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
                            const Icon(Icons.bookmark_added_outlined, color: kPrimaryMid, size: 20),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Set as Default Address',
                                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: kText),
                                  ),
                                  SizedBox(height: 2),
                                  Text(
                                    'Deliveries will go to this address by default',
                                    style: TextStyle(fontSize: 10, color: kTextSub),
                                  ),
                                ],
                              ),
                            ),
                            Switch(
                              value: isDefault,
                              activeThumbColor: kPrimary,
                              onChanged: (val) => setState(() => isDefault = val),
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
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : !_isLocationAllowed()
                          ? const Text(
                              'LOCATION OUTSIDE SERVICE AREA',
                              style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0.5, fontSize: 13),
                            )
                          : Text(
                              isEdit ? 'SAVE CHANGES' : 'SAVE ADDRESS',
                              style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0.5, fontSize: 13),
                            ),
                ),
              ),
            ),
    );
  }

  Widget _buildMapWidget() {
    return Stack(
      children: [
        Container(
          height: _isMapExpanded ? double.infinity : 240,
          width: double.infinity,
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: kBorderLt)),
          ),
          child: FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: LatLng(selectedLat, selectedLng),
              initialZoom: 16.0,
              onPositionChanged: (position, hasGesture) {
                if (hasGesture) {
                  final center = position.center;
                  setState(() {
                    selectedLat = center.latitude;
                    selectedLng = center.longitude;
                  });
                  _mapMoveDebounce?.cancel();
                  _mapMoveDebounce = Timer(const Duration(milliseconds: 800), () {
                    _reverseGeocodeLocation(selectedLat, selectedLng);
                  });
                }
              },
            ),
            children: [
              TileLayer(
                urlTemplate: AppConfig.mapTileUrlTemplate,
                userAgentPackageName: 'com.f2h.customer',
              ),
              CircleLayer(
                circles: activeBranches
                    .where((branch) {
                      final shape = branch['hex_shape']?.toString().toLowerCase() ?? 'circle';
                      return shape == 'circle';
                    })
                    .map((branch) {
                      final bLat = double.tryParse(branch['lat']?.toString() ?? '') ?? 0.0;
                      final bLng = double.tryParse(branch['lng']?.toString() ?? '') ?? 0.0;
                      final radiusKm = double.tryParse(branch['delivery_radius_km']?.toString() ?? '') ?? 5.0;
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
                      final shape = branch['hex_shape']?.toString().toLowerCase() ?? 'circle';
                      return shape == 'hexagon' || shape == 'square';
                    })
                    .map((branch) {
                      final bLat = double.tryParse(branch['lat']?.toString() ?? '') ?? 0.0;
                      final bLng = double.tryParse(branch['lng']?.toString() ?? '') ?? 0.0;
                      final radiusKm = double.tryParse(branch['delivery_radius_km']?.toString() ?? '') ?? 5.0;
                      final shape = branch['hex_shape']?.toString().toLowerCase() ?? 'circle';
                      final points = shape == 'hexagon'
                          ? getHexagonPoints(LatLng(bLat, bLng), radiusKm)
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
              MarkerLayer(
                markers: [
                  Marker(
                    point: LatLng(selectedLat, selectedLng),
                    width: 180,
                    height: 90,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.15),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.local_shipping_rounded,
                                color: Colors.green,
                                size: 16,
                              ),
                              SizedBox(width: 6),
                              Text(
                                'Products delivered here',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.black87,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Icon(
                          Icons.location_on,
                          color: Colors.red,
                          size: 42,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Floating Search Bar above the map
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
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: 'Search address or location...',
                    prefixIcon: const Icon(Icons.search, color: kPrimary),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {
                                _searchResults.clear();
                              });
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                  onChanged: _onSearchChanged,
                ),
              ),
              if (_searchResults.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  constraints: const BoxConstraints(maxHeight: 180),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: _searchResults.length,
                    itemBuilder: (context, index) {
                      final result = _searchResults[index];
                      return ListTile(
                        title: Text(
                          result['display_name'] ?? result['description'] ?? '',
                          style: const TextStyle(fontSize: 12, color: kText),
                        ),
                        onTap: () => _selectSearchResult(result),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),

        // Minimize Map Toggle Button
        Positioned(
          bottom: 12,
          left: 12,
          child: ElevatedButton.icon(
            onPressed: () {
              setState(() {
                _isMapExpanded = false;
              });
            },
            icon: const Icon(Icons.fullscreen_exit, size: 16),
            label: const Text(
              'Lock Location',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: kPrimary,
              foregroundColor: kSurface,
              elevation: 3,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
          ),
        ),

        // Current Location Action Button
        Positioned(
          bottom: 12,
          right: 12,
          child: FloatingActionButton.small(
            heroTag: 'gps_fab_add_address',
            onPressed: isLoadingLocation ? null : _requestAndSetCurrentLocation,
            backgroundColor: kSurface,
            foregroundColor: kPrimary,
            child: isLoadingLocation
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
                  )
                : const Icon(Icons.gps_fixed),
          ),
        ),

        if (isReverseGeocoding)
          Positioned(
            bottom: 60,
            left: 12,
            child: const Card(
              elevation: 2,
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(strokeWidth: 1.5, color: kPrimary),
                    ),
                    SizedBox(width: 8),
                    Text('Locating...', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
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
      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: kTextSub, letterSpacing: 1.0),
    );
  }

  Widget _buildField(TextEditingController ctrl, String hint, IconData icon, {TextInputType keyboard = TextInputType.text, String? Function(String?)? validator}) {
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
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: kText),
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: kMuted, size: 18),
          hintText: hint,
          hintStyle: const TextStyle(color: kMuted, fontSize: 13, fontWeight: FontWeight.w400),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
    );
  }

  IconData _getTypeIcon(String type) {
    switch (type) {
      case 'home': return Icons.home_rounded;
      case 'office': return Icons.business_rounded;
      default: return Icons.place_rounded;
    }
  }
}
