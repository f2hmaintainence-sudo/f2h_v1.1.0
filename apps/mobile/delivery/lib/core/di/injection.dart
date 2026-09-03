import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';
import 'package:f2h_delivery/core/api/dio_client.dart';
import 'package:f2h_delivery/core/security/play_integrity_service.dart';
import 'package:f2h_delivery/auth/data/datasources/auth_remote_datasource.dart';
import 'package:f2h_delivery/auth/data/datasources/auth_local_datasource.dart';
import 'package:f2h_delivery/auth/data/repositories/auth_repository_impl.dart';
import 'package:f2h_delivery/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_delivery/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_delivery/features/profile/data/profile_repository.dart';
import 'package:f2h_delivery/features/profile/data/datasources/profile_remote_datasource.dart';
import 'package:f2h_delivery/features/profile/presentation/bloc/profile_bloc.dart';
import 'package:f2h_delivery/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_delivery/features/orders/data/repositories/orders_repository_impl.dart';
import 'package:f2h_delivery/features/orders/presentation/bloc/pickup_bloc.dart';
import 'package:f2h_delivery/features/orders/presentation/bloc/handover_bloc.dart';
import 'package:f2h_delivery/features/delivery_session/presentation/bloc/delivery_session_bloc.dart';
import 'package:f2h_delivery/core/isar/isar_service.dart';
import 'package:f2h_delivery/services/location_service.dart';
import 'package:f2h_delivery/services/route_optimization_service.dart';
import 'package:f2h_delivery/services/location_tracking_service.dart';

import 'package:f2h_delivery/core/config/config_repository.dart';

final sl = GetIt.instance;

Future<void> init() async {
  // Initialize Isar — wrapped so a corrupt DB never prevents app launch.
  // Tokens live in flutter_secure_storage; Isar only caches the user object.
  try {
    await IsarService.init();
  } catch (e) {
    debugPrint('[DI] IsarService.init() failed, continuing without local cache: $e');
  }

  // Core — DioClient singleton
  final dioClient = DioClient();
  await dioClient.init();
  sl.registerLazySingleton(() => dioClient);
  // The same instance the DioClient interceptor uses, so anything that
  // needs to check or re-warm Play Integrity shares one native provider.
  sl.registerLazySingleton<PlayIntegrityService>(() => dioClient.playIntegrity);

  final configRepo = ConfigRepository(dioClient: dioClient);
  await configRepo.hydrateLocalConfig();
  configRepo.syncIfNeeded();
  sl.registerLazySingleton(() => configRepo);

  // Data sources
  sl.registerLazySingleton<AuthRemoteDataSource>(
    () => AuthRemoteDataSourceImpl(dioClient: sl()),
  );

  sl.registerLazySingleton<AuthLocalDataSource>(
    () => AuthLocalDataSourceImpl(isar: IsarService.isar),
  );

  // Repository
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(
      remoteDataSource: sl(),
      localDataSource: sl(),
    ),
  );

  // Profile
  sl.registerLazySingleton<ProfileRemoteDataSource>(
    () => ProfileRemoteDataSourceImpl(dioClient: sl()),
  );
  sl.registerLazySingleton(() => ProfileRepository(sl()));

  // Orders
  sl.registerLazySingleton<OrdersRepository>(() => OrdersRepositoryImpl(sl()));

  // Bloc
  // Must be LazySingleton (not Factory) so the AuthInterceptor's 401 handler
  // fires on the same AuthBloc instance that AppShell is listening to.
  sl.registerLazySingleton(() => AuthBloc(authRepository: sl()));
  sl.registerFactory(() => ProfileBloc(sl()));
  sl.registerLazySingleton(() => DeliverySessionBloc(
    ordersRepo: sl(),
    profileRepo: sl(),
  ));
  sl.registerFactory(() => PickupBloc(ordersRepository: sl()));
  sl.registerFactory(() => HandoverBloc(ordersRepository: sl(), deliverySessionBloc: sl()));

  // Services
  sl.registerLazySingleton(() => LocationService());
  sl.registerLazySingleton(() => RouteOptimizationService(
    locationService: sl(),
    dio: sl<DioClient>().dio,
  ));

  sl.registerLazySingleton(() => LocationTrackingService(
    locationService: sl(),
    dioClient: sl(),
    authLocalDataSource: sl(),
  ));
}