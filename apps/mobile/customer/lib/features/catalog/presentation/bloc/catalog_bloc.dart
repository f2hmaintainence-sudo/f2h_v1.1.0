import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:f2h_customer/core/errors/error_handler.dart';
import 'package:f2h_customer/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_event.dart';
import 'package:f2h_customer/features/catalog/presentation/bloc/catalog_state.dart';

class CatalogBloc extends Bloc<CatalogEvent, CatalogState> {
  final CatalogRepository catalogRepository;

  CatalogBloc({required this.catalogRepository}) : super(CatalogInitial()) {
    on<LoadCatalog>(_onLoadCatalog);
    on<LoadProductsByCategory>(_onLoadProductsByCategory);
    on<SearchCatalog>(_onSearchCatalog);
  }

  Future<void> _onLoadCatalog(LoadCatalog event, Emitter<CatalogState> emit) async {
    emit(CatalogLoading());
    try {
      final results = await Future.wait([
        catalogRepository.getProducts(branchId: event.branchId),
        catalogRepository.getCategories(),
      ]);
      final products = results[0] as List<Product>;
      final categories = results[1] as List<Map<String, dynamic>>;
      emit(CatalogLoaded(
        products: products,
        filteredProducts: products,
        categories: categories,
        branchId: event.branchId,
      ));
    } catch (e) {
      emit(CatalogError(extractErrorMessage(e)));
    }
  }

  Future<void> _onLoadProductsByCategory(LoadProductsByCategory event, Emitter<CatalogState> emit) async {
    if (state is CatalogLoaded) {
      final currentState = state as CatalogLoaded;
      final allProducts = currentState.products;
      emit(CatalogLoaded(
        products: allProducts,
        filteredProducts: currentState.filteredProducts,
        categories: currentState.categories,
        searchQuery: currentState.searchQuery,
        isFiltering: true,
      ));
      try {
        List<Product> categoryProducts;
        if (event.categoryId == 'All') {
          categoryProducts = await catalogRepository.getProducts(
            branchId: currentState.branchId,
          );
        } else {
          categoryProducts = await catalogRepository.getProductsByCategoryId(
            event.categoryId,
            branchId: currentState.branchId,
          );
          if (categoryProducts.isEmpty && allProducts.isNotEmpty) {
            categoryProducts = allProducts.where((p) =>
              p.category.toLowerCase() == event.categoryId.toLowerCase() ||
              p.category.toLowerCase().contains(event.categoryId.toLowerCase())
            ).toList();
          }
        }

        // Sync stock flags with master catalog to guarantee 100% consistency across category views
        if (allProducts.isNotEmpty) {
          categoryProducts = categoryProducts.map((cp) {
            final master = allProducts.firstWhere(
              (ap) => ap.id == cp.id || ap.name.toLowerCase() == cp.name.toLowerCase(),
              orElse: () => cp,
            );
            if (master.isOutOfStock || master.isLowStock) {
              return Product(
                id: cp.id,
                name: cp.name,
                vendor: cp.vendor,
                unit: cp.unit,
                category: cp.category,
                emoji: cp.emoji,
                price: cp.price,
                originalPrice: cp.originalPrice,
                subscriptionPrice: cp.subscriptionPrice,
                rating: cp.rating,
                reviews: cp.reviews,
                isOrganic: cp.isOrganic,
                isSubscribable: cp.isSubscribable,
                isOneTime: master.isLowStock ? false : cp.isOneTime,
                isOutOfStock: master.isOutOfStock || cp.isOutOfStock,
                isLowStock: master.isLowStock || cp.isLowStock,
                description: cp.description,
                highlights: cp.highlights,
                ingredients: cp.ingredients,
                legalInfo: cp.legalInfo,
                badge: cp.badge,
                badgeColor: cp.badgeColor,
                imageAsset: cp.imageAsset,
                images: cp.images,
                variants: cp.variants,
              );
            }
            return cp;
          }).toList();
        }

        emit(CatalogLoaded(
          products: allProducts,
          filteredProducts: categoryProducts,
          categories: currentState.categories,
          searchQuery: '',
          isFiltering: false,
        ));
      } catch (e) {
        emit(CatalogError(extractErrorMessage(e)));
      }
    }
  }

  void _onSearchCatalog(SearchCatalog event, Emitter<CatalogState> emit) {
    if (state is CatalogLoaded) {
      final currentState = state as CatalogLoaded;
      final query = event.query.toLowerCase();
      if (query.isEmpty) {
        emit(CatalogLoaded(
          products: currentState.products,
          filteredProducts: currentState.products,
          categories: currentState.categories,
          searchQuery: '',
        ));
      } else {
        final filtered = currentState.products.where((p) {
          return p.name.toLowerCase().contains(query) ||
              p.category.toLowerCase().contains(query) ||
              p.vendor.toLowerCase().contains(query);
        }).toList();
        emit(CatalogLoaded(
          products: currentState.products,
          filteredProducts: filtered,
          categories: currentState.categories,
          searchQuery: event.query,
        ));
      }
    }
  }
}
