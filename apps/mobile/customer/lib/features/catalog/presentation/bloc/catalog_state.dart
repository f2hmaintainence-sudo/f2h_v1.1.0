import 'package:equatable/equatable.dart';
import 'package:f2h_customer/features/catalog/data/models/product_model.dart';

abstract class CatalogState extends Equatable {
  const CatalogState();

  @override
  List<Object?> get props => [];
}

class CatalogInitial extends CatalogState {}

class CatalogLoading extends CatalogState {}

class CatalogLoaded extends CatalogState {
  final List<Product> products;
  final List<Product> filteredProducts;
  final List<Map<String, dynamic>> categories;
  final String searchQuery;
  final bool isFiltering;
  final String? branchId;

  const CatalogLoaded({
    required this.products,
    required this.filteredProducts,
    this.categories = const [],
    this.searchQuery = '',
    this.isFiltering = false,
    this.branchId,
  });

  @override
  List<Object?> get props => [products, filteredProducts, categories, searchQuery, isFiltering, branchId];
}

class CatalogError extends CatalogState {
  final String message;
  const CatalogError(this.message);

  @override
  List<Object?> get props => [message];
}
