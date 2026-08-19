import 'dart:io';
import 'package:dio/dio.dart';
import 'package:f2h_delivery/core/api/api_endpoints.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/features/delivery/data/delivery_order_model.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_delivery/features/orders/data/datasources/orders_remote_datasource.dart';
import 'package:f2h_delivery/features/orders/data/models/pickup_item_model.dart';
import 'package:f2h_delivery/features/orders/data/models/handover_model.dart';
import 'package:f2h_delivery/core/api/api_error.dart';
class OrdersRepositoryImpl implements OrdersRepository {
  final DioClient _dioClient;
  final OrdersRemoteDataSource _remoteDataSource;

  OrdersRepositoryImpl(this._dioClient) : _remoteDataSource = OrdersRemoteDataSource(dioClient: _dioClient);

  @override
  Future<List<DeliveryOrderModel>> fetchTodayOrders({String? status}) async {
    try {
      final response = await _dioClient.dio.get(
        ApiEndpoints.todayDeliveries,
        queryParameters: status != null ? {'status': status} : null,
      );
      final data = response.data;
      if (data != null && data['status'] == true) {
        final List<dynamic> deliveries = data['deliveries'] ?? [];
        return deliveries.map((json) => DeliveryOrderModel.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      throw _handleDioError(e, 'Failed to fetch today\'s orders');
    }
  }

  @override
  Future<bool> updateOrderStatus(
    String orderId,
    String status, {
    String? notes,
    int? emptyBottlesCollected,
    int? returnedContainers,
    int? damagedContainers,
    int? lostContainers,
    String? paymentMode,
    String? paymentStatus,
    String? deliveryImage,
    List<Map<String, dynamic>>? containerReturns,
  }) async {
    try {
      String? resolvedImageUrl = deliveryImage;

      // If deliveryImage is a local file path (i.e. not empty and does not start with http), upload it first
      if (deliveryImage != null && deliveryImage.isNotEmpty && !deliveryImage.startsWith('http')) {
        final file = File(deliveryImage);
        if (await file.exists()) {
          final fileName = 'proof_${orderId}_${DateTime.now().millisecondsSinceEpoch}.jpg';
          final multipartFile = await MultipartFile.fromFile(file.path, filename: fileName);
          final formData = FormData.fromMap({
            'file': multipartFile,
          });

          final uploadResponse = await _dioClient.dio.post(
            '${ApiEndpoints.updateOrderStatus}/$orderId/upload-proof',
            data: formData,
            options: Options(
              sendTimeout: const Duration(seconds: 60),
              receiveTimeout: const Duration(seconds: 30),
            ),
          );

          if (uploadResponse.data != null && uploadResponse.data['success'] == true) {
            resolvedImageUrl = uploadResponse.data['url'] as String?;
          } else {
            print('Proof photo upload failed: ${uploadResponse.data}');
          }
        }
      }

      final response = await _dioClient.dio.patch(
        '${ApiEndpoints.updateOrderStatus}/$orderId/status',
        data: {
          'status': status,
          if (notes != null) 'notes': notes,
          if (emptyBottlesCollected != null) 'empty_bottles_collected': emptyBottlesCollected,
          if (returnedContainers != null) 'returned_containers': returnedContainers,
          if (damagedContainers != null) 'damaged_containers': damagedContainers,
          if (lostContainers != null) 'lost_containers': lostContainers,
          if (paymentMode != null) 'payment_mode': paymentMode,
          if (paymentStatus != null) 'payment_status': paymentStatus,
          if (resolvedImageUrl != null) 'delivery_image': resolvedImageUrl,
          if (containerReturns != null) 'container_returns': containerReturns,
        },
      );
      final data = response.data;
      return data != null && data['status'] == true;
    } catch (e) {
      print('Error updating order status: $e');
      throw _handleDioError(e, 'Failed to update order status');
    }
  }

  @override
  Future<DeliveryRun?> fetchTodayRun({String? status}) async {
    try {
      final response = await _dioClient.dio.get(
        ApiEndpoints.todayRun,
        queryParameters: status != null ? {'status': status} : null,
      );
      final data = response.data;
      if (data != null && data['status'] == true && data['run_id'] != null) {
        return DeliveryRun.fromJson(data);
      }
      return null;
    } catch (e) {
      print('Failed to fetch today\'s run: $e');
      return null;
    }
  }

  @override
  Future<bool> startRun(String runId) async {
    try {
      final response = await _dioClient.dio.post(ApiEndpoints.startRun(runId));
      final data = response.data;
      return data != null && data['success'] == true;
    } catch (e) {
      print('Error starting run: $e');
      return false;
    }
  }

  @override
  Future<bool> markStopDelivered({
    required String runId,
    required String addressId,
    required String status,
    String? orderId,
    String? remarks,
    int? emptyBottlesCollected,
    int? returnedContainers,
    int? damagedContainers,
    int? lostContainers,
    String? paymentMode,
    String? paymentStatus,
    String? deliveryImage,
    double? latitude,
    double? longitude,
    List<Map<String, dynamic>>? containerReturns,
  }) async {
    try {
      String? resolvedImageUrl = deliveryImage;

      // If deliveryImage is a local file path, upload it first using orderId as context
      if (deliveryImage != null && deliveryImage.isNotEmpty && !deliveryImage.startsWith('http') && orderId != null) {
        final file = File(deliveryImage);
        if (await file.exists()) {
          final fileName = 'proof_${orderId}_${DateTime.now().millisecondsSinceEpoch}.jpg';
          final multipartFile = await MultipartFile.fromFile(file.path, filename: fileName);
          final formData = FormData.fromMap({
            'file': multipartFile,
          });

          final uploadResponse = await _dioClient.dio.post(
            '${ApiEndpoints.updateOrderStatus}/$orderId/upload-proof',
            data: formData,
            options: Options(
              sendTimeout: const Duration(seconds: 60),
              receiveTimeout: const Duration(seconds: 30),
            ),
          );

          if (uploadResponse.data != null && uploadResponse.data['success'] == true) {
            resolvedImageUrl = uploadResponse.data['url'] as String?;
          } else {
            print('Proof photo upload failed: ${uploadResponse.data}');
          }
        }
      }

      final response = await _dioClient.dio.patch(
        ApiEndpoints.markStopDelivered(runId, addressId),
        data: {
          'status': status,
          if (orderId != null) 'order_id': orderId,
          if (remarks != null) 'remarks': remarks,
          if (emptyBottlesCollected != null) 'empty_bottles_collected': emptyBottlesCollected,
          if (returnedContainers != null) 'returned_containers': returnedContainers,
          if (damagedContainers != null) 'damaged_containers': damagedContainers,
          if (lostContainers != null) 'lost_containers': lostContainers,
          if (paymentMode != null) 'payment_mode': paymentMode,
          if (paymentStatus != null) 'payment_status': paymentStatus,
          if (resolvedImageUrl != null) 'delivery_image': resolvedImageUrl,
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
          if (containerReturns != null) 'container_returns': containerReturns,
        },
      );
      final data = response.data;
      return data != null && data['status'] == true;
    } catch (e) {
      print('Error marking stop as delivered: $e');
      throw _handleDioError(e, 'Failed to mark stop as delivered');
    }
  }

  @override
  Future<PickupResponse> getPickupItems({String? date}) async {
    try {
      return await _remoteDataSource.getPickupItems(date: date);
    } catch (e) {
      print('getPickupItems API failed: $e, calculating fallback from today\'s orders...');
      try {
        final run = await fetchTodayRun();
        final loadedOrders = run?.orders ?? await fetchTodayOrders();
        final targetDate = (date ?? DateTime.now().toIso8601String()).split('T').first;
        final orders = loadedOrders
            .where((order) => (order.scheduledDate ?? '').split('T').first == targetDate)
            .toList();
        
        if (orders.isEmpty) {
          throw Exception('No delivery run or orders found for today.');
        }

        // Aggregate items only from pending or out_for_delivery orders
        final Map<String, PickupItem> itemMap = {};
        for (var order in orders) {
          if (order.status == 'pending' || order.status == 'out_for_delivery') {
            for (var product in order.products) {
              final key = '${product.productName}_${product.unit}';
              if (!itemMap.containsKey(key)) {
                itemMap[key] = PickupItem(
                  id: key,
                  dispatchId: '',
                  productVariantId: '',
                  productName: product.productName,
                  quantity: product.quantity.toDouble(),
                  unit: product.unit,
                  unitValue: 1.0,
                  isReturnable: false,
                  loadedQty: 0,
                );
              } else {
                final existing = itemMap[key]!;
                itemMap[key] = PickupItem(
                  id: existing.id,
                  dispatchId: existing.dispatchId,
                  productVariantId: existing.productVariantId,
                  productName: existing.productName,
                  quantity: existing.quantity + product.quantity.toDouble(),
                  unit: existing.unit,
                  unitValue: existing.unitValue,
                  isReturnable: existing.isReturnable,
                  loadedQty: existing.loadedQty,
                );
              }
            }
          }
        }

        print('Aggregated ${itemMap.length} unique pickup items: ${itemMap.keys.toList()}');
        return PickupResponse(
          status: true,
          deliveryPartnerId: '',
          deliveryPartnerName: '',
          date: date ?? DateTime.now().toIso8601String(),
          runId: run?.runId ?? (orders.isNotEmpty ? orders.first.runId ?? 'fallback_run' : null),
          runStatus: run?.status ?? 'assigned',
          slot: run?.slot,
          pickupConfirmed: false,
          items: itemMap.values.toList(),
          baggingInstructions: [],
        );
      } catch (fallbackError) {
        // If fallback also fails, throw original error
        throw _handleDioError(e, 'Failed to get pickup items');
      }
    }
  }

  @override
  Future<bool> confirmPickup({
    required String runId,
    required List<PickupItem> items,
    double? latitude,
    double? longitude,
  }) async {
    try {
      final itemsData = items.map((item) => item.toJson()).toList();
      final response = await _remoteDataSource.confirmPickup(
        runId: runId,
        items: itemsData,
        latitude: latitude,
        longitude: longitude,
      );
      if (response['success'] == true) {
        return true;
      }
      throw Exception(response['message'] ?? 'Failed to confirm pickup');
    } catch (e) {
      print('Error confirming pickup: $e');
      throw _handleDioError(e, 'Failed to confirm pickup');
    }
  }

  @override
  Future<HandoverResult> handoverRun(String runId) async {
    try {
      final response = await _dioClient.dio.post(ApiEndpoints.handoverRun(runId));
      final data = response.data;
      if (data != null) {
        return HandoverResult.fromJson(data);
      }
      return HandoverResult(
        success: false,
        message: 'No response data from server',
        status: '',
        emptyBottlesReturned: 0,
        returnedItems: [],
      );
    } catch (e) {
      print('Error during handover in repository: $e');
      return HandoverResult(
        success: false,
        message: e is DioException ? apiErrorMessage(e, e.message ?? e.toString()) : e.toString(),
        status: '',
        emptyBottlesReturned: 0,
        returnedItems: [],
      );
    }
  }

  Exception _handleDioError(dynamic e, String defaultMessage) {
    if (e is DioException) {
      final serverMessage = apiErrorMessage(e, '');
      if (serverMessage != null) {
        return Exception(serverMessage);
      }
      return Exception(e.message ?? defaultMessage);
    }
    return Exception('$defaultMessage: $e');
  }
}

