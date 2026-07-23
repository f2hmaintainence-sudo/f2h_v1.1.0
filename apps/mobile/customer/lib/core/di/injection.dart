// ============================================================================
// ChronoSparkSolutions — A Software Company
// © 2026 ChronoSparkSolutions. All rights reserved.
//
// Project     : F2H Fresh
// File        : injection.dart
// Description : Dependency injection container setup for customer app
//
// ============================================================================

import 'package:get_it/get_it.dart';
import 'package:f2h_customer/core/api/dio_client.dart';
import 'package:f2h_customer/core/cache/isar_service.dart';
import 'package:f2h_customer/core/services/notification_service.dart';
import 'package:f2h_customer/core/session/customer_bootstrap_api.dart';
import 'package:f2h_customer/core/session/customer_session_cache.dart';
import 'package:f2h_customer/core/session/customer_session_cubit.dart';
import 'package:f2h_customer/auth/data/datasources/auth_remote_datasource.dart';
import 'package:f2h_customer/auth/data/datasources/auth_local_datasource.dart';
import 'package:f2h_customer/auth/data/repositories/auth_repository_impl.dart';
import 'package:f2h_customer/auth/domain/repositories/auth_repository.dart';
import 'package:f2h_customer/auth/presentation/bloc/auth_bloc.dart';
import 'package:f2h_customer/core/network/network_bloc.dart';

import 'package:f2h_customer/features/catalog/data/datasources/catalog_remote_datasource.dart';
import 'package:f2h_customer/features/catalog/data/repositories/cart/catalog_repository_impl.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_bloc.dart';
import 'package:f2h_customer/features/catalog/data/datasources/cart/cart_remote_datasource.dart';
import 'package:f2h_customer/features/catalog/data/repositories/cart_repository_impl.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/cart/cart_repository.dart';
import 'package:f2h_customer/features/catalog/domain/usecases/cart/sync_cart_usecase.dart';
import 'package:f2h_customer/features/catalog/domain/usecases/cart/get_cart_usecase.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/cart/cart_bloc.dart';
import 'package:f2h_customer/features/catalog/data/datasources/checkout/checkout_remote_datasource.dart';
import 'package:f2h_customer/features/catalog/data/repositories/checkout/checkout_repository_impl.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/checkout/checkout_repository.dart';
import 'package:f2h_customer/features/catalog/domain/usecases/checkout/place_checkout_usecase.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/checkout/checkout_bloc.dart';

import 'package:f2h_customer/features/profile/data/datasources/profile_remote_datasource.dart';
import 'package:f2h_customer/features/profile/data/repositories/profile_repository_impl.dart';
import 'package:f2h_customer/features/profile/domain/repositories/profile_repository.dart';
import 'package:f2h_customer/features/profile/presentation/bloc/profile_bloc.dart';

import 'package:f2h_customer/features/subscription/data/datasources/subscription_remote_datasource.dart';
import 'package:f2h_customer/features/subscription/data/repositories/subscription_repository_impl.dart';
import 'package:f2h_customer/features/subscription/domain/repositories/subscription_repository.dart';
import 'package:f2h_customer/features/subscription/presentation/bloc/subscription_bloc.dart';
import 'package:f2h_customer/features/orders/data/datasources/orders_remote_datasource.dart';
import 'package:f2h_customer/features/orders/data/repositories/orders_repository_impl.dart';
import 'package:f2h_customer/features/orders/domain/repositories/orders_repository.dart';
import 'package:f2h_customer/features/orders/presentation/bloc/order_history_bloc.dart';

import 'package:f2h_customer/features/notifications/data/datasources/notifications_remote_datasource.dart';
import 'package:f2h_customer/features/notifications/data/repositories/notifications_repository.dart';
import 'package:f2h_customer/features/notifications/presentation/bloc/notifications_bloc.dart';

import 'package:f2h_customer/core/config/config_repository.dart';

final sl = GetIt.instance;

