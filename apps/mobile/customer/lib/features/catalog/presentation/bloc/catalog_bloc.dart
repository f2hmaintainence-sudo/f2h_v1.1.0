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
        catalogRepository.getProducts(),
        catalogRepository.getCategories(),
      ]);
      final products = results[0] as List<Product>;
      final categories = results[1] as List<Map<String, dynamic>>;
      emit(CatalogLoaded(products: products, filteredProducts: products, categories: categories));
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
          categoryProducts = await catalogRepository.getProducts();
        } else {
          categoryProducts = await catalogRepository.getProductsByCategoryId(event.categoryId);
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