Future<void> init() async {
  // ── Core: DioClient (singleton, must be first) ───────────────────────────
  final dioClient = DioClient();
  await dioClient.init();
  sl.registerLazySingleton(() => dioClient);

  final configRepo = ConfigRepository(dioClient: dioClient);
  await configRepo.hydrateLocalConfig();
  configRepo.syncIfNeeded();
  sl.registerLazySingleton(() => configRepo);

  sl.registerLazySingleton(() => IsarService());
  sl.registerLazySingleton(() => NotificationService());
  sl.registerLazySingleton(() => CustomerSessionCache());
  sl.registerLazySingleton(() => CustomerBootstrapApi(dioClient: sl()));

  // Data sources
  sl.registerLazySingleton<AuthRemoteDataSource>(
    () => AuthRemoteDataSourceImpl(dioClient: sl()),
  );
  sl.registerLazySingleton<AuthLocalDataSource>(
    () => AuthLocalDataSourceImpl(isarService: sl()),
  );
  sl.registerLazySingleton<CatalogRemoteDataSource>(
    () => CatalogRemoteDataSourceImpl(dioClient: sl()),
  );
  sl.registerLazySingleton<CartRemoteDataSource>(
    () => CartRemoteDataSourceImpl(dioClient: sl()),
  );
  sl.registerLazySingleton<CheckoutRemoteDataSource>(
    () => CheckoutRemoteDataSourceImpl(dioClient: sl()),
  );
  sl.registerLazySingleton<ProfileRemoteDataSource>(
    () => ProfileRemoteDataSourceImpl(dioClient: sl()),
  );
  sl.registerLazySingleton<SubscriptionRemoteDataSource>(
    () => SubscriptionRemoteDataSourceImpl(dioClient: sl()),
  );
  sl.registerLazySingleton<OrdersRemoteDataSource>(
    () => OrdersRemoteDataSourceImpl(dioClient: sl()),
  );

  // Repository
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(
      remoteDataSource: sl(),
      localDataSource: sl(),
      dioClient: sl(),
      // TokenStorage is a static class — no injection needed
    ),
  );
  sl.registerLazySingleton<CatalogRepository>(
    () => CatalogRepositoryImpl(remoteDataSource: sl()),
  );
  sl.registerLazySingleton<CartRepository>(
    () => CartRepositoryImpl(remoteDataSource: sl()),
  );
  sl.registerLazySingleton(() => SyncCartUseCase(sl()));
  sl.registerLazySingleton(() => GetCartUseCase(sl()));
  sl.registerLazySingleton<CheckoutRepository>(
    () => CheckoutRepositoryImpl(remoteDataSource: sl()),
  );
  sl.registerLazySingleton(() => PlaceCheckoutUseCase(sl()));
  sl.registerLazySingleton<ProfileRepository>(
    () => ProfileRepositoryImpl(remoteDataSource: sl()),
  );
  sl.registerLazySingleton<SubscriptionRepository>(
    () => SubscriptionRepositoryImpl(remoteDataSource: sl()),
  );
  sl.registerLazySingleton<OrdersRepository>(
    () => OrdersRepositoryImpl(remoteDataSource: sl()),
  );
  sl.registerLazySingleton<NotificationsRemoteDataSource>(
    () => NotificationsRemoteDataSourceImpl(dioClient: sl()),
  );
  sl.registerLazySingleton<NotificationsRepository>(
    () => NotificationsRepositoryImpl(remoteDataSource: sl()),
  );


  // Bloc
  sl.registerFactory(() => AuthBloc(authRepository: sl(), notificationService: sl()));
  sl.registerFactory(() => CustomerSessionCubit(
        bootstrapApi: sl(),
        cache: sl(),
        // TokenStorage is static; CustomerSessionCubit reads it directly if needed
      ));
  sl.registerFactory(() => CatalogBloc(catalogRepository: sl()));
  sl.registerFactory(() => CartBloc(syncCartUseCase: sl(), getCartUseCase: sl()));
  sl.registerFactory(() => ProfileBloc(profileRepository: sl()));
  sl.registerFactory(() => CheckoutBloc(placeCheckoutUseCase: sl()));
  sl.registerFactory(() => SubscriptionBloc(subscriptionRepository: sl()));
  sl.registerFactory(() => OrderHistoryBloc(ordersRepository: sl()));
  sl.registerFactory(() => NotificationsBloc(notificationsRepository: sl()));
  sl.registerFactory(() => NetworkBloc());
}
